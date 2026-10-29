export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Используй POST-запрос.' });
  }

  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Не указан номер заказа.' });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    // Запрашиваем статус платежа в ЮKassa
    const response = await fetch(`https://api.yookassa.ru/v3/payments/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": "Basic " + Buffer.from(shopId + ":" + secretKey).toString('base64'),
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: "Ошибка ЮKassa: " + (data.description || JSON.stringify(data)) });
    }

    // Если платеж успешен — генерируем ответ через ИИ
    if (data.status === 'succeeded') {
      const question = data.metadata.customer_question || "Клиент оплатил расклад, но не оставил вопрос.";
      
      const aiResponse = await fetch("https://istina-v-taro2.vercel.app/api/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question })
      });

      const aiData = await aiResponse.json();
      return res.status(200).json({ status: 'success', answer: aiData.answer, followups: aiData.followups });
    } else {
      return res.status(200).json({ status: data.status, error: 'Платеж еще не оплачен.' });
    }

  } catch (error) {
    return res.status(500).json({ error: "Системная ошибка: " + error.message });
  }
}
