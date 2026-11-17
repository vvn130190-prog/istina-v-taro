
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

export default async function handler(req, res) {
  // Настройки CORS
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
    const event = req.body;

    // Обрабатываем только успешную оплату
    if (event.event === 'payment.succeeded') {
      const paymentId = event.object.id;

      console.log('Получено уведомление об оплате:', paymentId);

      // Получаем данные заказа из Redis
      const orderData = await redis.get(`order:${paymentId}`);

      let question = 'Клиент оплатил расклад, но вопрос не найден.';
      let customerName = 'Не указано';
      let customerContact = 'Не указано';

      if (orderData) {
        let parsedData = orderData;

        if (typeof orderData === 'string') {
          try {
            parsedData = JSON.parse(orderData);
          } catch (e) {
            console.error('Ошибка парсинга заказа:', e);
          }
        }

        if (parsedData && typeof parsedData === 'object') {
          question = parsedData.question || question;
          customerName = parsedData.name || customerName;
          customerContact = parsedData.contact || customerContact;
        }
      }

      // Отправляем информацию в Google-таблицу
      const GOOGLE_SCRIPT_URL =
        'https://script.google.com/macros/s/AKfycbwhT8r3aoKhvn82qpsdG4UwR9281oCWuyYV7Gdbl-SeZDarqDcnIkduvEhIJ-AZQTq3OA/exec';

      const formData = new URLSearchParams();
      formData.append('name', customerName);
      formData.append('contact', customerContact);
      formData.append('question', question);
      formData.append('package', 'Оплата через ЮKassa');
      formData.append('amount', event.object.amount.value);

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: formData
      }).catch(e => {
        console.error('Ошибка отправки в Google-таблицу:', e);
      });

      // Проверяем настройки YandexGPT
      if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
        console.error('Не настроены ключи YandexGPT');
        return res.status(500).json({
          error: 'Не настроены ключи YandexGPT'
        });
      }

      // Генерируем расклад через YandexGPT
      try {
        console.log('Начинаю генерацию расклада для:', question);

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
                temperature: 0.6,
                maxTokens: 800
              },
              messages: messages
            })
          }
        );

        if (!yandexResponse.ok) {
          const errorData = await yandexResponse.json();
          console.error('Ошибка YandexGPT в вебхуке:', errorData);

          return res.status(502).json({
            error: 'Ошибка генерации расклада'
          });
        }

        const aiData = await yandexResponse.json();
        const aiAnswer = aiData.result.alternatives[0].message.text;

        if (!aiAnswer) {
          throw new Error('YandexGPT вернул пустой ответ');
        }

        // Сохраняем готовый расклад в Redis на 24 часа
        await redis.set(
          `result:${paymentId}`,
          JSON.stringify({
            status: 'success',
            answer: aiAnswer,
            followups: []
          }),
          { ex: 86400 }
        );

        console.log(
          `Расклад для платежа ${paymentId} успешно создан и сохранён!`
        );

      } catch (aiError) {
        console.error(
          'Ошибка при генерации расклада в вебхуке:',
          aiError
        );

        return res.status(502).json({
          error: 'Не удалось сгенерировать расклад'
        });
      }
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook error:', error);

    return res.status(500).json({
      error: 'Ошибка обработки уведомления'
    });
  }
}
