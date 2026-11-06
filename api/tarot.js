// api/tarot.js
export default async function handler(req, res) {
  // 1. СНАЧАЛА РАЗРЕШАЕМ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

  // ПРОМПТ ДЛЯ БЕСПЛАТНОГО ВОПРОСА (Короткий + Карты)
  const FREE_PROMPT = `
  Ты — таролог. Твоя задача — дать ОЧЕНЬ КОРОТКИЙ ответ (максимум 3 предложения).
  В САМОМ НАЧАЛЕ ответа обязательно напиши, какие 3 карты Таро выпали на вопрос (например: "Выпали карты: Солнце, Луна, Шут.").
  Затем кратко опиши, что они значат.
  В конце ОБЯЗАТЕЛЬНО добавь фразу: "Но это только верхушка айсберга. Карты скрывают кое-что важное..."
  Вопрос клиента: "${question}"
  `;

  // ПРОМПТ ДЛЯ ПЛАТНОГО ВОПРОСА (Глубокий + Карты)
  const PAID_PROMPT = `
  Ты — опытный таролог. Твоя задача — дать развернутый, глубокий анализ ситуации.
  В САМОМ НАЧАЛЕ ответа обязательно напиши, какие 5 карт Таро выпали на вопрос (например: "Выпали карты: Императрица, Колесница, Звезда, Мир, Суд.").
  Затем опиши скрытые причины, которые карты видят. Дай практический совет.
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

    const answer = data.result?.alternatives?.[0]?.message?.text || 'Карты сегодня молчат.';
    
    return res.status(200).json({ answer });

  } catch (error) {
    console.error('Ошибка сервера ИИ:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
