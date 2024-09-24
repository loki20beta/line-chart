class DataController {
    constructor(containerWidth, url, updateInterval = 5000) {
        this.data = [];
        this.url = url || ''; // URL источника данных
        this.containerWidth = containerWidth; // Ширина контейнера для расчета stepX
        this.updateInterval = updateInterval; // Интервал обновления в миллисекундах
        this.intervalId = null; // ID для setInterval
    }

    setUrl(url) {
        this.url = url;
    }

    // Преобразование данных для графика
    prepareData() {
        const filteredData = this.data.map(d => ({
            x: d.x,
            value: Number(d.value)
        })).filter(d => !isNaN(d.value));

        if (filteredData.length === 0) {
            console.error("No valid data points found.");
            return {
                data: [],
                maxValue: 0,
                minValue: 0,
                stepX: 0
            };
        }

        const values = filteredData.map(d => d.value);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);

        // Получаем ширину контейнера
        const containerWidth = this.containerWidth;
        // console.log("Container width:", containerWidth); // Для проверки

        // Расчет шага X в зависимости от количества данных и ширины контейнера
        const stepX = (containerWidth - 100) / (filteredData.length - 1); // Ширина контейнера минус отступы
        // console.log("Calculated stepX:", stepX); // Для проверки

        return {
            data: filteredData,
            maxValue,
            minValue,
            stepX
        };
    }

    // Метод для получения данных с сервера
    async fetchData() {
        try {
            const response = await fetch(this.url);
            const result = await response.json();
            this.data = result.data; // Сохраняем полученные данные
            return this.prepareData(); // Возвращаем обработанные данные
        } catch (error) {
            console.error("Error fetching data: ", error);
            return [];
        }
    }

    startPolling(onDataUpdate) {
        this.intervalId = setInterval(async () => {
            const rawData = await this.fetchData(); // Загружаем сырые данные с сервера

            // Присваиваем сырые данные для обработки
            this.rawData = rawData;

            // Обрабатываем данные
            const newProcessedData = this.prepareData();

            // Проверка: если processedData еще не инициализирован, не выполняем сравнение
            if (!this.processedData) {
                console.log("First run, initializing data");
                this.processedData = newProcessedData.data;

                // Сразу вызываем коллбэк для обновления графика при первом запуске
                if (typeof onDataUpdate === 'function') {
                    onDataUpdate(newProcessedData);
                }
            } else {
                // Сравниваем обработанные новые данные с текущими обработанными данными
                if (!deepCompareArrays(newProcessedData.data, this.processedData)) {
                    console.log("Data has changed", newProcessedData.data, this.processedData);

                    // Обновляем обработанные данные в this.processedData
                    this.processedData = newProcessedData.data;

                    // Вызываем коллбэк для обновления графика
                    if (typeof onDataUpdate === 'function') {
                        onDataUpdate(newProcessedData);
                    }
                } else {
                    console.log("Data has not changed, skipping redraw");
                }
            }
        }, this.updateInterval);
    }

    // Остановка опроса
    stopPolling() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

class ChartController {
    constructor(container) {
        this.container = container;
    }

    drawChart(data) {
        // Очищаем контейнер перед отрисовкой
        this.container.innerHTML = '';

        // Создаем SVG элемент
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%");

        // Динамически получаем высоту контейнера и применяем её к SVG
        const width = this.container.clientWidth;
        const height = this.container.clientHeight; // Используем clientHeight для динамической высоты
        svg.setAttribute("height", height);

        // Перерисовка графика с учетом новой ширины и высоты
        this.container.innerHTML = ''; // Очищаем контейнер перед отрисовкой
        this.drawLabels(svg, data, width, height); // Отрисовка осей
        this.drawLines(svg, data, width, height); // Отрисовка линий графика
        this.container.appendChild(svg);

        // Отрисовка осей и подписей
        this.drawLabels(svg, data, width, height);

        // Отрисовка линий графика
        this.drawLines(svg, data, width, height);

        this.container.appendChild(svg);
    }


drawLabels(svg, data, width, height) {
    // Используем округленные значения для оси Y
    const { start, end, step } = calculateYRange(data.minValue, data.maxValue);

    const stepsCount = Math.floor((end - start) / step) + 1;
    const stepY = (height - 100) / (stepsCount - 1); // Равномерно распределяем шаги

    // Подписи по Y и сетка
    for (let i = 0; i < stepsCount; i++) {
        const labelValue = start + i * step;
        const y = height - 50 - i * stepY; // Координата Y для подписи

        // Добавляем подпись
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", "20");
        text.setAttribute("y", y);
        text.setAttribute("fill", "#000");
        text.textContent = Math.round(labelValue); // Округляем значения
        svg.appendChild(text);

        // Добавляем пунктирную сетку для оси Y
        const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        gridLine.setAttribute("x1", "50");
        gridLine.setAttribute("y1", y);
        gridLine.setAttribute("x2", width - 50); // Линия по ширине графика
        gridLine.setAttribute("y2", y);
        gridLine.setAttribute("stroke", "#e0e0e0"); // Цвет сетки
        gridLine.setAttribute("stroke-dasharray", "5,5"); // Пунктирная линия
        svg.appendChild(gridLine);
    }

    // Подписи по X остаются без изменений
    
    data.data.forEach((d, index) => {
        const xPosition = 50 + index * data.stepX;
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", xPosition);
        text.setAttribute("y", height - 30);
        text.setAttribute("fill", "#000");
        text.textContent = d.x;

        if (data.data.length > 8) {
            text.setAttribute("transform", `rotate(45, ${xPosition}, ${height - 30})`);
        }

        svg.appendChild(text);
    });
}


drawLines(svg, data, width, height) {
    // Используем округленные значения для оси Y
    const { start: roundedMin, end: roundedMax } = calculateYRange(data.minValue, data.maxValue);

    const stepX = data.stepX;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    let points = '';

    // Масштабируем данные по Y относительно округленного диапазона
    data.data.forEach((d, index) => {
        const x = 50 + index * stepX;

        // Масштабируем значение для оси Y на основе округленного диапазона (roundedMin, roundedMax)
        const y = height - 50 - ((d.value - roundedMin) / (roundedMax - roundedMin)) * (height - 100);
        points += `${x},${y} `;

        // Добавляем круг для точки
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 4);
        circle.setAttribute("fill", "#007bff");
        circle.setAttribute("class", "data-point");
        circle.setAttribute("data-value", d.value);
        svg.appendChild(circle);
    });

    line.setAttribute("points", points.trim());
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#007bff");
    line.setAttribute("stroke-width", "2");

    svg.appendChild(line);
}

}


let dataController;
let chartController;

document.addEventListener('DOMContentLoaded', function() {

    const chartContainer = document.getElementById('chart');
    chartController = new ChartController(chartContainer);

    const url = 'https://cors-anywhere.herokuapp.com/' + document.getElementById('data-url').value;
    dataController = new DataController(chartContainer.clientWidth, url, 5000); // Опрос каждые 5 секунд

    // Сначала выполняем запрос данных сразу после загрузки страницы
    dataController.fetchData().then((preparedData) => {
        // Отрисовываем график сразу с полученными данными
        chartController.drawChart(preparedData);

        // Затем начинаем периодический опрос данных
        dataController.startPolling((newData) => {
            chartController.drawChart(newData);
        });
    }).catch(error => {
        console.error("Error during initial data fetch:", error);
    });

    // Добавляем слушатель изменения размера окна
    window.addEventListener('resize', () => {
        const newWidth = chartContainer.clientWidth;

        // Обновляем ширину контейнера в DataController
        dataController.containerWidth = newWidth;

        // Пересчитываем данные и перерисовываем график
        const preparedData = dataController.prepareData();
        chartController.drawChart(preparedData);
    });    

    // Обработчик для кнопки "Update Data"
    document.getElementById('update-btn').addEventListener('click', async () => {
        // Получаем выбранный источник данных
        const dataSource = document.getElementById('data-source').value;
        let url;

        if (dataSource === 'anychart') {
            url = 'http://static.anychart.com/cdn/anydata/common/11.json'; // Оригинальный AnyChart URL
        } else {
            url = '/data'; // Локальный URL, например, /data
        }

        // Получаем частоту обновления из поля ввода
        const updateInterval = parseInt(document.getElementById('update-interval').value, 10) * 1000; // Переводим секунды в миллисекунды

        // Если контроллер данных уже существует, останавливаем его
        if (dataController) {
            dataController.stopPolling();
        }

        // Создаем новый DataController с обновленными параметрами
        dataController = new DataController(chartContainer.clientWidth, url, updateInterval);

        try {
            // Выполняем первый запрос данных сразу
            const preparedData = await dataController.fetchData();
            chartController.drawChart(preparedData);

            // Запускаем периодический опрос данных
            dataController.startPolling((newData) => {
                chartController.drawChart(newData);
            });
        } catch (error) {
            console.error("Error during data fetch:", error);
        }
    });


    // Находим контейнер для подсказки
    const tooltip = document.getElementById('tooltip');

    // Добавляем событие наведения для точек
    document.addEventListener('mouseover', function(event) {
        if (event.target.classList.contains('data-point')) {
            const value = event.target.getAttribute('data-value');
            tooltip.style.display = 'block';
            tooltip.textContent = `Value: ${value}`;
            tooltip.style.left = `${event.pageX + 10}px`; // Позиция рядом с курсором
            tooltip.style.top = `${event.pageY - 10}px`;
        }
    });

    document.addEventListener('mouseout', function(event) {
        if (event.target.classList.contains('data-point')) {
            tooltip.style.display = 'none';
        }
    });
});

// Функция для округления и расчета диапазона с шагами
function calculateYRange(minValue, maxValue) {
    const range = maxValue - minValue;

    // Выбираем шаг для оси Y в зависимости от диапазона
    let step;
    if (range <= 50) {
        step = 10;
    } else if (range <= 100) {
        step = 25;
    } else {
        step = 50; // Можно также варьировать шаг в зависимости от диапазона
    }

    // Убедимся, что 0 включен в диапазон
    const roundedMin = Math.floor(minValue / step) * step;
    const roundedMax = Math.ceil(maxValue / step) * step;

    // Если 0 находится между минимальным и максимальным значениями, включаем его
    let start = 0;
    let end = roundedMax;

    if (minValue < 0) {
        start = Math.floor(minValue / step) * step; // округляем вниз до кратного числа
    }

    return { start, end, step };
}

function deepCompareArrays(arr1, arr2) {
    // Проверяем, что оба аргумента массивы
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
        console.error("One or both arguments are not arrays:", arr1, arr2);
        return false;
    }

    if (arr1.length !== arr2.length) return false;
    
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i].x !== arr2[i].x || arr1[i].value !== arr2[i].value) {
            return false;
        }
    }
    return true;
}

