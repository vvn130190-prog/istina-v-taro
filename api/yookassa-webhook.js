import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const event = req.body;
    
    // СРАЗУ отвечаем ЮKassa, что получили сигнал (чтобы она не ждала)
    res.status(200).json({ status: 'ok' });

    // Дальше идет фоновая обработка (уже после ответа)
    if (event.event === 'payment.succeeded') {
      const paymentId = event.object.id;

      // Достаем данные из базы
      const orderData = await redis.get(`order:${paymentId}`);
      
      let question = "Клиент оплатил расклад, но вопрос не найден.";
      let customerName = "Не указано";
      let customerContact = "Не указано";
      
      if (orderData) {
        let parsedData = orderData;
        if (typeof orderData === 'string') {
          try { parsedData = JSON.parse(orderData); } catch (e) { console.error("Ошибка парсинга:", e); }
        }
        if (parsedData && typeof parsedData === 'object') {
          question = parsedData.question || question;
          customerName = parsedData.name || customerName;
          customerContact = parsedData.contact || customerContact;
        }
      }

      // 1. ОТПРАВЛЯЕМ ДАННЫЕ В GOOGLE-ТАБЛИЦУ (в фоне)
      const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhT8r3aoKhvn82qpsdG4UwR9281oCWuyYV7Gdbl-SeZDarqDcnIkduvEhIJ-AZQTq3OA/exec';
      
      const formData = new URLSearchParams();
      formData.append('name', customerName);
      formData.append('contact', customerContact);
      formData.append('question', question);
      formData.append('package', 'Оплата через ЮKassa');
      formData.append('amount', event.object.amount.value);

      fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData })
        .catch(e => console.error("Ошибка таблицы:", e));

      // 2. ГЕНЕРИРУЕМ РАСКЛАД ЧЕРЕЗ ИИ (напрямую, без запроса к своему же серверу)
      // Вместо fetch на /api/tarot, мы делаем запрос к YandexGPT напрямую
      // ВАЖНО: Здесь нужно использовать ваши ключи Yandex Cloud
      
      try {
        // ВАМ НУЖНО ВСТАВИТЬ СЮДА ЛОГИКУ ВЫЗОВА YANDEXGPT
        // (она у вас есть в файле api/tarot.js, скопируйте ее сюда)
        // Пока я напишу заглушку, чтобы вы поняли принцип:
        
        // const aiAnswer = await callYandexGPT(question); 
        // const followups = await generateFollowups(question);
        
        // ВРЕМЕННАЯ ЗАГЛУШКА (вместо реального ИИ):
        const aiAnswer = "Расклад для " + customerName + ": " + question + " (здесь будет ответ ИИ)";
        const followups = ["Вопрос 1", "Вопрос 2", "Вопрос 3"];

        // 3. СОХРАНЯЕМ РАСКЛАД В БАЗУ
        await redis.set(`result:${paymentId}`, JSON.stringify({
          status: 'success',
          answer: aiAnswer,
          followups: followups
        }), { ex: 86400 });
        
        console.log(`Расклад для ${paymentId} успешно сохранен!`);
        
      } catch (aiError) {
        console.error("Ошибка генерации ИИ:", aiError);
      }
    }

  } catch (error) {
    console.error("Webhook error:", error);
  }
}
