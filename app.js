// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#1a1b1e');
tg.setBackgroundColor('#1a1b1e');

// Состояние приложения
const state = {
    volume: 0,
    speed: 1,
    startTime: 0,
    endTime: 0,
    sampleRate: 'original',
    channels: 'original',
    bitDepth: 'original',
    format: 'mp3',
    bitrate: '128k',
    fileInfo: null,
    fileId: null
};

// Получаем данные из URL (от бота)
function getFileDataFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const startParam = urlParams.get('start_param');
        
        if (startParam) {
            const fileData = JSON.parse(decodeURIComponent(startParam));
            console.log('Получены данные файла:', fileData);
            return fileData;
        }
    } catch (e) {
        console.error('Ошибка парсинга данных:', e);
    }
    return null;
}

// Загрузка данных при запуске
const fileData = getFileDataFromUrl();
if (fileData) {
    state.fileInfo = fileData;
    state.fileId = fileData.file_id;
    state.endTime = fileData.duration * 1000; // конвертируем в миллисекунды
    updateFileInfo(fileData);
} else {
    showNoFileMessage();
}

// Показать сообщение, если файл не выбран
function showNoFileMessage() {
    document.getElementById('fileName').textContent = 'Файл не выбран';
    document.getElementById('fileDuration').textContent = '0:00';
    document.getElementById('fileSize').textContent = '0 KB';
    
    const fileCard = document.querySelector('.file-info-card');
    const existingBtn = fileCard.querySelector('.file-select-btn');
    if (!existingBtn) {
        fileCard.innerHTML += `
            <div style="text-align: center; margin-top: 10px;" class="file-select-btn">
                <button onclick="sendToBot()" class="preset-btn" style="background: var(--accent); padding: 12px 20px;">
                    📁 Отправить файл в бота
                </button>
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                    1. Напишите боту @your_bot_name<br>
                    2. Отправьте аудиофайл<br>
                    3. Нажмите кнопку "Открыть студию"
                </p>
            </div>
        `;
    }
}

// Функция для отправки в бота
window.sendToBot = () => {
    tg.close(); // Закрываем мини-приложение
    // Пользователь вернётся в чат с ботом
};

// Обновление информации о файле
function updateFileInfo(fileData) {
    document.getElementById('fileName').textContent = fileData.name || 'audio_file.mp3';
    
    const duration = fileData.duration || 0;
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    document.getElementById('fileDuration').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    const size = fileData.size || 0;
    document.getElementById('fileSize').textContent = `${size} MB`;
    
    // Обновляем время окончания
    document.getElementById('endTime').value = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Убираем кнопку выбора файла, если она была
    const fileCard = document.querySelector('.file-info-card');
    const oldBtn = fileCard.querySelector('.file-select-btn');
    if (oldBtn) oldBtn.remove();
    
    // Добавляем информацию о каналах и частоте
    const fileMeta = document.querySelector('.file-meta');
    if (fileMeta) {
        fileMeta.innerHTML = `
            <span>${mins}:${secs.toString().padStart(2, '0')}</span>
            <span>${fileData.size} MB</span>
            <span>${fileData.channels === 2 ? '🎧 Стерео' : '🎤 Моно'}</span>
            <span>${fileData.sample_rate} Гц</span>
        `;
    }
    
    // Рисуем waveform
    drawWaveform();
}

// Управление вкладками
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
    });
});

// Громкость
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

volumeSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    volumeValue.textContent = `${value > 0 ? '+' : ''}${value} dB`;
    state.volume = parseInt(value);
});

window.setVolume = (value) => {
    volumeSlider.value = value;
    volumeSlider.dispatchEvent(new Event('input'));
};

// Скорость
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

speedSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value).toFixed(1);
    speedValue.textContent = `${value}x`;
    state.speed = parseFloat(value);
});

window.setSpeed = (value) => {
    speedSlider.value = value;
    speedSlider.dispatchEvent(new Event('input'));
};

// Обрезка
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');

function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return parseInt(parts[0]);
}

function secondsToTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

startTimeInput.addEventListener('change', (e) => {
    const seconds = timeToSeconds(e.target.value);
    state.startTime = seconds * 1000;
    if (state.startTime > state.endTime) {
        state.startTime = state.endTime - 1000;
        e.target.value = secondsToTime((state.endTime - 1000) / 1000);
    }
    drawWaveform();
});

endTimeInput.addEventListener('change', (e) => {
    const seconds = timeToSeconds(e.target.value);
    state.endTime = seconds * 1000;
    if (state.endTime < state.startTime) {
        state.endTime = state.startTime + 1000;
        e.target.value = secondsToTime((state.startTime + 1000) / 1000);
    }
    drawWaveform();
});

// Формат
window.setFormat = (format) => {
    document.querySelectorAll('.format-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.format = format;
    
    const mp3Quality = document.getElementById('mp3Quality');
    if (mp3Quality) {
        mp3Quality.style.display = format === 'mp3' ? 'block' : 'none';
    }
};

// Частота дискретизации
const sampleRateSelect = document.getElementById('sampleRate');
if (sampleRateSelect) {
    sampleRateSelect.addEventListener('change', (e) => {
        state.sampleRate = e.target.value;
    });
}

// Каналы
window.setChannels = (mode) => {
    document.querySelectorAll('.channel-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.channels = mode;
};

// Битность
window.setBitDepth = (depth) => {
    document.querySelectorAll('.depth-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.bitDepth = depth;
};

// Битрейт
window.setBitrate = (bitrate) => {
    document.querySelectorAll('.quality-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.bitrate = bitrate;
};

// Применить эффекты
window.applyEffects = () => {
    if (!state.fileId) {
        tg.showPopup({
            title: '❌ Нет файла',
            message: 'Сначала отправьте аудиофайл в бота',
            buttons: [{ type: 'close' }]
        });
        return;
    }
    
    const applyBtn = document.querySelector('.apply-btn');
    applyBtn.classList.add('processing');
    applyBtn.textContent = '⏳ Обработка...';
    
    // Отправляем данные в бот
    tg.sendData(JSON.stringify({
        action: 'apply_effects',
        file_id: state.fileId,
        effects: {
            volume: state.volume,
            speed: state.speed,
            cut: {
                start: state.startTime,
                end: state.endTime
            },
            sample_rate: state.sampleRate
        }
    }));
    
    setTimeout(() => {
        applyBtn.classList.remove('processing');
        applyBtn.textContent = '✅ Эффекты применены';
        
        setTimeout(() => {
            applyBtn.textContent = 'Применить эффекты';
        }, 2000);
        
        tg.showPopup({
            title: '✅ Готово!',
            message: 'Эффекты применены! Перейдите на вкладку "Экспорт" для сохранения.',
            buttons: [{ type: 'close' }]
        });
        
        document.querySelector('[data-tab="export"]').click();
    }, 1500);
};

// Экспорт аудио
window.exportAudio = () => {
    if (!state.fileId) {
        tg.showPopup({
            title: '❌ Нет файла',
            message: 'Сначала отправьте аудиофайл в бота',
            buttons: [{ type: 'close' }]
        });
        return;
    }
    
    const exportBtn = document.querySelector('.export-btn');
    exportBtn.classList.add('processing');
    exportBtn.innerHTML = '<span>⏳ Обработка...</span>';
    
    tg.sendData(JSON.stringify({
        action: 'export_audio',
        file_id: state.fileId,
        settings: {
            format: state.format,
            bitrate: state.bitrate,
            channels: state.channels,
            bit_depth: state.bitDepth,
            sample_rate: state.sampleRate,
            volume: state.volume,
            speed: state.speed,
            cut: {
                start: state.startTime,
                end: state.endTime
            }
        }
    }));
    
    setTimeout(() => {
        exportBtn.classList.remove('processing');
        exportBtn.innerHTML = '<span>✅ Отправлено!</span>';
        
        setTimeout(() => {
            exportBtn.innerHTML = '<span>🎵 Обработать и отправить</span>';
        }, 2000);
        
        tg.showPopup({
            title: '✅ Успешно!',
            message: 'Аудио обработано и отправлено в чат!',
            buttons: [{ type: 'close' }]
        });
        
        setTimeout(() => tg.close(), 3000);
    }, 2000);
};

// Сброс эффектов
window.resetEffects = () => {
    setVolume(0);
    setSpeed(1);
    
    if (state.fileInfo) {
        const duration = state.fileInfo.duration || 0;
        state.startTime = 0;
        state.endTime = duration * 1000;
        startTimeInput.value = '0:00';
        endTimeInput.value = secondsToTime(duration);
    }
    
    state.sampleRate = 'original';
    if (sampleRateSelect) sampleRateSelect.value = 'original';
    
    setChannels('original');
    setBitDepth('original');
    setFormat('mp3');
    setBitrate('128k');
    
    document.querySelectorAll('.channel-btn, .depth-btn, .format-btn, .quality-btn')
        .forEach(btn => btn.classList.remove('active'));
    
    const originalChannels = document.querySelector('[onclick="setChannels(\'original\')"]');
    const originalDepth = document.querySelector('[onclick="setBitDepth(\'original\')"]');
    const mp3Format = document.querySelector('[onclick="setFormat(\'mp3\')"]');
    const bitrate128 = document.querySelector('[onclick="setBitrate(\'128k\')"]');
    
    if (originalChannels) originalChannels.classList.add('active');
    if (originalDepth) originalDepth.classList.add('active');
    if (mp3Format) mp3Format.classList.add('active');
    if (bitrate128) bitrate128.classList.add('active');
    
    drawWaveform();
    
    tg.showPopup({
        title: '🔄 Сброс',
        message: 'Все настройки сброшены',
        buttons: [{ type: 'close' }]
    });
};

// Рисование waveform
function drawWaveform() {
    const canvas = document.getElementById('waveform');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barCount = 50;
    const barWidth = 4;
    const barSpacing = 2;
    const totalWidth = barCount * (barWidth + barSpacing);
    const startX = (canvas.width - totalWidth) / 2;
    
    for (let i = 0; i < barCount; i++) {
        let height;
        if (i < 10) height = 20 + Math.sin(i) * 15;
        else if (i < 20) height = 35 + Math.cos(i) * 20;
        else if (i < 30) height = 45 + Math.sin(i/2) * 25;
        else if (i < 40) height = 30 + Math.cos(i/3) * 20;
        else height = 15 + Math.sin(i/2) * 10;
        
        height += Math.random() * 10;
        
        const gradient = ctx.createLinearGradient(0, canvas.height - height, 0, canvas.height);
        gradient.addColorStop(0, '#8774e1');
        gradient.addColorStop(1, '#b8a9ff');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(
            startX + i * (barWidth + barSpacing),
            canvas.height - height,
            barWidth,
            height
        );
    }
    
    // Добавляем маркеры обрезки
    if (state.fileInfo && state.endTime > 0) {
        const totalDuration = state.fileInfo.duration * 1000;
        const startPercent = (state.startTime / totalDuration) * 100;
        const endPercent = (state.endTime / totalDuration) * 100;
        
        const container = document.querySelector('.waveform-container');
        if (!container) return;
        
        // Удаляем старые маркеры
        const oldMarkers = container.querySelectorAll('.cut-marker');
        oldMarkers.forEach(m => m.remove());
        
        // Левый маркер
        const leftMarker = document.createElement('div');
        leftMarker.className = 'cut-marker';
        leftMarker.style.cssText = `
            position: absolute;
            left: ${startPercent}%;
            top: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, #ff6b6b, #ff4757);
            z-index: 10;
            border-radius: 2px;
            box-shadow: 0 0 10px rgba(255, 75, 75, 0.5);
            cursor: ew-resize;
        `;
        
        // Правый маркер
        const rightMarker = document.createElement('div');
        rightMarker.className = 'cut-marker';
        rightMarker.style.cssText = `
            position: absolute;
            right: ${100 - endPercent}%;
            top: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, #ff6b6b, #ff4757);
            z-index: 10;
            border-radius: 2px;
            box-shadow: 0 0 10px rgba(255, 75, 75, 0.5);
            cursor: ew-resize;
        `;
        
        container.appendChild(leftMarker);
        container.appendChild(rightMarker);
        
        // Затемнение обрезаемых частей
        const overlayLeft = document.createElement('div');
        overlayLeft.className = 'cut-overlay';
        overlayLeft.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: ${startPercent}%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 5;
            pointer-events: none;
        `;
        
        const overlayRight = document.createElement('div');
        overlayRight.className = 'cut-overlay';
        overlayRight.style.cssText = `
            position: absolute;
            right: 0;
            top: 0;
            width: ${100 - endPercent}%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 5;
            pointer-events: none;
        `;
        
        container.appendChild(overlayLeft);
        container.appendChild(overlayRight);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    drawWaveform();
    
    // Показываем приветствие если есть файл
    if (state.fileInfo) {
        tg.showPopup({
            title: '🎵 Файл загружен!',
            message: `Файл "${state.fileInfo.name}" готов к обработке`,
            buttons: [{ type: 'close' }]
        });
    }
});
