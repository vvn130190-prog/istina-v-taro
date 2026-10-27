exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Используй POST-запрос." }) };
  }

  try {
    const { question } = JSON.parse(event.body || "{}");
    if (!question || question.trim().length < 3) {
      return { statusCode: 400, body: JSON.stringify({ error: "Опиши ситуацию подробнее." }) };
    }

    // Вшиваем ключи прямо в код, чтобы обойти глюк Netlify
    const apiKey = "AQVN...ВСТАВЬ_СЮДА_СВОЙ_КЛЮЧ...";
    const folderId = "b1gva850tfnbt1pfqu7q";

    const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
      method: "POST",
      headers: {
        "Authorization": `Api-Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/yandexgpt-lite/latest`,
        completionOptions: { stream: false, temperature: 0.7, maxTokens: 400 },
        messages: [
          {
            role: "system",
            text: `Ты — бережный помощник проекта «Истина в Таро». Дай короткий, тёплый ответ (2-4 предложения) в духе таро. Не предсказывай будущее наверняка. Ответь строго в формате JSON: {"answer": "текст", "followups": ["вопрос1", "вопрос2", "вопрос3"]}. Только валидный JSON без markdown.`
          },
          { role: "user", text: question.trim() }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Ошибка Яндекса: " + (data.message || JSON.stringify(data)) })
      };
    }

    let text = data.result?.alternatives?.[0]?.message?.text;
    if (!text) return { statusCode: 500, body: JSON.stringify({ error: "Пустой ответ от Яндекса" }) };

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Системная ошибка: " + error.message })
    };
  }
};
