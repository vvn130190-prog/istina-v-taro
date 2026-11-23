
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SPREAD_PRICES = {
  single: 99,
    ai_3: 99,
  ai_5: 299,
  ai_7: 499,
  love_year: 99,
  custom_question: 99,
  deeper: 299,
  relationship_8: 499,
  compatibility: 499,
  my_path_pack: 399,
  choices_pack: 399,
  life_navigator: 599,
  life_code: 199,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Используй POST-запрос.' });
  }

  try {
  const {
    amount,
    question,
    spreadType = 'single',
    questions = [],
    birthDate1,
    birthDate2,
    birthDate
  } = req.body || {};

    const expectedAmount = SPREAD_PRICES[spreadType];

    if (!expectedAmount) {
      return res.status(400).json({ error: 'Неизвестный тип расклада.' });
    }

    if (Number(amount) !== expectedAmount) {
      return res.status(400).json({ error: 'Стоимость расклада не совпадает.' });
    }

    const isPack = spreadType === 'my_path_pack' ||
                   spreadType === 'choices_pack';

    if (isPack) {
      if (!Array.isArray(questions) || questions.length !== 5 ||
          questions.some(q => typeof q !== 'string' || !q.trim())) {
        return res.status(400).json({
          error: 'Для пакета необходимо передать все пять вопросов.'
        });
      }
    } else if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        error: 'Пожалуйста, напишите ваш вопрос перед оплатой!'
      });
    }

    if (spreadType === 'compatibility' && (!birthDate1 || !birthDate2)) {
      return res.status(400).json({
        error: 'Для совместимости укажите даты рождения обоих людей.'
      });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    if (!shopId || !secretKey) {
      return res.status(500).json({ error: 'Не настроены ключи ЮKassa.' });
    }

    const idempotenceKey = randomUUID();

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        'Authorization': 'Basic ' +
          Buffer.from(shopId + ':' + secretKey).toString('base64')
      },
      body: JSON.stringify({
        amount: {
          value: expectedAmount.toFixed(2),
          currency: 'RUB'
        },
        capture: true,
        confirmation: { type: 'embedded' },
        description: 'Расклад Таро — ' + spreadType
      })
    });

    const data = await response.json();

console.log('ЮKassa:', {
  id: data.id,
  status: data.status,
  confirmation_type: data.confirmation?.type,
  token_received: Boolean(data.confirmation?.confirmation_token)
});

if (!response.ok) {
  console.error('Ошибка ЮKassa:', data);
  return res.status(response.status).json({
    error: data.description || 'Ошибка ЮKassa.'
  });
}

    const order = {
      question: question || '',
      questions: isPack ? questions : [],
      spreadType,
      amount: expectedAmount,
      birthDate1: birthDate1 || '',
      birthDate2: birthDate2 || '',
      birthDate: birthDate || '',
      name: 'Клиент',
      contact: 'Не указано',
      createdAt: new Date().toISOString()
    };

    await redis.set(
      `order:${data.id}`,
      JSON.stringify(order),
      { ex: 86400 }
    );

    return res.status(200).json({
      confirmation_token: data.confirmation.confirmation_token,
      payment_id: data.id
    });

  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера: ' + error.message
    });
  }
}
