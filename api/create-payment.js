import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

// Проверка, что переменные окружения вообще существуют, чтобы не было загадочных 500 ошибок
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export default async function handler(req, res) {
  // CORS (чтобы запросы с вашего домена проходили без ошибок)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, question } = req.body;
    
    // ИСПРАВЛЕНО: убрана лишняя закрывающая скобка
    if (!question || question.trim() === '' || question === 'Вопрос не указан') {
      return res.status(400).json({ error: 'Пожалуйста, напишите ваш вопрос перед оплатой!' });
    }    
    
    // ИСПРАВЛЕНО: добавлен return, чтобы код не шел дальше без суммы
    if (!amount) {
      return res.status(400).json({ error: 'Не указана сумма' });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    
    if (!shopId || !secretKey) {
      return res.status(500).json({ error: 'Не настроены ключи ЮKassa' });
    }

    // Генерируем уникальный ключ идемпотентности
    const idempotenceKey = randomUUID();

    // Создаем платеж в ЮKassa
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        'Authorization': 'Basic ' + Buffer.from(shopId + ':' + secretKey).toString('base64')
      },
      body: JSON.stringify({
        amount: {
          value: String(amount),
          currency: 'RUB'
        },
        capture: true,
        confirmation: {
          type: 'embedded'
        },
        description: 'Расклад Таро'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Ошибка ЮKassa:', data);
      return res.status(response.status).json({ error: data.description || 'Ошибка ЮKassa' });
    }

    // ВАЖНО: Сохраняем вопрос в Redis, чтобы вебхук мог его достать
    if (question) {
      try {
        await redis.set(`order:${data.id}`, JSON.stringify({
          question: question,
          name: 'Клиент',
          contact: 'Не указано'
        }), { ex: 86400 }); // Храним 24 часа
      } catch (redisError) {
        // Если Redis не настроен (например, URL без https), мы увидим это в логах
        console.error('Ошибка сохранения в Redis:', redisError);
        return res.status(500).json({ error: 'Ошибка базы данных Redis. Проверьте KV_REST_API_URL (должен быть https://)' });
      }
    }

    // Отдаем токен для виджета
    return res.status(200).json({ 
      confirmation_token: data.confirmation.confirmation_token,
      payment_id: data.id 
    });

  } catch (error) {
    console.error('Критическая ошибка создания платежа:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
  }
}
