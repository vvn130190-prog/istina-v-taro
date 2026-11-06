export default async function handler(req, res) {
  // 1. СНАЧАЛА РАЗРЕШАЕМ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. ОТВЕЧАЕМ НА ПРОВЕРОЧНЫЙ ЗАПРОС БРАУЗЕРА (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. ПРОВЕРЯЕМ, ЧТО ЭТО POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 4. ПОЛУЧАЕМ СУММУ
  const { amount } = req.body || {};

  if (!amount) {
    return res.status(400).json({ error: 'Сумма не получена' });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    return res.status(500).json({ error: 'Платежные ключи не настроены' });
  }

  try {
    // 5. СОЗДАЕМ ПЛАТЕЖ В ЮKASSA
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': Date.now().toString(),
        'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
      },
      body: JSON.stringify({
        amount: {
          value: Number(amount).toFixed(2),
          currency: 'RUB'
        },
        capture: true,
        confirmation: {
          type: 'embedded',
          return_url: 'https://istina-v-taro.ru'
        },
        description: `Расклад Таро. Сумма: ${amount} руб.`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Ошибка ЮKassa:', data);
      return res.status(400).json({ error: data.description || 'Ошибка ЮKassa', details: data });
    }

    return res.status(200).json({ confirmation_token: data.confirmation.confirmation_token });

  } catch (error) {
    console.error('Ошибка сервера:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
