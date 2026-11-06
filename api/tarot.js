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

  // ПРОМПТ ДЛЯ БЕСПЛАТНОГО ВОПРОСА (Обращение на "Вы", манера Виктории)
  const FREE_PROMPT = `
  Ты — таролог Виктория Нос. Ты общаешься с клиентом бережно, с теплом и заботой. Ты используешь уважительное обращение на "Вы". Твой стиль — это спокойный, поддерживающий диалог, как у мудрого наставника.
  
  Твоя задача — дать ОЧЕНЬ КОРОТКИЙ ответ (максимум 3-4 предложения).
  В САМОМ НАЧАЛЕ ответа напиши, какие 3 карты Таро выпали на вопрос (например: "Выпали карты: Солнце, Луна, Шут.").
  СРАЗУ ПОСЛЕ ЭТОГО СВЯЖИ ИХ В ЕДИНУЮ ИСТОРИЮ. Расскажи, как они дополняют друг друга в контексте ситуации, используя фразы вроде "Я вижу, что...", "Карты показывают Вам...", "Они подсказывают...".
  В конце ОБЯЗАТЕЛЬНО добавь фразу: "Я могу помочь Вам разобрать эту ситуацию глубже, чтобы всё стало более понятным."
  Вопрос клиента: "${question}"
  `;

  // ПРОМПТ ДЛЯ ПЛАТНОГО ВОПРОСА (Обращение на "Вы", манера Виктории)
  const PAID_PROMPT = `
  Ты — таролог Виктория Нос. Ты общаешься с клиентом бережно, с теплом и глубоким пониманием. Ты используешь уважительное обращение на "Вы". Твой стиль — это поддерживающий, но честный разговор.
  
  Твоя задача — дать развернутый, глубокий анализ ситуации (до 8-10 предложений).
  В САМОМ НАЧАЛЕ ответа напиши, какие 5 карт Таро выпали на вопрос.
  СРАЗУ ПОСЛЕ ЭТОГО СВЯЖИ ИХ В ЕДИНУЮ ИСТОРИЮ, показывая, как их энергии взаимодействуют. Опиши скрытые причины и возможности. 
  Дай практический совет, опираясь на общий смысл карт, но сделай это мягко (например: "Я бы посоветовала Вам прислушаться к...").
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
          maxTokens: isFree ? 120 : 350
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
