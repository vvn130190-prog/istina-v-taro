const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Подключаем JSON для API
app.use(express.json());

// 1. Раздаем статические файлы (HTML, CSS, картинки)
app.use(express.static(__dirname));

// 2. Универсальная обертка для ваших API
// Она будет пытаться загрузить файл и вызвать его, даже если экспорт немного отличается
const loadApi = async (modulePath, req, res) => {
    try {
        let handler = require(modulePath);
        // Если экспорт в виде { default: fn }
        if (handler.default) handler = handler.default;
        // Если экспорт в виде { handler: fn }
        if (handler.handler) handler = handler.handler;
        
        if (typeof handler === 'function') {
            await handler(req, res);
        } else {
            throw new Error('Не удалось найти функцию-обработчик в ' + modulePath);
        }
    } catch (e) {
        console.error('Ошибка в API ' + modulePath + ':', e);
        res.status(500).json({ error: 'Ошибка сервера: ' + e.message });
    }
};

// 3. Роуты для API
app.post('/api/tarot', (req, res) => loadApi('./api/tarot.js', req, res));
app.post('/api/create-payment', (req, res) => loadApi('./api/create-payment.js', req, res));
app.post('/api/yookassa-webhook', (req, res) => loadApi('./api/yookassa-webhook.js', req, res));

// 4. Все остальные запросы отдаем index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запускаем сервер
app.listen(port, '0.0.0.0', () => {
    console.log(`Сервер успешно запущен на порту ${port}`);
});
