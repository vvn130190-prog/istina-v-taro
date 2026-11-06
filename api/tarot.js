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

  const { question, isFree } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'Вопрос не получен' });
  }

  const apiKey = process.env.YANDEX_API_KEY; 
  if (!apiKey) {
    return res.status(500).json({ error: 'Ключ ИИ не настроен' });
  }

  // ЖЕСТКИЙ ПРОМПТ ДЛЯ БЕСПЛАТНОГО ВОПРОСА (Максимум 3 предложения)
  const FREE_PROMPT = `
  Ты — таролог. Дай ОЧЕНЬ КОРОТКИЙ ответ на вопрос (максимум 3 предложения, не больше!).
  Не давай советов, просто опиши, что карты видят в ситуации.
  В самом конце ОБЯЗАТЕЛЬНО добавь фразу: "Но это только верхушка айсберга. Карты скрывают кое-что важное..."
  Вопрос клиента: "${question}"
  `;

  // ПРОМПТ ДЛЯ ПЛАТНОГО ВОПРОСА (Длинный)
  const PAID_PROMPT = `
  Ты — опытный таролог. Твоя задача — дать развернутый, глубокий анализ ситуации клиента (до 8-10 предложений).
  Опиши скрытые причины ситуации, которые карты видят. Дай практический совет.
  Тон — спокойный, поддерживающий, мудрый.
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
        modelUri: 'gpt://b1gva850tfnbt1pfqu7q/yandexgpt-lite', 
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: isFree ? 80 : 300 // 80 токенов - это примерно 3 предложения
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
