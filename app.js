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
    endTime: 0, // будет установлено из файла
    sampleRate: 'original',
    channels: 'original',
    bitDepth: 'original',
    format: 'mp3',
    bitrate: '128k',
    fileInfo: null,
    fileId: null // ID файла в Telegram
};

// Загрузка данных из Telegram (если бот передал информацию о файле)
try {
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        console.log('User:', tg.initDataUnsafe.user);
        // Здесь бот может передать информацию о загруженном файле
        const fileData = tg.initDataUnsafe.start_param ? 
            JSON.parse(decodeURIComponent(tg.initDataUnsafe.start_param)) : null;
        
        if (fileData) {
            state.fileInfo = fileData;
            state.fileId = fileData.file_id;
            updateFileInfo(fileData);
        } else {
            // Если нет данных, показываем заглушку
            showNoFileMessage();
        }
    } else {
        showNoFileMessage();
    }
} catch (e) {
    console.log('No file data');
    showNoFileMessage();
}

// Показать сообщение, если файл не выбран
function showNoFileMessage() {
    document.getElementById('fileName').textContent = 'Файл не выбран';
    document.getElementById('fileDuration').textContent = '0:00';
    document.getElementById('fileSize').textContent = '0 KB';
    
    // Добавляем кнопку для выбора файла
    const fileCard = document.querySelector('.file-info-card');
    fileCard.innerHTML += `
        <div style="text-align: center; margin-top: 10px;">
            <button onclick="selectFile()" class="preset-btn" style="background: var(--accent);">
                📁 Выбрать файл в боте
            </button>
        </div>
    `;
}

// Функция для выбора файла
window.selectFile = () => {
    tg.showPopup({
        title: 'Выберите файл',
        message: 'Отправьте аудиофайл в бота, затем откройте это окно снова',
        buttons: [{
            id: 'ok',
            type: 'default',
            text: 'Понятно'
        }]
    });
    
    // Можно отправить команду боту
    tg.sendData(JSON.stringify({
        action: 'request_file'
    }));
    
    // Закрываем мини-приложение, чтобы пользователь мог отправить файл
    setTimeout(() => {
        tg.close();
    }, 3000);
};

// Обновление информации о файле
function updateFileInfo(fileData) {
    document.getElementById('fileName').textContent = fileData.name || 'audio_file.mp3';
    
    const duration = fileData.duration || 210; // в секундах
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    document.getElementById('fileDuration').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    const size = fileData.size || 3.2; // в MB
    document.getElementById('fileSize').textContent = `${size} MB`;
    
    // Устанавливаем время окончания как длительность файла
    state.endTime = duration * 1000; // конвертируем в миллисекунды
    document.getElementById('endTime').value = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Обновляем waveform
    drawWaveform();
    
    // Убираем кнопку выбора файла, если она была
    const fileCard = document.querySelector('.file-info-card');
    const oldBtn = fileCard.querySelector('div[style*="text-align: center"]');
    if (oldBtn) oldBtn.remove();
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
});

endTimeInput.addEventListener('change', (e) => {
    const seconds = timeToSeconds(e.target.value);
    state.endTime = seconds * 1000;
    if (state.endTime < state.startTime) {
        state.endTime = state.startTime + 1000;
        e.target.value = secondsToTime((state.startTime + 1000) / 1000);
    }
});

// Формат
window.setFormat = (format) => {
    document.querySelectorAll('.format-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.format = format;
    
    // Показываем/скрываем качество MP3
    const mp3Quality = document.getElementById('mp3Quality');
    mp3Quality.style.display = format === 'mp3' ? 'block' : 'none';
};

// Частота дискретизации
document.getElementById('sampleRate').addEventListener('change', (e) => {
    state.sampleRate = e.target.value;
});

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
            title: 'Нет файла',
            message: 'Сначала отправьте аудиофайл в бота',
            buttons: [{ type: 'close' }]
        });
        return;
    }
    
    const applyBtn = document.querySelector('.apply-btn');
    applyBtn.classList.add('processing');
    applyBtn.textContent = 'Обработка...';
    
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
        applyBtn.textContent = 'Применить эффекты';
        tg.showPopup({
            title: '✅ Готово',
            message: 'Эффекты применены! Перейдите на вкладку "Экспорт" для сохранения.',
            buttons: [{ type: 'close' }]
        });
        
        // Переключаем на вкладку экспорта
        document.querySelector('[data-tab="export"]').click();
    }, 1500);
};

// Экспорт аудио
window.exportAudio = () => {
    if (!state.fileId) {
        tg.showPopup({
            title: 'Нет файла',
            message: 'Сначала отправьте аудиофайл в бота',
            buttons: [{ type: 'close' }]
        });
        return;
    }
    
    const exportBtn = document.querySelector('.export-btn');
    exportBtn.classList.add('processing');
    exportBtn.innerHTML = '<span>⏳ Обработка...</span>';
    
    // Отправляем данные для экспорта
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
        exportBtn.innerHTML = '<span>🎵 Обработать и отправить</span>';
        tg.showPopup({
            title: '✅ Успешно!',
            message: 'Аудио обработано и отправлено в чат!',
            buttons: [{ type: 'close' }]
        });
        
        // Можно закрыть мини-приложение после успешной отправки
        setTimeout(() => tg.close(), 2000);
    }, 2000);
};

// Сброс эффектов
window.resetEffects = () => {
    setVolume(0);
    setSpeed(1);
    
    if (state.fileInfo) {
        const duration = state.fileInfo.duration || 210;
        state.startTime = 0;
        state.endTime = duration * 1000;
        startTimeInput.value = '0:00';
        endTimeInput.value = secondsToTime(duration);
    } else {
        state.startTime = 0;
        state.endTime = 210000;
        startTimeInput.value = '0:00';
        endTimeInput.value = '3:30';
    }
    
    // Сброс остальных настроек
    state.sampleRate = 'original';
    document.getElementById('sampleRate').value = 'original';
    
    setChannels('original');
    setBitDepth('original');
    setFormat('mp3');
    setBitrate('128k');
    
    // Сброс активных классов
    document.querySelectorAll('.channel-btn, .depth-btn, .format-btn, .quality-btn')
        .forEach(btn => btn.classList.remove('active'));
    
    // Устанавливаем активный класс для дефолтных значений
    document.querySelector('[onclick="setChannels(\'original\')"]').classList.add('active');
    document.querySelector('[onclick="setBitDepth(\'original\')"]').classList.add('active');
    document.querySelector('[onclick="setFormat(\'mp3\')"]').classList.add('active');
    document.querySelector('[onclick="setBitrate(\'128k\')"]').classList.add('active');
    
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
    
    // Рисуем более реалистичный waveform
    const barCount = 50;
    const barWidth = 4;
    const barSpacing = 2;
    const totalWidth = barCount * (barWidth + barSpacing);
    const startX = (canvas.width - totalWidth) / 2;
    
    for (let i = 0; i < barCount; i++) {
        // Генерируем более музыкальные паттерны
        let height;
        if (i < 10) height = 20 + Math.sin(i) * 15;
        else if (i < 20) height = 35 + Math.cos(i) * 20;
        else if (i < 30) height = 45 + Math.sin(i/2) * 25;
        else if (i < 40) height = 30 + Math.cos(i/3) * 20;
        else height = 15 + Math.sin(i/2) * 10;
        
        // Добавляем случайные вариации
        height += Math.random() * 10;
        
        // Градиент для баров
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
    
    // Добавляем индикаторы обрезки
    const totalDuration = state.endTime || 210000;
    const startPercent = (state.startTime / totalDuration) * 100;
    const endPercent = (state.endTime / totalDuration) * 100;
    
    // Удаляем старые хендлы если есть
    const oldHandles = document.querySelectorAll('.cut-handle');
    oldHandles.forEach(h => h.remove());
    
    // Создаем новые хендлы
    const container = document.querySelector('.waveform-container');
    const waveform = document.getElementById('waveform');
    
    const leftHandle = document.createElement('div');
    leftHandle.className = 'cut-handle left-handle';
    leftHandle.style.cssText = `
        position: absolute;
        left: ${startPercent}%;
        top: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(180deg, #ff6b6b, #ff4757);
        cursor: ew-resize;
        z-index: 10;
        border-radius: 2px;
        box-shadow: 0 0 10px rgba(255, 75, 75, 0.5);
    `;
    
    const rightHandle = document.createElement('div');
    rightHandle.className = 'cut-handle right-handle';
    rightHandle.style.cssText = `
        position: absolute;
        right: ${100 - endPercent}%;
        top: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(180deg, #ff6b6b, #ff4757);
        cursor: ew-resize;
        z-index: 10;
        border-radius: 2px;
        box-shadow: 0 0 10px rgba(255, 75, 75, 0.5);
    `;
    
    container.appendChild(leftHandle);
    container.appendChild(rightHandle);
    
    // Добавляем затемнение для обрезаемых частей
    const overlayLeft = document.createElement('div');
    overlayLeft.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: ${startPercent}%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 5;
    `;
    
    const overlayRight = document.createElement('div');
    overlayRight.style.cssText = `
        position: absolute;
        right: 0;
        top: 0;
        width: ${100 - endPercent}%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 5;
    `;
    
    // Удаляем старые оверлеи
    const oldOverlays = container.querySelectorAll('.cut-overlay');
    oldOverlays.forEach(o => o.remove());
    
    overlayLeft.className = 'cut-overlay';
    overlayRight.className = 'cut-overlay';
    
    container.appendChild(overlayLeft);
    container.appendChild(overlayRight);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    drawWaveform();
    
    // Периодически обновляем waveform (для демонстрации)
    setInterval(drawWaveform, 5000);
});

// Обновляем HTML чтобы добавить кнопку выбора файла
