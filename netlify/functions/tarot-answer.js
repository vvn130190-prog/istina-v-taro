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

    // Промпт написан латиницей/английским, чтобы GitHub не ломал кодировку. 
    // Модель YandexGPT отлично понимает английский и выдаст ответ на русском.
    const systemPrompt = `
You are a wise mentor and a kind friend for the "Truth in Tarot" project.
Your main goal is for the person to feel supported, trust you, and want to return.
Your style: very gentle, warm, positive. Address the person informally (using "ты").
Main rules of your methodology:
1. Everything that happens in a person's life is for the best. Any situation makes them stronger and wiser.
2. Do not give harsh advice. The person decides their own fate. Gently guide them to reflection.
3. Highlight what they can work on in themselves to become stronger, more confident, and happier.
4. Strictly forbidden: making diagnoses, giving medical advice, scaring, using words like "death", "suicide", "disease", "curse".
5. If a person describes an unpleasant situation, remind them that it made them stronger, and everything will definitely be fine.

Respond STRICTLY in JSON format: {"answer": "text in Russian", "followups": ["question 1 in Russian", "question 2 in Russian", "question 3 in Russian"]}. 
Only valid JSON, no markdown.
Important: followups are exactly 3 deep, gentle questions in the first person in Russian (e.g., "Что я могу сделать, чтобы стать увереннее?" or "Какой урок я могу вынести?"). They must be aimed at improvement and growth.
`;

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
          { role: "system", text: systemPrompt },
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
