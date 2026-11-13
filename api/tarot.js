import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID; 

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, isFree, history } = req.body;

    // --- 1. ЗАЩИТА ОТ БЕСПЛАТНЫХ ВОПРОСОВ ---
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    if (isFree) {
      const hasUsedFree = await redis.get(`free_trial:${ip}`);
      
      if (hasUsedFree) {
        return res.status(403).json({ 
          error: 'Вы уже использовали бесплатный вопрос. Пожалуйста, оплатите продолжение.' 
        });
      }
      
      await redis.set(`free_trial:${ip}`, 'true', { ex: 2592000 });
    }

    // --- 2. ФОРМИРОВАНИЕ ЗАПРОСА К YANDEXGPT ---
    const messages = [
      { 
        role: 'system', 
        content: 'Ты — таролог. Отвечай честно, глубоко и по делу. ВАЖНО: Пиши ответ простым текстом. НЕ ИСПОЛЬЗУЙ HTML-теги (такие как <div>, <strong>, <b>, <br>). Для выделения заголовков используй обычный текст и переносы строк.' 
      }
    ];

    if (history && Array.isArray(history)) {
      history.forEach(item => {
        messages.push({ 
          role: item.role === 'user' ? 'user' : 'assistant', 
          content: item.text 
        });
      });
    }

    messages.push({ role: 'user', content: question });

    // Запрос к YandexGPT
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
          temperature: 0.6,
          maxTokens: isFree ? 800 : 1500 // Немного увеличили лимит
        },
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Ошибка YandexGPT:', errorData);
      return res.status(500).json({ error: 'Ошибка Yandex API', details: errorData });
    }

    const data = await response.json();
    const answer = data.result.alternatives[0].message.text;

    return res.status(200).json({ answer });

  } catch (error) {
    console.error('Ошибка в api/tarot.js:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
