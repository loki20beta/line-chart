const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public')); // Обслуживаем клиентскую часть из папки public

// Маршрут для получения случайных данных
app.get('/data', (req, res) => {
    const data = generateRandomData();
    res.json({ data });
});

// Функция для генерации случайных данных
function generateRandomData() {
    const result = [];
    const points = 10; // Количество точек на графике
    for (let i = 0; i < points; i++) {
        result.push({
            x: `Point ${i + 1}`,
            value: Math.floor(Math.random() * 200) - 100, // Случайное значение от -100 до 100
        });
    }
    return result;
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});