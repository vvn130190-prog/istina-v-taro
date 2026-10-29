import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Используй POST-запрос.' });

  try {
    const { packageName, amount, customerName, customerContact, customerQuestion } = req.body;

    if (!packageName || !amount) return res.status(400).json({ error: 'Не указан тариф или сумма.' });

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const idempotenceKey = Date.now().toString() + Math.random().toString(36).substring(7);

    if (!shopId || !secretKey) throw new Error("Не настроены ключи ЮKassa.");

    // Создаем платеж
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(shopId + ":" + secretKey).toString('base64'),
        "Idempotence-Key": idempotenceKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: { value: amount, currency: "RUB" },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: "https://istina-v-taro.ru/?payment=success&order=" + idempotenceKey
        },
        description: packageName,
        metadata: { order_id: idempotenceKey }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: "Ошибка ЮKassa: " + (data.description || JSON.stringify(data)) });

    // СОХРАНЯЕМ ЗАКАЗ В БАЗУ ДАННЫХ
    await redis.set(`order:${data.id}`, JSON.stringify({
      question: customerQuestion || "Клиент не оставил вопрос.",
      name: customerName || "",
      contact: customerContact || "",
      packageName: packageName
    }), { ex: 86400 }); // Храним 24 часа

    return res.status(200).json({ confirmation_url: data.confirmation.confirmation_url, order_id: data.id });

  } catch (error) {
    return res.status(500).json({ error: "Системная ошибка: " + error.message });
  }
}
