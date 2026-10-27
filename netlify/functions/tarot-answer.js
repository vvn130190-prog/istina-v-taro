exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Используй POST-запрос." })
    };
  }

  try {
    const { question } = JSON.parse(event.body || "{}");

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Пожалуйста, опиши свою ситуацию подробнее." })
      };
    }

    const apiKey = process.env.YANDEX_API_KEY;
    const folderId = process.env.YANDEX_FOLDER_ID;

    if (!apiKey || !folderId) {
      throw new Error("Не настроены ключи Yandex.");
    }

    const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
      method: "POST",
      headers: {
        "Authorization": `Api-Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/yandexgpt-lite/latest`,
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens: 400
        },
        messages: [
          {
            role: "system",
            text: `Ты — бережный помощник проекта «Истина в Таро — Ответы внутри тебя».
Дай короткий, тёплый ответ на ситуацию человека в духе символического толкования Таро.
Не утверждай, что знаешь мысли другого человека или предсказываешь будущее наверняка.
Помоги человеку увидеть возможные чувства, обстоятельства и варианты действий.
Не ставь диагнозов и не давай опасных советов.
Ответь строго в формате JSON с полями:
answer — 2–4 предложения на русском языке;
followups — массив ровно из трёх коротких уточняющих вопросов по ситуации.
Не обещай, что это реальный расклад карт: это предварительный бесплатный ответ.
Твой ответ должен быть ТОЛЬКО валидным JSON без markdown-оберток.`
          },
          {
            role: "user",
            text: question.trim()
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("YandexGPT error:", data);
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Не удалось подготовить ответ. Попробуй позже." })
      };
    }

    let text = data.result?.alternatives?.[0]?.message?.text;

    if (!text) {
      throw new Error("Пустой ответ YandexGPT.");
    }

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("Tarot function error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Возникла ошибка. Попробуй ещё раз немного позже." })
    };
  }
};
