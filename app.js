// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран
tg.setHeaderColor('#1a1b1e');

// Состояние приложения
const state = {
    volume: 0,
    speed: 1,
    startTime: 0,
    endTime: 210000, // в миллисекундах (3:30)
    sampleRate: 'original',
    channels: 'original',
    bitDepth: 'original',
    format: 'mp3',
    bitrate: '128k',
    fileInfo: null
};

// Загрузка данных из Telegram
const initData = tg.initDataUnsafe;
if (initData && initData.user) {
    console.log('User:', initData.user);
    loadFileInfo();
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
const leftHandle = document.getElementById('leftHandle');
const rightHandle = document.getElementById('rightHandle');

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
    updateHandles();
});

endTimeInput.addEventListener('change', (e) => {
    const seconds = timeToSeconds(e.target.value);
    state.endTime = seconds * 1000;
    updateHandles();
});

function updateHandles() {
    const totalDuration = state.fileInfo?.duration || 210000; // в миллисекундах
    const startPercent = (state.startTime / totalDuration) * 100;
    const endPercent = (state.endTime / totalDuration) * 100;
    
    leftHandle.style.left = `${startPercent}%`;
    rightHandle.style.right = `${100 - endPercent}%`;
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

// Формат
window.setFormat = (format) => {
    document.querySelectorAll('.format-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.format = format;
    
    // Показываем/скрываем качество MP3
    const mp3Quality = document.getElementById('mp3Quality');
    mp3Quality.style.display = format === 'mp3' ? 'block' : 'none';
};

// Битрейт
window.setBitrate = (bitrate) => {
    document.querySelectorAll('.quality-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.bitrate = bitrate;
};

// Применить эффекты
window.applyEffects = () => {
    const applyBtn = document.querySelector('.apply-btn');
    applyBtn.classList.add('processing');
    applyBtn.textContent = 'Обработка...';
    
    // Отправляем данные в бот
    tg.sendData(JSON.stringify({
        action: 'apply_effects',
        effects: state
    }));
    
    setTimeout(() => {
        applyBtn.classList.remove('processing');
        applyBtn.textContent = 'Применить эффекты';
        tg.showAlert('✅ Эффекты применены! Нажмите "Обработать и отправить" для экспорта.');
    }, 1500);
};

// Экспорт аудио
window.exportAudio = () => {
    const exportBtn = document.querySelector('.export-btn');
    exportBtn.classList.add('processing');
    exportBtn.innerHTML = '<span>⏳ Обработка...</span>';
    
    // Отправляем данные для экспорта
    tg.sendData(JSON.stringify({
        action: 'export_audio',
        settings: state
    }));
    
    setTimeout(() => {
        exportBtn.classList.remove('processing');
        exportBtn.innerHTML = '<span>🎵 Обработать и отправить</span>';
        tg.showAlert('✅ Аудио обработано! Файл будет отправлен в чат.');
    }, 2000);
};

// Сброс эффектов
window.resetEffects = () => {
    setVolume(0);
    setSpeed(1);
    
    state.startTime = 0;
    state.endTime = state.fileInfo?.duration || 210000;
    startTimeInput.value = '0:00';
    endTimeInput.value = secondsToTime(state.endTime / 1000);
    
    setChannels('original');
    setBitDepth('original');
    setFormat('mp3');
    setBitrate('128k');
    
    updateHandles();
    tg.showAlert('🔄 Все эффекты сброшены');
};

// Загрузка информации о файле
function loadFileInfo() {
    // Здесь можно загрузить информацию о текущем файле из бота
    // Пока используем тестовые данные
    state.fileInfo = {
        name: 'audio_example.mp3',
        duration: 210000, // 3:30 в миллисекундах
        size: '3.2 MB'
    };
    
    document.getElementById('fileName').textContent = state.fileInfo.name;
    document.getElementById('fileDuration').textContent = secondsToTime(state.fileInfo.duration / 1000);
    document.getElementById('fileSize').textContent = state.fileInfo.size;
    
    state.endTime = state.fileInfo.duration;
    endTimeInput.value = secondsToTime(state.fileInfo.duration / 1000);
    
    // Рисуем waveform
    drawWaveform();
}

// Рисование waveform (упрощенная версия)
function drawWaveform() {
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#8774e1';
    ctx.strokeStyle = '#ffffff';
    
    // Рисуем случайные столбцы для демонстрации
    for (let i = 0; i < 50; i++) {
        const height = Math.random() * 50 + 10;
        ctx.fillRect(i * 6, 60 - height, 4, height);
    }
    
    updateHandles();
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Устанавливаем тему Telegram
    tg.setHeaderColor('#1a1b1e');
    tg.setBackgroundColor('#1a1b1e');
    
    // Обработка закрытия
    window.telegram = tg;
});

// Обработка данных от бота
tg.onEvent('webAppData', (data) => {
    console.log('Received data:', data);
    // Здесь можно обновить интерфейс на основе данных от бота
});