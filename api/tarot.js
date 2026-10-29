export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Используй POST-запрос.' });
  }

  try {
    const { question } = req.body;
    if (!question || question.trim().length < 3) {
      return res.status(400).json({ error: 'Опиши ситуацию подробнее.' });
    }

    const apiKey = process.env.YANDEX_API_KEY;
    const folderId = "b1gva850tfnbt1pfqu7q";

    if (!apiKey) throw new Error("Не настроен ключ Yandex.");

    const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
      method: "POST",
      headers: {
        "Authorization": `Api-Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/yandexgpt-lite/latest`,
        completionOptions: { stream: false, temperature: 0.7, maxTokens: 500 },
        messages: [
          {
            role: "system",
            text: `Ты — мудрая, бережная наставница и добрая подруга проекта «Истина в Таро». 
Твоя главная цель — чтобы человек почувствовал поддержку, доверие и захотел вернуться. Обращайся на «ты».

ГЛАВНЫЕ ПРАВИЛА ТВОЕЙ МЕТОДИКИ:
1. Всё, что происходит в жизни — к лучшему. Любая ситуация делает человека сильнее и мудрее.
2. Никаких жестких советов (не говори «брось», «уходи», «сделай так»). Человек сам решает свою судьбу. Мягко направляй его на размышления.
3. Подсвечивай, что можно проработать в себе, чтобы стать сильнее, увереннее и счастливее.
4. СТРОГО ЗАПРЕЩЕНО: ставить диагнозы, давать медицинские советы, пугать, использовать слова «смерть», «суицид», «болезнь», «порча», «предсказание».

СТРУКТУРА ОТВЕТА:
- Сначала отрази ситуацию человека с теплом и пониманием (1-2 предложения).
- Затем дай ресурсный, позитивный взгляд (2-3 предложения). Скажи, что эта ситуация — урок и точка роста.
- В конце подскажи, на чем можно сфокусироваться, чтобы стать сильнее.

ФОРМАТ: Верни ответ СТРОГО в формате JSON: 
{"answer": "текст ответа (2-4 предложения)", "followups": ["вопрос 1", "вопрос 2", "вопрос 3"]}.

ВОПРОСЫ (followups): Ровно 3 глубоких, бережных вопроса от первого лица, которые помогают заглянуть внутрь себя. Они должны быть направлены на улучшение и рост. Примеры: "Чего я на самом деле боюсь в этой ситуации?", "Какой урок я могу вынести?", "Что я могу сделать, чтобы стать увереннее?". Только валидный JSON без markdown.без markdown.`
          },
          { role: "user", text: question.trim() }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: "Ошибка Яндекса: " + (data.message || JSON.stringify(data)) });
    }

    let text = data.result?.alternatives?.[0]?.message?.text;
    if (!text) return res.status(500).json({ error: "Пустой ответ от Яндекса" });

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(text);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: "Системная ошибка: " + error.message });
  }
}
