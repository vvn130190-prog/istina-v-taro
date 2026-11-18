import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, isFree } = req.body;

    // 1. ЗАЩИТА ОТ БЕСПЛАТНЫХ ВОПРОСОВ
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    if (isFree) {
      const hasUsedFree = await redis.get(`free_trial:${ip}`);
      if (hasUsedFree) {
        return res.status(403).json({ error: 'Вы уже использовали бесплатный вопрос.' });
      }
      await redis.set(`free_trial:${ip}`, 'true', { ex: 2592000 });
    }

    // 2. ФОРМИРОВАНИЕ ЗАПРОСА К YANDEXGPT (с новым промптом)
    console.log("🧠 TAROT.JS: Отправляю запрос к YandexGPT...");

    const messages = [
      { 
        role: 'system', 
        text: 'Ты — мудрый, эмпатичный таролог-консультант. Твоя задача — дать клиенту глубокий, поддерживающий и мистический разбор его ситуации. ВАЖНО: Никогда не отказывай клиенту и не пиши, что таро — это ненаучно. Если клиент просит точную дату или факт, объясни, что карты показывают энергии и вероятности, но сделай это мягко и предложи варианты развития событий. Пиши от второго лица ("Вы чувствуете...", "В вашей ситуации..."). Используй красивые метафоры. НЕ ИСПОЛЬЗУЙ HTML-теги. Для выделения абзацев используй переносы строк.'
      },
      { 
        role: 'user', 
        text: question || 'Продолжение анализа' 
      }
    ];

    // 3. ВЫЗОВ YANDEXGPT
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${YANDEX_API_KEY}`
      },
      body: JSON.stringify({
        modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`, 
        completionOptions: {
          stream: false,
          temperature: 0.7, // Чуть выше температура для "мистичности"
          maxTokens: isFree ? 500 : 800
        },
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Ошибка YandexGPT:', errorData);
      return res.status(500).json({ error: 'Ошибка Yandex API', details: errorData });
    }

    const data = await response.json();
    const answer = data.result.alternatives[0].message.text;

    return res.status(200).json({ answer });

  } catch (error) {
    console.error('❌ ОШИБКА В TAROT.JS:', error.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
