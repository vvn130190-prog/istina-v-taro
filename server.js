const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Обертка для API с подробным логированием
const loadApi = async (modulePath, req, res) => {
    console.log(`[API] Получен запрос на ${modulePath}`);
    try {
        let handler = require(modulePath);
        if (handler.default) handler = handler.default;
        
        if (typeof handler === 'function') {
            console.log(`[API] Вызываем обработчик для ${modulePath}...`);
            await handler(req, res);
            console.log(`[API] Обработчик ${modulePath} завершил работу.`);
        } else {
            throw new Error(`Не удалось найти функцию-обработчик в ${modulePath}. Экспорт: ${typeof handler}`);
        }
    } catch (e) {
        // ВЫВОДИМ ПОЛНУЮ ОШИБКУ В ЛОГИ LAYERO
        console.error(`❌ ОШИБКА В ${modulePath}:`, e.message);
        console.error(e.stack); 
        res.status(500).json({ error: 'Ошибка сервера: ' + e.message });
    }
};

app.post('/api/tarot', (req, res) => loadApi('./api/tarot.js', req, res));
app.post('/api/create-payment', (req, res) => loadApi('./api/create-payment.js', req, res));
app.post('/api/yookassa-webhook', (req, res) => loadApi('./api/yookassa-webhook.js', req, res));
app.post('/api/check-payment', (req, res) => loadApi('./api/check-payment.js', req, res)); // <-- ДОБАВЛЕНА СТРОКА

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${port}`);
});
