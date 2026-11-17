import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const event = req.body;
    
    // 1. СРАЗУ ОТВЕЧАЕМ ЮKASSA, ЧТОБЫ ОНА НЕ ЖДАЛА (предотвращаем таймаут)
    res.status(200).json({ status: 'ok' });

    // 2. ФОНОВАЯ ОБРАБОТКА (после ответа)
    if (event.event === 'payment.succeeded') {
      const paymentId = event.object.id;

      // Достаем данные заказа из базы
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

      // 3. ОТПРАВЛЯЕМ ДАННЫЕ В GOOGLE-ТАБЛИЦУ (в фоне)
      const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhT8r3aoKhvn82qpsdG4UwR9281oCWuyYV7Gdbl-SeZDarqDcnIkduvEhIJ-AZQTq3OA/exec';
      
      const formData = new URLSearchParams();
      formData.append('name', customerName);
      formData.append('contact', customerContact);
      formData.append('question', question);
      formData.append('package', 'Оплата через ЮKassa');
      formData.append('amount', event.object.amount.value);

      fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData })
        .catch(e => console.error("Ошибка отправки в таблицу:", e));

      // 4. ГЕНЕРИРУЕМ РАСКЛАД ЧЕРЕЗ YANDEXGPT НАПРЯМУЮ
      try {
        const messages = [
          { 
            role: 'system', 
            text: 'Ты — таролог. Отвечай честно, глубоко и по делу. ВАЖНО: Пиши ответ простым текстом. НЕ ИСПОЛЬЗУЙ HTML-теги (такие как <div>, <strong>, <b>, <br>). Для выделения заголовков используй обычный текст и переносы строк.' 
          },
          { 
            role: 'user', 
            text: question 
          }
        ];

        const yandexResponse = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Api-Key ${YANDEX_API_KEY}`
          },
          body: JSON.stringify({
            modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`, 
            completionOptions: {
              stream: false,
              temperature: 0.6,
              maxTokens: 800 // Для платных раскладов даем больше токенов
            },
            messages: messages
          })
        });

        if (!yandexResponse.ok) {
          const errorData = await yandexResponse.json();
          console.error('Ошибка YandexGPT в вебхуке:', errorData);
          return; // Прерываем выполнение, если ИИ не ответил
        }

        const aiData = await yandexResponse.json();
        const aiAnswer = aiData.result.alternatives[0].message.text;

        // 5. СОХРАНЯЕМ ГОТОВЫЙ РАСКЛАД В REDIS (доступен 24 часа)
        await redis.set(`result:${paymentId}`, JSON.stringify({
          status: 'success',
          answer: aiAnswer,
          followups: [] // Здесь можно добавить генерацию уточняющих вопросов, если нужно
        }), { ex: 86400 });

        console.log(`✅ Расклад для платежа ${paymentId} успешно сгенерирован и сохранен!`);

      } catch (aiError) {
        console.error("❌ Ошибка при генерации расклада в вебхуке:", aiError);
      }
    }

  } catch (error) {
    console.error("❌ Webhook error:", error);
    // Ответ уже отправлен выше, поэтому здесь просто логируем
  }
}
