import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const event = req.body;
    
    if (event.event === 'payment.succeeded') {
      const paymentId = event.object.id;

      // Достаем вопрос из базы
      const orderData = await redis.get(`order:${paymentId}`);
      let question = "Клиент оплатил расклад, но вопрос не найден.";
      let customerName = "Не указано";
      let customerContact = "Не указано";
      
      if (orderData) {
        if (typeof orderData === 'string') {
          try {
            const parsed = JSON.parse(orderData);
            question = parsed.question || question;
            customerName = parsed.name || customerName;
            customerContact = parsed.contact || customerContact;
          } catch (e) {}
        } else if (orderData.question) {
          question = orderData.question;
          customerName = orderData.name || customerName;
          customerContact = orderData.contact || customerContact;
        }
      }

      // 1. ОТПРАВЛЯЕМ ДАННЫЕ В GOOGLE-ТАБЛИЦУ
      const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhT8r3aoKhvn82qpsdG4UwR9281oCWuyYV7Gdbl-SeZDarqDcnIkduvEhIJ-AZQTq3OA/exec';
      
      const formData = new URLSearchParams();
      formData.append('name', customerName);
      formData.append('contact', customerContact);
      formData.append('question', question);
      formData.append('package', 'Оплата через ЮKassa');
      formData.append('amount', event.object.amount.value);

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: formData
      }).catch(e => console.error("Ошибка отправки в таблицу:", e));

      // 2. ГЕНЕРИРУЕМ РАСКЛАД ЧЕРЕЗ ИИ
      const aiResponse = await fetch("https://istina-v-taro2.vercel.app/api/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question })
      });

      const aiData = await aiResponse.json();

      // 3. СОХРАНЯЕМ РАСКЛАД В БАЗУ (для сайта)
      await redis.set(`result:${paymentId}`, JSON.stringify({
        status: 'success',
        answer: aiData.answer,
        followups: aiData.followups
      }), { ex: 86400 });
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: error.message });
  }
}
