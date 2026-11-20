
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Используй POST-запрос.' });
  }

  try {
    const { orderId } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ error: 'Не указан номер заказа.' });
    }

    const resultData = await redis.get(`result:${orderId}`);

    if (!resultData) {
      return res.status(200).json({
        status: 'pending',
        error: 'Расклад еще готовится.'
      });
    }

    const result = typeof resultData === 'string'
      ? JSON.parse(resultData)
      : resultData;

    return res.status(200).json({
      status: result.status || 'success',
      answer: result.answer || '',
      cards: result.cards || [],
      spreadType: result.spreadType || 'single',
      followups: result.followups || []
    });

  } catch (error) {
    console.error('Ошибка проверки расклада:', error);

    return res.status(500).json({
      error: 'Системная ошибка: ' + error.message
    });
  }
}
