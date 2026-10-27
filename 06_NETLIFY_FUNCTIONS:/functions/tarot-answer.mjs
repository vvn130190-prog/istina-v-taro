export default async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Используй POST-запрос." }),
      { status: 405, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  try {
    const { question } = await request.json();

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Пожалуйста, опиши свою ситуацию подробнее." }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const apiKey = Netlify.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      throw new Error("Не настроен ключ OpenAI.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: `Ты — бережный помощник проекта «Истина в Таро — Ответы внутри тебя».
Дай короткий, тёплый ответ на ситуацию человека в духе символического толкования Таро.
Не утверждай, что знаешь мысли другого человека или предсказываешь будущее наверняка.
Помоги человеку увидеть возможные чувства, обстоятельства и варианты действий.
Не ставь диагнозов и не давай опасных советов.
Ответь строго в формате JSON с полями:
answer — 2–4 предложения на русском языке;
followups — массив ровно из трёх коротких уточняющих вопросов по ситуации.
Не обещай, что это реальный расклад карт: это предварительный бесплатный ответ.`,
        input: question.trim(),
        max_output_tokens: 350
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return new Response(
        JSON.stringify({ error: "Не удалось подготовить ответ. Попробуй позже." }),
        { status: 502, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const text = data.output
      ?.flatMap(item => item.content || [])
      .find(item => item.type === "output_text")?.text;

    if (!text) {
      throw new Error("Пустой ответ OpenAI.");
    }

    const result = JSON.parse(text);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (error) {
    console.error("Tarot function error:", error);
    return new Response(
      JSON.stringify({ error: "Возникла ошибка. Попробуй ещё раз немного позже." }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
};