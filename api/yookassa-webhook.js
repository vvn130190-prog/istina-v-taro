
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

const DECK = [
  'Шут', 'Маг', 'Верховная Жрица', 'Императрица', 'Император',
  'Иерофант', 'Влюбленные', 'Колесница', 'Сила', 'Отшельник',
  'Колесо Фортуны', 'Справедливость', 'Повешенный', 'Смерть',
  'Умеренность', 'Дьявол', 'Башня', 'Звезда', 'Луна', 'Солнце',
  'Суд', 'Мир',

  'Туз Кубков', 'Двойка Кубков', 'Тройка Кубков', 'Четверка Кубков',
  'Пятерка Кубков', 'Шестерка Кубков', 'Семерка Кубков',
  'Восьмерка Кубков', 'Девятка Кубков', 'Десятка Кубков',
  'Паж Кубков', 'Рыцарь Кубков', 'Королева Кубков', 'Король Кубков',

  'Туз Пентаклей', 'Двойка Пентаклей', 'Тройка Пентаклей',
  'Четверка Пентаклей', 'Пятерка Пентаклей', 'Шестерка Пентаклей',
  'Семерка Пентаклей', 'Восьмерка Пентаклей', 'Девятка Пентаклей',
  'Десятка Пентаклей', 'Паж Пентаклей', 'Рыцарь Пентаклей',
  'Королева Пентаклей', 'Король Пентаклей',

  'Туз Мечей', 'Двойка Мечей', 'Тройка Мечей', 'Четверка Мечей',
  'Пятерка Мечей', 'Шестерка Мечей', 'Семерка Мечей',
  'Восьмерка Мечей', 'Девятка Мечей', 'Десятка Мечей',
  'Паж Мечей', 'Рыцарь Мечей', 'Королева Мечей', 'Король Мечей',

  'Туз Жезлов', 'Двойка Жезлов', 'Тройка Жезлов', 'Четверка Жезлов',
  'Пятерка Жезлов', 'Шестерка Жезлов', 'Семерка Жезлов',
  'Восьмерка Жезлов', 'Девятка Жезлов', 'Десятка Жезлов',
  'Паж Жезлов', 'Рыцарь Жезлов', 'Королева Жезлов', 'Король Жезлов'
];

function drawCards(positions) {
  const shuffled = [...DECK].sort(() => Math.random() - 0.5);

  return positions.map((position, index) => ({
    position,
    name: shuffled[index]
  }));
}

function reduceToTwentyTwo(value) {
  let number = value;

  while (number > 22) {
    number -= 22;
  }

  return number;
}

function birthDateNumbers(date) {
  const parts = String(date).split('-');

  if (parts.length !== 3) {
    throw new Error('Неверный формат даты рождения.');
  }

  const [year, month, day] = parts;

  if (!year || !month || !day) {
    throw new Error('Неверная дата рождения.');
  }

  const sumDigits = value =>
    String(value).split('').reduce((sum, digit) => sum + Number(digit), 0);

  return {
    day: reduceToTwentyTwo(sumDigits(day)),
    month: reduceToTwentyTwo(sumDigits(month)),
    year: reduceToTwentyTwo(sumDigits(year))
  };
}

function makeReadingInstructions(order, cards) {
  if (order.spreadType === 'relationship_8') {
    return `Сделай расклад «Мысли, чувства и действия» по восьми картам.

Позиции и выпавшие карты:
${cards.map((card, i) => `${i + 1}. ${card.position}: ${card.name}`).join('\n')}

Разбери каждую позицию применительно к вопросу клиента.
Не ограничивайся словарными значениями карт.
Покажи, как карты взаимодействуют и дополняют друг друга.
После разбора дай единый связный вывод о динамике отношений,
возможном направлении развития и практический совет.
Не утверждай, что будущее предопределено. Пиши бережно,
конкретно и обращайся к клиенту на «ты».`;
  }

  if (order.spreadType === 'compatibility') {
    const first = birthDateNumbers(order.birthDate1);
    const second = birthDateNumbers(order.birthDate2);

    return `Сделай разбор совместимости по датам рождения.

Первая дата рождения: ${order.birthDate1}.
Числа первого человека по авторскому расчёту:
день — ${first.day}, месяц — ${first.month}, год — ${first.year}.

Вторая дата рождения: ${order.birthDate2}.
Числа второго человека:
день — ${second.day}, месяц — ${second.month}, год — ${second.year}.

Используй следующие карты как символические подсказки:
${cards.map((card, i) => `${i + 1}. ${card.position}: ${card.name}`).join('\n')}

Раскрой сильные стороны взаимодействия, возможные трудности,
эмоциональную динамику, взаимное влияние и перспективы отношений.
Не выдавай расчёты за научный прогноз. Дай бережный и конкретный совет.`;
  }

  if (order.spreadType === 'my_path_pack' ||
      order.spreadType === 'choices_pack') {
    return `Подготовь пять самостоятельных ответов на пять вопросов клиента.
Для каждого вопроса используй указанную карту.
Не объединяй вопросы в один общий ответ.

${order.questions.map((question, i) =>
  `${i + 1}. Вопрос: ${question}\nКарта: ${cards[i].name}`
).join('\n\n')}

Для каждого вопроса дай конкретный, содержательный ответ,
объясни связь карты с ситуацией и предложи практический совет.
В конце сделай короткое общее заключение по всем пяти вопросам.
Обращайся к клиенту на «ты».`;
  }

  const card = cards[0];

  return `Ответь на вопрос клиента с помощью одной карты Таро.

Вопрос клиента: ${order.question}
Выпавшая карта: ${card.name}

Сначала назови карту, затем дай конкретный ответ применительно
к вопросу клиента. Объясни основную ситуацию, возможные тенденции
и практический совет. Не перечисляй общие значения карты отдельно.
Пиши бережно, ясно и обращайся к клиенту на «ты».`;
}

function getPositions(spreadType) {
  if (spreadType === 'relationship_8') {
    return [
      'Мысли мужчины',
      'Чувства мужчины',
      'Действия мужчины',
      'Мысли женщины',
      'Чувства женщины',
      'Действия женщины',
      'Что происходит между ними сейчас',
      'Куда могут прийти отношения'
    ];
  }

  if (spreadType === 'compatibility') {
    return [
      'Энергия первого человека',
      'Энергия второго человека',
      'Что объединяет',
      'Возможные сложности',
      'Потенциал отношений',
      'Совет для пары'
    ];
  }

  if (spreadType === 'my_path_pack' ||
      spreadType === 'choices_pack') {
    return [
      'Ответ на первый вопрос',
      'Ответ на второй вопрос',
      'Ответ на третий вопрос',
      'Ответ на четвёртый вопрос',
      'Ответ на пятый вопрос'
    ];
  }

  return ['Главная карта ответа'];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;

    if (!event || event.event !== 'payment.succeeded') {
      return res.status(200).json({ status: 'ignored' });
    }

    const paymentId = event.object?.id;

    if (!paymentId) {
      return res.status(400).json({ error: 'Не указан ID платежа.' });
    }

    const existingResult = await redis.get(`result:${paymentId}`);

    if (existingResult) {
      return res.status(200).json({ status: 'already_processed' });
    }

    const orderData = await redis.get(`order:${paymentId}`);

    if (!orderData) {
      console.error('Заказ не найден:', paymentId);
      return res.status(200).json({ status: 'order_not_found' });
    }

    const order = typeof orderData === 'string'
      ? JSON.parse(orderData)
      : orderData;

    const amount = Number(event.object.amount?.value || 0);

    if (amount !== Number(order.amount)) {
      console.error('Сумма платежа не совпадает с заказом:', paymentId);
      return res.status(400).json({ error: 'Сумма платежа не совпадает.' });
    }

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      throw new Error('Не настроены ключи YandexGPT.');
    }

    const positions = getPositions(order.spreadType);
    const cards = drawCards(positions);
    const instructions = makeReadingInstructions(order, cards);

    const GOOGLE_SCRIPT_URL =
      'https://script.google.com/macros/s/AKfycbwhT8r3aoKhvn82qpsdG4UwR9281oCWuyYV7Gdbl-SeZDarqDcnIkduvEhIJ-AZQTq3OA/exec';

    const formData = new URLSearchParams();
    formData.append('name', order.name || 'Клиент');
    formData.append('contact', order.contact || 'Не указано');
    formData.append(
      'question',
      order.questions?.length
        ? order.questions.join('\n')
        : order.question || ''
    );
    formData.append('package', order.spreadType || 'single');
    formData.append('amount', String(amount));

    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: formData
    }).catch(error => {
      console.error('Ошибка отправки в таблицу:', error);
    });

    const yandexResponse = await fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${YANDEX_API_KEY}`
        },
        body: JSON.stringify({
          modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.7,
            maxTokens: order.spreadType === 'relationship_8' ? 3000 : 1800
          },
          messages: [
            {
              role: 'system',
              text: `Ты — опытный таролог, работающий в авторской методике Виктории.
Твоя задача — внимательно анализировать вопрос, позиции и сочетания карт.
Не давай отдельные шаблонные значения карт вместо ответа на ситуацию.
Пиши на русском языке, структурированно, тепло и содержательно.
Не запугивай клиента и не представляй трактовку как неизбежное будущее.`
            },
            {
              role: 'user',
              text: instructions
            }
          ]
        })
      }
    );

    const aiData = await yandexResponse.json();

    if (!yandexResponse.ok) {
      console.error('Ошибка YandexGPT:', aiData);
      throw new Error('Не удалось получить ответ от YandexGPT.');
    }

    const aiAnswer =
      aiData.result?.alternatives?.[0]?.message?.text ||
      'Не удалось получить ответ. Пожалуйста, обратитесь в поддержку.';

    await redis.set(
      `result:${paymentId}`,
      JSON.stringify({
        status: 'success',
        answer: aiAnswer,
        cards,
        spreadType: order.spreadType || 'single',
        followups: []
      }),
      { ex: 86400 }
    );

    console.log('Расклад готов:', paymentId, order.spreadType);

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Ошибка вебхука:', error);
    return res.status(500).json({
      error: 'Ошибка обработки платежа: ' + error.message
    });
  }
}
