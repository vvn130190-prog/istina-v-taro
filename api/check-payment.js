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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Используй POST-запрос.' });

  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Не указан номер заказа.' });

    // ПРОСТО ИЩЕМ ГОТОВЫЙ РАСКЛАД В БАЗЕ
    const resultStr = await redis.get(`result:${orderId}`);

    if (resultStr) {
      const result = JSON.parse(resultStr);
      return res.status(200).json({ status: 'success', answer: result.answer, followups: result.followups });
    } else {
      // Если расклада нет — значит, вебхук еще не успел его сгенерировать
      return res.status(200).json({ status: 'pending', error: 'Расклад еще готовится.' });
    }
  } catch (error) {
    return res.status(500).json({ error: "Системная ошибка: " + error.message });
  }
}
