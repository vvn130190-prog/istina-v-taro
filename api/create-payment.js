
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

// Допустимые типы раскладов и цены.
// Цена определяется сервером, а не браузером клиента.
const SPREAD_PRICES = {
  single: 99,
  love_year: 99,
  custom_question: 99,
  relationship_8: 499,
  compatibility: 499,
  my_path_pack: 399,
  choices_pack: 399
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      amount,
      question,
      spreadType = 'single'
    } = req.body || {};

    if (
      !question ||
      typeof question !== 'string' ||
      question.trim() === '' ||
      question === 'Вопрос не указан'
    ) {
      return res.status(400).json({
        error: 'Пожалуйста, напишите ваш вопрос перед оплатой!'
      });
    }

    const expectedAmount = SPREAD_PRICES[spreadType];

    if (!expectedAmount) {
      return res.status(400).json({
        error: 'Неизвестный тип расклада'
      });
    }

    if (Number(amount) !== expectedAmount) {
      return res.status(400).json({
        error: 'Неверная стоимость расклада'
      });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    if (!shopId || !secretKey) {
      return res.status(500).json({
        error: 'Не настроены ключи ЮKassa'
      });
    }

    if (
      !process.env.KV_REST_API_URL ||
      !process.env.KV_REST_API_TOKEN
    ) {
      return res.status(500).json({
        error: 'Не настроено подключение к Redis'
      });
    }

    const idempotenceKey = randomUUID();

    const response = await fetch(
      'https://api.yookassa.ru/v3/payments',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotenceKey,
          'Authorization':
            'Basic ' +
            Buffer.from(shopId + ':' + secretKey).toString('base64')
        },
        body: JSON.stringify({
          amount: {
            value: expectedAmount.toFixed(2),
            currency: 'RUB'
          },
          capture: true,
          confirmation: {
            type: 'embedded'
          },
          description: 'Расклад Таро — ' + expectedAmount + ' ₽'
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Ошибка ЮKassa:', data);

      return res.status(response.status).json({
        error: data.description || 'Ошибка ЮKassa'
      });
    }

    const orderData = {
      question: question.trim(),
      spreadType,
      amount: expectedAmount,
      name: 'Клиент',
      contact: 'Не указано',
      createdAt: new Date().toISOString()
    };

    try {
      await redis.set(
        `order:${data.id}`,
        JSON.stringify(orderData),
        { ex: 86400 }
      );
    } catch (redisError) {
      console.error('Ошибка сохранения заказа в Redis:', redisError);

      return res.status(500).json({
        error: 'Платёж создан, но не удалось сохранить заказ. Обратитесь в поддержку.'
      });
    }

    return res.status(200).json({
      confirmation_token: data.confirmation.confirmation_token,
      payment_id: data.id
    });

  } catch (error) {
    console.error('Критическая ошибка создания платежа:', error);

    return res.status(500).json({
      error: 'Внутренняя ошибка сервера: ' + error.message
    });
  }
}
