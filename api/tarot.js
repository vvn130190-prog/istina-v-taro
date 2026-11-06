// api/tarot.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'Вопрос не получен' });
  }

  // Ваш ключ Яндекса (или другого ИИ)
  const apiKey = process.env.YANDEX_API_KEY; 

  if (!apiKey) {
    return res.status(500).json({ error: 'Ключ ИИ не настроен' });
  }

  // ЖЕСТКАЯ ИНСТРУКЦИЯ ДЛЯ ИИ (Промпт)
  const SYSTEM_PROMPT = `
  Ты — опытный и бережный таролог. Твоя задача — дать глубокий, но КОРОТКИЙ ответ на вопрос пользователя.
  
  ПРАВИЛА:
  1. Отвечай максимум в 3-4 предложениях.
  2. Не давай готовых решений (не говори "делай так-то"). Вместо этого говори о скрытых смыслах, энергиях или о том, на что стоит обратить внимание.
  3. В конце ответа обязательно оставь интригу (например: "Но есть один нюанс, который карты скрывают..." или "Это только верхушка айсберга...").
  4. Пиши мягко, без мистики, запугиваний и категоричных предсказаний.
  5. Тон — спокойный, поддерживающий, как у мудрого наставника.
  
  Вопрос клиента: "${question}"
  `;

  try {
    // ВНИМАНИЕ: Здесь указан эндпоинт Яндекса (YandexGPT). 
    // Если у вас другой провайдер (например, OpenAI), замените URL и структуру запроса.
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`
      },
      body: JSON.stringify({
        modelUri: 'gpt://b1g.../yandexgpt-lite', // Укажите ваш modelUri из Yandex Cloud
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: 150 // Ограничиваем длину ответа, чтобы ИИ не писал "войну и мир"
        },
        messages: [
          { role: 'system', text: SYSTEM_PROMPT },
          { role: 'user', text: question }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Ошибка ИИ:', data);
      return res.status(500).json({ error: 'Ошибка генерации ответа' });
    }

    // Извлекаем текст ответа из ответа Яндекса
    const answer = data.result?.alternatives?.[0]?.message?.text || 'Карты сегодня молчат. Попробуйте переформулировать вопрос.';

    // Генерируем фейковые уточняющие вопросы для красоты (если нужно)
    const followups = [
      "Что мне мешает сейчас?",
      "Какой урок я должна извлечь?",
      "Что изменится, если я сделаю шаг?"
    ];

    return res.status(200).json({ answer, followups });

  } catch (error) {
    console.error('Ошибка сервера ИИ:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
