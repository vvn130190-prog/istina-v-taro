
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

const SPREAD_POSITIONS = {
  single: [
    'Главная энергия ситуации',
    'Что важно понять',
    'Совет карт'
  ],

  love_year: [
    'Что происходит в личной жизни сейчас',
    'Какие возможности для встречи любви открываются',
    'К чему может привести этот период'
  ],

  custom_question: [
    'Суть ситуации',
    'Что скрыто или пока не очевидно',
    'Совет и возможное направление развития'
  ],
deeper: [
  'Суть ситуации',
  'Что происходит глубже, чем кажется',
  'Что влияет на ситуацию',
  'Что важно понять',
  'Совет и возможное развитие'
],
  
  relationship_8: [
    'Мысли мужчины',
    'Чувства мужчины',
    'Действия мужчины',
    'Мысли женщины',
    'Чувства женщины',
    'Действия женщины',
    'Что происходит между ними сейчас',
    'Куда могут прийти отношения'
  ],

 compatibility: [
    'Аркан дня рождения пары',
    'Аркан месяца рождения пары',
    'Аркан года рождения пары'
  ]
};

function drawCards(positions) {
  const deck = [...DECK];

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return positions.map((position, index) => ({
    position,
    name: deck[index]
  }));
}
// РАСЧЁТ АРКАНА ПО ДАТЕ РОЖДЕНИЯ
function calculateArcana(number) {
  while (number > 22) {
    number -= 22;
  }
  return number;
}

// АРКАН ЖИЗНЕННОГО КОДА
function calculateLifeCode(birthDate) {
  const digits = birthDate.replace(/\D/g, '');
  const sum = digits.split('').reduce(
    (total, digit) => total + Number(digit), 0
  );

  return calculateArcana(sum);
}

// ТРИ АРКАНА НАВИГАТОРА ПО ЖИЗНИ
function calculateLifeNavigator(birthDate) {
  const [year, month, day] = birthDate.split('-').map(Number);

  const dayArcana = calculateArcana(day);
  const monthArcana = calculateArcana(month);

  const yearSum = String(year).split('').reduce(
    (total, digit) => total + Number(digit), 0
  );

  const yearArcana = calculateArcana(yearSum);

  return [dayArcana, monthArcana, yearArcana];
}
function getPositions(spreadType, questions) {
  if (SPREAD_POSITIONS[spreadType]) {
    return SPREAD_POSITIONS[spreadType];
  }

  if (spreadType === 'my_path_pack' ||
      spreadType === 'choices_pack') {
    return questions.flatMap((question, index) => [
      `Вопрос ${index + 1}: ${question} — первая карта`,
      `Вопрос ${index + 1}: ${question} — вторая карта`,
      `Вопрос ${index + 1}: ${question} — третья карта`
    ]);
  }

  return SPREAD_POSITIONS.single;
}
// СОЗДАНИЕ РАССЧИТАННЫХ КАРТ
function createBirthDateCards(order) {
  let arcanaNumbers;
  let positions;

  if (order.spreadType === 'life_code') {
    arcanaNumbers = [calculateLifeCode(order.birthDate)];
    positions = ['Твой главный Аркан — жизненный код'];
  } else {
    arcanaNumbers = calculateLifeNavigator(order.birthDate);
    positions = [
      'До 18 лет — Аркан дня рождения',
      'От 18 до 36 лет — Аркан месяца рождения',
      'С 36 лет и далее — Аркан года рождения'
    ];
  }

  return arcanaNumbers.map((number, index) => ({
    position: positions[index],
    name: DECK[number - 1]
  }));
}
function makeInstructions(order, cards) {
    if (order.spreadType === 'life_code') {
    return `Ты проводишь авторский разбор жизненного кода человека.

Дата рождения: ${order.birthDate}

Рассчитанный главный Аркан:
${cards[0].name}

Раскрой:
1. Главные качества и особенности личности.
2. Сильные стороны, таланты и природные способности.
3. Возможные слабости и теневые проявления.
4. Главные жизненные уроки.
5. Практические советы, как раскрыть потенциал этого Аркана.

Не используй общие фразы. Дай глубокий, индивидуальный и связный разбор.
В конце сформулируй главный вывод.`;
  }

  if (order.spreadType === 'life_navigator') {
    return `Ты проводишь авторский разбор жизненного пути человека по трём рассчитанным Арканам.

Дата рождения: ${order.birthDate}

Три Аркана и периоды жизни:
${cards.map((c, i) => `${i + 1}. ${c.position}: ${c.name}`).join('\n')}

Для каждого периода раскрой:
1. Главные качества и особенности.
2. Сильные стороны, таланты и ресурсы.
3. Возможные ловушки и теневые проявления.
4. Важные жизненные уроки и практические рекомендации.

Затем свяжи три Аркана между собой.
Покажи, как особенности каждого периода дополняют друг друга.
Заверши единым содержательным выводом о жизненном пути человека.

Пиши тепло, глубоко и конкретно. Не представляй трактовку как неизбежную судьбу.`;
  }
  if (order.spreadType === 'deeper') {
  return `Ты проводишь подробный авторский разбор ситуации клиента по пяти картам.

Вопрос клиента:
${order.question}

Пять карт и их позиции:
${cards.map((c, i) => `${i + 1}. ${c.position}: ${c.name}`).join('\n')}

Разбери все пять карт как единую историю:
1. Раскрой значение каждой карты именно в её позиции и применительно к вопросу клиента.
2. Покажи, как карты влияют друг на друга, где усиливают или противоречат друг другу.
3. Объясни, что клиенту важно понять в этой ситуации.
4. Дай конкретные практические рекомендации.
5. Заверши единым связным выводом и обозначь возможное направление развития, не выдавая его за неизбежное будущее.

Пиши тепло, глубоко и конкретно. Не перечисляй общие словарные значения и не ограничивайся изолированным описанием карт.`;
}
  if (order.spreadType === 'relationship_8') {
    return `Клиентский вопрос:
${order.question}

Выпавшие карты и позиции:
${cards.map((c, i) => `${i + 1}. ${c.position}: ${c.name}`).join('\n')}

Проведи глубокий разбор отношений по всем восьми позициям.
Рассмотри мысли, чувства и действия мужчины и женщины,
затем проанализируй связь между ними и возможное направление отношений.

Не ограничивайся отдельными значениями карт.
Обязательно учитывай сочетания, противоречия и общую картину.
В конце дай единый связный вывод и практический совет.
Не представляй будущее как неизбежное.`;
  }

  if (order.spreadType === 'compatibility') {
    return `Проведи разбор совместимости двух людей по датам рождения.

Первая дата: ${order.birthDate1}
Вторая дата: ${order.birthDate2}

Выпавшие карты:
${cards.map((c, i) => `${i + 1}. ${c.position}: ${c.name}`).join('\n')}

Рассмотри характер взаимодействия, сильные стороны союза,
возможные трудности, эмоциональную близость и перспективы.
Свяжи карты между собой и дай общий вывод и совет.
Не выдавай трактовку за неизбежный прогноз.`;
  }

  if (order.spreadType === 'my_path_pack' ||
      order.spreadType === 'choices_pack') {
    return `Дай пять самостоятельных, подробных ответов на вопросы клиента.
Для каждого вопроса используй строго три соответствующие карты.
Не смешивай карты одного вопроса с другим.

${order.questions.map((question, index) => {
  const questionCards = cards.slice(index * 3, index * 3 + 3);
  return `
ВОПРОС ${index + 1}: ${question}

Карты:
${questionCards.map(c => `${c.position}: ${c.name}`).join('\n')}

Составь единый связный ответ по сочетанию этих трёх карт.
`;
}).join('\n')}

В конце добавь общее заключение по всем пяти вопросам.`;
  }

  return `Вопрос клиента:
${order.question}

Три выпавшие карты:
${cards.map((c, i) => `${i + 1}. ${c.position}: ${c.name}`).join('\n')}

Сделай содержательный авторский разбор.
Рассмотри сочетание всех трёх карт как единую историю,
а не как три независимых словарных значения.
Дай конкретный ответ на вопрос, объясни ситуацию
и предложи практический совет.`;
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
      return res.status(400).json({
        error: 'Сумма платежа не совпадает с заказом.'
      });
    }

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      throw new Error('Не настроены ключи YandexGPT.');
    }

    const isPack =
      order.spreadType === 'my_path_pack' ||
      order.spreadType === 'choices_pack';

    if (isPack &&
        (!Array.isArray(order.questions) ||
         order.questions.length !== 5)) {
      throw new Error('В заказе отсутствуют пять вопросов пакета.');
    }

   const isBirthDateProduct =
  order.spreadType === 'life_code' ||
  order.spreadType === 'life_navigator';

const parsedBirthDate = new Date(
  `${order.birthDate}T00:00:00.000Z`
);

const validBirthDate =
  typeof order.birthDate === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(order.birthDate) &&
  !isNaN(parsedBirthDate.getTime()) &&
  parsedBirthDate.toISOString().slice(0, 10) === order.birthDate &&
  parsedBirthDate <= new Date();

if (isBirthDateProduct && !validBirthDate) {
  throw new Error('Дата рождения отсутствует или указана неверно.');
}
const positions = getPositions(
  order.spreadType || 'single',
  order.questions || []
);

const cards = isBirthDateProduct
  ? createBirthDateCards(order)
  : drawCards(positions);

const instructions = makeInstructions(order, cards);

    const GOOGLE_SCRIPT_URL =
      'https://script.google.com/macros/s/AKfycbwhT8r3aoKhvn82qpsdG4UwR9281oCWuyYV7Gdbl-SeZDarqDcnIkduvEhIJ-AZQTq3OA/exec';

    const formData = new URLSearchParams();
    formData.append('name', order.name || 'Клиент');
    formData.append('contact', order.contact || 'Не указано');
    formData.append(
      'question',
      isPack ? order.questions.join('\n') : order.question || ''
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
            maxTokens: isPack ? 4500 : 3000
          },
          messages: [
            {
              role: 'system',
              text: `Ты — опытный таролог, работающий в авторской методике Виктории.
Ты анализируешь ситуацию клиента через позиции и сочетания карт.
Не перечисляй изолированные значения карт вместо цельного ответа.
Пиши на русском языке, тепло, конкретно и содержательно.
Обращайся к клиенту на «ты».
Не запугивай и не представляй будущее как предопределённое.
В ответе используй только те карты, которые указаны в раскладе.`
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
