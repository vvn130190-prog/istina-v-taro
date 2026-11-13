import { Redis } from '@upstash/redis';
import fetch from 'node-fetch'; // Если у вас Node.js 18+, это может быть не нужно

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID; // Если используете Folder ID

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
    // Получаем IP-адрес пользователя
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    if (isFree) {
      const hasUsedFree = await redis.get(`free_trial:${ip}`);
      
      if (hasUsedFree) {
        return res.status(403).json({ 
          error: 'Вы уже использовали бесплатный вопрос. Пожалуйста, оплатите продолжение.' 
        });
      }
      
      // Записываем, что этот IP использовал бесплатный вопрос (храним 30 дней)
      // 30 дней * 24 часа * 60 минут * 60 секунд = 2592000 секунд
      await redis.set(`free_trial:${ip}`, 'true', { ex: 2592000 });
    }

    // --- 2. ФОРМИРОВАНИЕ ЗАПРОСА К YANDEXGPT ---
    // Подготовка истории для YandexGPT
    const messages = [
      { 
        role: 'system', 
        content: 'Ты — таролог. Отвечай честно, глубоко и по делу. ВАЖНО: Пиши ответ простым текстом. НЕ ИСПОЛЬЗУЙ HTML-теги (такие как <div>, <strong>, <b>, <br>). Для выделения заголовков используй обычный текст и переносы строк.' 
      }
    ];

    // Добавляем историю диалога (если есть)
    if (history && Array.isArray(history)) {
      history.forEach(item => {
        messages.push({ 
          role: item.role === 'user' ? 'user' : 'assistant', 
          content: item.text 
        });
      });
    }

    // Добавляем текущий вопрос
    messages.push({ role: 'user', content: question });

    // Запрос к YandexGPT
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${YANDEX_API_KEY}`
      },
      body: JSON.stringify({
        modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`, // Убедитесь, что Folder ID верный
        completionOptions: {
          stream: false,
          temperature: 0.6,
          maxTokens: isFree ? 500 : 1000 // Для платных ответов даем больше токенов
        },
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Ошибка YandexGPT:', errorData);
      throw new Error('Ошибка при генерации ответа');
    }

    const data = await response.json();
    const answer = data.result.alternatives[0].message.text;

    // Возвращаем ответ клиенту
    return res.status(200).json({ answer });

  } catch (error) {
    console.error('Ошибка в api/tarot.js:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
