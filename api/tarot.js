export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, isFree } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Вопрос не получен' });

  const apiKey = process.env.YANDEX_API_KEY; 
  if (!apiKey) return res.status(500).json({ error: 'Ключ ИИ не настроен' });

  // ПРОМПТ ДЛЯ БЕСПЛАТНОГО ВОПРОСА
  const FREE_PROMPT = `
  Ты — таролог Виктория Нос. Ты общаешься с клиентом бережно, с теплом. Используй обращение на "Вы".
  Твоя задача — дать ОЧЕНЬ КОРОТКИЙ, но ёмкий ответ (максимум 3-4 предложения).
  В САМОМ НАЧАЛЕ ответа напиши, какие 3 карты Таро выпали. Используй классические названия (например: "Выпали карты: Солнце, Луна, Верховная Жрица.").
  СРАЗУ СВЯЖИ ИХ В ЕДИНУЮ ИСТОРИЮ. Покажи, как они дополняют друг друга.
  В конце ОБЯЗАТЕЛЬНО добавь: "Я могу помочь Вам разобрать эту ситуацию глубже, чтобы всё стало более понятным."
  Вопрос клиента: "${question}"
  `;

  // ПРОМПТ ДЛЯ ПЛАТНОГО ВОПРОСА
  const PAID_PROMPT = `
  Ты — таролог Виктория Нос. Ты общаешься с клиентом бережно, с теплом. Используй обращение на "Вы".
  Твоя задача — дать развернутый анализ (до 10-12 предложений).
  В САМОМ НАЧАЛЕ ответа напиши, какие 5 карт Таро выпали. Используй классические названия.
  СРАЗУ СВЯЖИ ИХ В ЕДИНУЮ ИСТОРИЮ.

  КАЖДЫЙ из трех следующих вопросов оберни в HTML-тег <div class="tarot-block">. Пиши развернутый текст (минимум 2-3 предложения на каждый блок).
  
  Пример структуры ответа:
  Выпали карты: ... (тут связный текст).

  <div class="tarot-block">
  <strong>Что Вам нужно понять в этой ситуации?</strong><br>
  (Развернутый текст ответа на этот вопрос...)
  </div>

  <div class="tarot-block">
  <strong>Почему Вас так тянет к этому и что это значит?</strong><br>
  (Развернутый текст ответа...)
  </div>

  <div class="tarot-block">
  <strong>Какие уроки Вам нужно извлечь?</strong><br>
  (Развернутый текст ответа...)
  </div>

  В КОНЦЕ (вне рамок) обязательно дай поддерживающую рекомендацию: "Моя рекомендация: ... Все будет отлично, потому что..."
  
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
          maxTokens: isFree ? 150 : 1000 // Увеличили лимит для платного, чтобы текст не обрывался
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
