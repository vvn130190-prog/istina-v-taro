export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Теперь мы принимаем не только question, но и history (историю диалога)
  const { question, isFree, history } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Вопрос не получен' });

  const apiKey = process.env.YANDEX_API_KEY; 
  if (!apiKey) return res.status(500).json({ error: 'Ключ ИИ не настроен' });

  // ПРОМПТ (для бесплатного и платного)
  const SYSTEM_PROMPT = isFree 
    ? `Ты — профессиональный таролог Виктория Нос. Отвечай коротко (3-4 предложения). В начале напиши 3 выпавшие карты. Свяжи их с вопросом клиента. В конце добавь: "Я могу помочь Вам разобрать эту ситуацию глубже."`
    : `Ты — профессиональный таролог Виктория Нос. Дай развернутый анализ. В начале напиши 5 карт. Оберни 3 вопроса в <div class="tarot-block"><strong>Вопрос</strong><br>Ответ</div>. В конце дай рекомендацию. Если это продолжение диалога, учитывай предыдущие карты и ответы.`;

  // Формируем массив сообщений для Yandex API
  let messages = [
    { role: 'system', text: SYSTEM_PROMPT }
  ];

  // Если есть история диалога, добавляем её
  if (history && Array.isArray(history)) {
    messages = messages.concat(history); // Добавляем прошлые сообщения
  }

  // Добавляем текущий вопрос пользователя
  messages.push({ role: 'user', text: question });

  try {
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`
      },
      body: JSON.stringify({
        modelUri: 'gpt://b1gva850tfnbt1pfqu7q/yandexgpt', 
        completionOptions: {
          stream: false,
          temperature: 0.6,
          maxTokens: isFree ? 150 : 1000 
        },
        messages: messages // Передаем историю
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
