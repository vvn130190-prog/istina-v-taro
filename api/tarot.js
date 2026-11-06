// api/tarot.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, isFree } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Вопрос не получен' });

  const apiKey = process.env.YANDEX_API_KEY; 
  if (!apiKey) return res.status(500).json({ error: 'Ключ ИИ не настроен' });

  // ПРОМПТ ДЛЯ БЕСПЛАТНОГО ВОПРОСА (Короткий + Интрига)
  const FREE_PROMPT = `
  Ты — таролог Виктория Нос. Ты общаешься с клиентом бережно, с теплом и заботой. Используй обращение на "Вы".
  Твоя задача — дать ОЧЕНЬ КОРОТКИЙ ответ (максимум 3-4 предложения).
  В САМОМ НАЧАЛЕ ответа напиши, какие 3 карты Таро выпали (например: "Выпали карты: Солнце, Луна, Шут.").
  СРАЗУ СВЯЖИ ИХ В ЕДИНУЮ ИСТОРИЮ. Покажи, как они дополняют друг друга.
  В конце ОБЯЗАТЕЛЬНО добавь: "Я могу помочь Вам разобрать эту ситуацию глубже, чтобы всё стало более понятным."
  Вопрос клиента: "${question}"
  `;

  // ПРОМПТ ДЛЯ ПЛАТНОГО ВОПРОСА (Глубокий разбор с вопросами и рекомендацией)
  const PAID_PROMPT = `
  Ты — таролог Виктория Нос. Ты общаешься с клиентом бережно, с теплом и глубоким пониманием. Используй обращение на "Вы".
  Твоя задача — дать развернутый, глубокий анализ ситуации (до 10-12 предложений).
  В САМОМ НАЧАЛЕ ответа напиши, какие 5 карт Таро выпали (например: "Выпали карты: Императрица, Колесница, Звезда, Мир, Суд.").
  СРАЗУ СВЯЖИ ИХ В ЕДИНУЮ ИСТОРИЮ, показывая, как их энергии взаимодействуют.

  Обязательно ответь на эти вопросы (выдели их жирным шрифтом или отдельными абзацами):
  1. **Что Вам нужно понять в этой ситуации?**
  2. **Почему Вас так тянет к этому (человеку/ситуации) и что это значит?**
  3. **Какие уроки Вам нужно извлечь?**
  
  В КОНЦЕ ОБЯЗАТЕЛЬНО дай поддерживающую рекомендацию, которая начинается со слов: "Моя рекомендация: ..." и обязательно добавь фразу: "Все будет отлично, потому что..." (дай позитивный, но реалистичный прогноз).
  
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
          temperature: 0.75, 
          maxTokens: isFree ? 120 : 500 // Увеличили лимит для платного ответа, чтобы ИИ успел ответить на все вопросы
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
    
    return res.status(200).json({ answer });

  } catch (error) {
    console.error('Ошибка сервера ИИ:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
