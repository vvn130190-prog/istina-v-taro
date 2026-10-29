import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Используй POST-запрос.' });

  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Не указан номер заказа.' });

    // Проверяем статус в ЮKassa
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${orderId}`, {
      method: "GET",
      headers: { "Authorization": "Basic " + Buffer.from(shopId + ":" + secretKey).toString('base64') }
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: "Ошибка ЮKassa: " + (data.description || JSON.stringify(data)) });

    if (data.status === 'succeeded') {
      // Достаем вопрос из базы данных
      const orderDataStr = await redis.get(`order:${orderId}`);
      let question = "Клиент оплатил расклад, но вопрос не найден.";
      
      if (orderDataStr) {
        const orderData = JSON.parse(orderDataStr);
        question = orderData.question;
      }

      // Генерируем ответ через ИИ
      const aiResponse = await fetch("https://istina-v-taro2.vercel.app/api/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question })
      });

      const aiData = await aiResponse.json();
      return res.status(200).json({ status: 'success', answer: aiData.answer, followups: aiData.followups });
    } else {
      return res.status(200).json({ status: data.status, error: 'Платеж еще не оплачен.' });
    }
  } catch (error) {
    return res.status(500).json({ error: "Системная ошибка: " + error.message });
  }
}
