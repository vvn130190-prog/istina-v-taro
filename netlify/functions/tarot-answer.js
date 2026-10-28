exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Используй POST-запрос." }) };
  }

  try {
    const { question } = JSON.parse(event.body || "{}");
    if (!question || question.trim().length < 3) {
      return { statusCode: 400, body: JSON.stringify({ error: "Опиши ситуацию подробнее." }) };
    }

    const apiKey = "AQVN1BNhHaUvxyETCmPQyr4IuBK4u55AhemgvcpP"; 
    const folderId = "b1gva850tfnbt1pfqu7q";

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
