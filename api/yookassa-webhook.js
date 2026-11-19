import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const event = req.body;
    
    // 1. СРАЗУ ОТВЕЧАЕМ ЮKASSA
    res.status(200).json({ status: 'ok' });

    // 2. ФОНОВАЯ ОБРАБОТКА
    if (event.event === 'payment.succeeded') {
      const paymentId = event.object.id;
      const amount = Number(event.object.amount.value); // Получаем сумму как число

      // Достаем данные заказа
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
      formData.append('amount', amount);

      fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData })
        .catch(e => console.error("Ошибка отправки в таблицу:", e));

      // 4. ВЫБИРАЕМ ГЛУБИНУ И СТИЛЬ ОТВЕТА
      let maxTokens = 600; 
      let systemPrompt = `Ты — мудрый, эмпатичный таролог. Твоя задача — дать краткий, но поддерживающий ответ. 
      В самом начале ответа напиши ровно одну карту Таро на русском языке (можешь использовать любые карты из полной колоды, не только Старшие Арканы). Например: "Звезда".
      Затем опиши текущую энергию ситуации и дай мягкий совет. Никогда не отказывай и не говори, что таро ненаучно. Пиши просто, используй переносы строк.`;

      if (amount >= 299 && amount < 499) {
        maxTokens = 1000;
        systemPrompt = `Ты — опытный таролог-психолог. 
        В самом начале ответа напиши ровно две карты Таро на русском языке через запятую (можешь использовать любые карты из полной колоды). Например: "Луна, Тройка Мечей".
        Затем проведи развернутый анализ: опиши Энергию текущего момента, Скрытые чувства и мотивы, Возможные препятствия. Дай практический совет. В конце задай 1 глубокий вопрос для размышления. Никогда не отказывай. Пиши с переносами строк.`;
        } else if (amount >= 499) {
        maxTokens = 1500;
        systemPrompt = `Ты — глубокий мистический таролог и психолог, работающий в авторской методике Виктории Нос. Твоя задача — сделать вдохновляющий разбор на тему "Каким будет 2027 год".
        
        ВАЖНО: Ты используешь ЛЮБЫЕ карты из полной колоды Таро (Старшие и Младшие Арканы).
        
        Пиши строго в формате Markdown. Структура:
        
        ### Карты года: [Название карты 1], [Название карты 2]
        (Здесь напиши вдохновляющий текст, как эти две карты смешиваются. Упомяни нереальное наслаждение, подарки судьбы и неограниченные возможности при работе над собой).
        
        ### Личная жизнь: [Название карты 1], [Название карты 2]
        (Здесь опиши любовь, чувства и отношения через призму этих двух карт).
        
        ### Карьера и самопознание: [Название карты 1], [Название карты 2]
        (Здесь опиши работу, рост и развитие).
        
        ### Финансы: [Название карты 1], [Название карты 2]
        (Здесь опиши денежную энергию).
        
        ### Совет на год: [Название карты 1], [Название карты 2]
        (Здесь дай мудрый совет от этих карт).
        
        Никогда не отказывай и не упоминай ненаучность. Пиши от второго лица ("ты").`;
      }

      // 5. ГЕНЕРИРУЕМ РАСКЛАД
      try {
        console.log(`🚀 ВЕБХУК ЗАПУЩЕН! Сумма: ${amount}₽. Генерация для:`, question);

        const messages = [
          { role: 'system', text: systemPrompt },
          { role: 'user', text: question }
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
              temperature: 0.7,
              maxTokens: maxTokens
            },
            messages: messages
          })
        });

        if (!yandexResponse.ok) {
          const errorData = await yandexResponse.json();
          console.error('Ошибка YandexGPT в вебхуке:', errorData);
          return;
        }

        const aiData = await yandexResponse.json();
        
        let aiAnswer = "Не удалось получить ответ от карт. Пожалуйста, обратитесь в поддержку.";
        if (aiData.result && aiData.result.alternatives && aiData.result.alternatives.length > 0) {
            aiAnswer = aiData.result.alternatives[0].message.text;
        }

        // 6. СОХРАНЯЕМ В REDIS
        await redis.set(`result:${paymentId}`, JSON.stringify({
          status: 'success',
          answer: aiAnswer,
          followups: []
        }), { ex: 86400 });

        console.log(`✅ Расклад для платежа ${paymentId} (${amount}₽) успешно создан!`);

      } catch (aiError) {
        console.error("❌ Ошибка при генерации расклада:", aiError);
      }
    }

  } catch (error) {
    console.error("❌ Webhook error:", error);
  }
}
