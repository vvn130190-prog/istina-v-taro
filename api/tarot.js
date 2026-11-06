// api/tarot.js
export default async function handler(req, res) {
  // 1. СНАЧАЛА РАЗРЕШАЕМ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. ОТВЕЧАЕМ НА ПРОВЕРОЧНЫЙ ЗАПРОС БРАУЗЕРА (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. ТЕПЕРЬ ПРОВЕРЯЕМ, ЧТО ЭТО POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 4. Получаем вопрос и флаг
  const { question, isFree } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'Вопрос не получен' });
  }

  const apiKey = process.env.YANDEX_API_KEY; 
  if (!apiKey) {
    return res.status(500).json({ error: 'Ключ ИИ не настроен' });
  }

  // 5. ПРОМПТ ДЛЯ БЕСПЛАТНОГО ВОПРОСА
  const FREE_PROMPT = `
  Ты — опытный и бережный таролог. Твоя задача — дать глубокий, но КОРОТКИЙ ответ на вопрос пользователя.
  ПРАВИЛА:
  1. Отвечай максимум в 3-4 предложениях.
  2. Не давай готовых решений. Говори о скрытых смыслах и на что обратить внимание.
  3. В конце ответа ОБЯЗАТЕЛЬНО оставь интригу (например: "Но есть один важный нюанс, который карты пока скрывают...").
  4. Пиши мягко, без запугиваний.
  Вопрос клиента: "${question}"
  `;

  // 6. ПРОМПТ ДЛЯ ПЛАТНОГО ВОПРОСА
  const PAID_PROMPT = `
  Ты — опытный таролог. Твоя задача — дать развернутый, глубокий анализ ситуации клиента (до 8-10 предложений).
  ПРАВИЛА:
  1. Опиши скрытые причины ситуации, которые карты видят.
  2. Дай практический совет, на что обратить внимание.
  3. Тон — спокойный, поддерживающий, мудрый.
  4. Не предсказывай будущее фатально, говори о возможностях.
  Вопрос клиента: "${question}"
  `;

  const SYSTEM_PROMPT = isFree ? FREE_PROMPT : PAID_PROMPT;

  try {
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`
      },
      body: JSON.stringify({
        modelUri: 'gpt://b1gva850tfnbt1pqu7q/yandexgpt-lite', 
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: isFree ? 100 : 300
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

    const answer = data.result?.alternatives?.[0]?.message?.text || 'Карты сегодня молчат. Попробуйте переформулировать вопрос.';
    const followups = ["Что мне мешает сейчас?", "Какой урок я должна извлечь?", "Что изменится, если я сделаю шаг?"];

    return res.status(200).json({ answer, followups });

  } catch (error) {
    console.error('Ошибка сервера ИИ:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
