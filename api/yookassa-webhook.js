import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  // ЮKassa присылает POST-запрос при изменении статуса платежа
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    
    // Нас интересует только успешная оплата
    if (event.event === 'payment.succeeded') {
      const paymentId = event.object.id;
      
      // Достаем вопрос из базы данных
      const orderDataStr = await redis.get(`order:${paymentId}`);
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

      // Сохраняем готовый расклад в базу, чтобы сайт мог его показать
      await redis.set(`result:${paymentId}`, JSON.stringify({
        status: 'success',
        answer: aiData.answer,
        followups: aiData.followups
      }), { ex: 86400 }); // Храним 24 часа
    }

    // ЮKassa всегда ждет ответ 200 OK
    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: error.message });
  }
}
