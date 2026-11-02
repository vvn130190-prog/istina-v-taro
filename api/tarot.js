import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Используй POST-запрос.' });

  try {
    const { question } = req.body;
    if (!question || question.trim().length < 3) {
      return res.status(400).json({ error: 'Опиши ситуацию подробнее.' });
    }

    const apiKey = process.env.YANDEX_API_KEY;
    const folderId = "b1gva850tfnbt1pfqu7q";

    if (!apiKey) throw new Error("Не настроен ключ Yandex.");

    // --- ВЫТЯГИВАЕМ 3 СЛУЧАЙНЫЕ КАРТЫ ---
    const allCards = [
      "Туз Жезлов", "2 Жезлов", "3 Жезлов", "4 Жезлов", "5 Жезлов", "6 Жезлов", "7 Жезлов", "8 Жезлов", "9 Жезлов", "10 Жезлов", "Паж Жезлов", "Рыцарь Жезлов", "Королева Жезлов", "Король Жезлов",
      "Туз Мечей", "2 Мечей", "3 Мечей", "4 Мечей", "5 Мечей", "6 Мечей", "7 Мечей", "8 Мечей", "9 Мечей", "10 Мечей", "Паж Мечей", "Рыцарь Мечей", "Королева Мечей", "Король Мечей",
      "Туз Кубков", "2 Кубков", "3 Кубков", "4 Кубков", "5 Кубков", "6 Кубков", "7 Кубков", "8 Кубков", "9 Кубков", "10 Кубков", "Паж Кубков", "Рыцарь Кубков", "Королева Кубков", "Король Кубков",
      "Туз Пентаклей", "2 Пентаклей", "3 Пентаклей", "4 Пентаклей", "5 Пентаклей", "6 Пентаклей", "7 Пентаклей", "8 Пентаклей", "9 Пентаклей", "10 Пентаклей", "Паж Пентаклей", "Рыцарь Пентаклей", "Королева Пентаклей", "Король Пентаклей",
      "Шут", "Маг", "Верховная Жрица", "Императрица", "Император", "Иерофант", "Влюбленные", "Колесница", "Сила", "Отшельник", "Колесо Фортуны", "Справедливость", "Повешенный", "Смерть", "Умеренность", "Дьявол", "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир"
    ];

    const getRandomCards = (count) => {
      const shuffled = [...allCards].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    const drawnCards = getRandomCards(3);

    // --- ПРОМПТ ДЛЯ ИИ (с картами) ---
    const systemPrompt = `
Ты — мудрая, бережная наставница и добрая подруга проекта «Истина в Таро». 
Твоя главная цель — чтобы человек почувствовал поддержку, доверие и захотел вернуться. Обращайся на «ты».

ГЛАВНЫЕ ПРАВИЛА ТВОЕЙ МЕТОДИКИ:
1. Всё, что происходит в жизни — к лучшему. Любая ситуация делает человека сильнее и мудрее.
2. Человек — вершитель своей судьбы. Карты — это лишь подсказка. Решения принимает только сам человек.
3. СТРОГО ЗАПРЕЩЕНО: ставить диагнозы, давать медицинские советы, пугать, использовать слова «смерть», «болезнь», «горесть», «печаль», «суицид», «порча», «предсказание».

ВАЖНО: В этом раскладе выпали 3 карты. Ты должна истолковать именно их, связав с вопросом клиента.
Выпавшие карты: ${drawnCards.join(', ')}.

СТРУКТУРА ОТВЕТА:
- Напиши, какие 3 карты выпали (например: «В твоем раскладе выпали: ...»).
- Дай трактовку каждой карты (по 1 предложению).
- Свяжи их в общий вывод, отвечая на вопрос клиента.
- Подскажи, на чем можно сфокусироваться.

ФОРМАТ: Верни ответ СТРОГО в формате JSON: 
{"answer": "текст ответа (3-5 предложений)", "followups": ["вопрос 1", "вопрос 2", "вопрос 3"]}.

ВОПРОСЫ (followups): Ровно 3 вопроса. Они должны быть СТРОГО связаны с ситуацией клиента, которую он описал. 
- Если клиент спрашивает про работу/деньги, вопросы должны быть про ресурсы, сроки и действия.
- Если клиент спрашивает про отношения, вопросы должны быть про чувства и страхи.
НЕ ЗАДАВАЙ абстрактные вопросы (типа «Что тебе главное понять?»), если они не связаны с конкретной ситуацией клиента.
Только валидный JSON без markdown.
`;

    const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
      method: "POST",
      headers: {
        "Authorization": `Api-Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/yandexgpt-lite/latest`,
        completionOptions: { stream: false, temperature: 0.8, maxTokens: 600 },
        messages: [
          { role: "system", text: systemPrompt },
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
