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
