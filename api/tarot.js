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
            text: `Ты — бережный наставник проекта «Истина в Таро». Твоя задача — дать короткий (2-4 предложения), теплый, позитивный ответ, который направляет человека на размышления о себе. Не предсказывай будущее, не давай жестких советов, не ставь диагнозы. В конце задай 3 глубоких вопроса для саморефлексии. Ответ верни строго в формате JSON: {"answer": "текст", "followups": ["вопрос1", "вопрос2", "вопрос3"]}. Только валидный JSON без markdown.`
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
