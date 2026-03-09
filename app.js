// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#1a1b1e');
tg.setBackgroundColor('#1a1b1e');

// Глобальные переменные для аудио
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let gainNode = null;
let isPlaying = false;
let startTime = 0;
let pauseTime = 0;

// Состояние приложения
const state = {
    volume: 100, // 0-200%
    speed: 1.0,
    startTime: 0,
    endTime: 0,
    currentTime: 0,
    isLooping: false,
    fileInfo: null,
    fileId: null,
    audioUrl: null
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
    state.endTime = fileData.duration * 1000;
    updateFileInfo(fileData);
    loadAudioFile(fileData);
} else {
    showNoFileMessage();
}

// Загрузка аудиофайла из Telegram
async function loadAudioFile(fileData) {
    try {
        // Показываем загрузку
        showLoading('Загрузка аудио...');
        
        // Здесь должен быть запрос к боту для получения файла
        // Временное решение - создаем демо-аудио
        await createDemoAudio();
        
        hideLoading();
        initAudioControls();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        hideLoading();
        showError('Не удалось загрузить аудио');
    }
}

// Создание демо-аудио (для тестирования)
async function createDemoAudio() {
    return new Promise((resolve) => {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Создаем простой тестовый тон
        const sampleRate = audioContext.sampleRate;
        const duration = 5; // 5 секунд
        const buffer = audioContext.createBuffer(2, sampleRate * duration, sampleRate);
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const nowBuffering = buffer.getChannelData(channel);
            for (let i = 0; i < buffer.length; i++) {
                const t = i / sampleRate;
                // Создаем простую мелодию
                if (t < 1) {
                    nowBuffering[i] = Math.sin(440 * 2 * Math.PI * t) * 0.1; // Ля (440 Гц)
                } else if (t < 2) {
                    nowBuffering[i] = Math.sin(493.88 * 2 * Math.PI * t) * 0.1; // Си (493.88 Гц)
                } else if (t < 3) {
                    nowBuffering[i] = Math.sin(523.25 * 2 * Math.PI * t) * 0.1; // До (523.25 Гц)
                } else {
                    nowBuffering[i] = Math.sin(440 * 2 * Math.PI * t) * 0.1 * (1 - (t-3)/2);
                }
            }
        }
        
        audioBuffer = buffer;
        state.endTime = duration * 1000;
        updateTimeline();
        resolve();
    });
}

// Инициализация аудио контролов
function initAudioControls() {
    setupWaveform();
    setupPlaybackControls();
    updateTimeline();
}

// Настройка waveform
function setupWaveform() {
    const canvas = document.getElementById('waveform');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Рисуем реальную форму волны если есть аудио
    if (audioBuffer) {
        drawRealWaveform(audioBuffer);
    }
}

// Рисование реальной формы волны
function drawRealWaveform(buffer) {
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    
    const data = buffer.getChannelData(0); // Левый канал
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#8774e1';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        
        const y1 = (1 + min) * amp;
        const y2 = (1 + max) * amp;
        
        ctx.moveTo(i, y1);
        ctx.lineTo(i, y2);
    }
    
    ctx.stroke();
    
    // Добавляем индикатор текущего времени
    drawPlayhead();
}

// Рисование индикатора воспроизведения
function drawPlayhead() {
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    
    if (isPlaying && audioBuffer) {
        const percent = (pauseTime || state.currentTime) / state.endTime;
        const x = percent * canvas.width;
        
        ctx.beginPath();
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 3;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

// Настройка кнопок воспроизведения
function setupPlaybackControls() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const loopToggle = document.getElementById('loopToggle');
    
    if (playBtn) {
        playBtn.addEventListener('click', playAudio);
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', pauseAudio);
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopAudio);
    }
    
    if (loopToggle) {
        loopToggle.addEventListener('click', () => {
            state.isLooping = !state.isLooping;
            loopToggle.classList.toggle('active', state.isLooping);
        });
    }
}

// Воспроизведение аудио
async function playAudio() {
    if (!audioBuffer || !audioContext) return;
    
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    // Останавливаем предыдущее воспроизведение
    if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
    }
    
    // Создаем новый источник
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    // Добавляем эффекты
    gainNode = audioContext.createGain();
    gainNode.gain.value = state.volume / 100;
    
    // Изменение скорости
    sourceNode.playbackRate.value = state.speed;
    
    // Соединяем узлы
    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Обработка окончания
    sourceNode.onended = () => {
        if (state.isLooping) {
            playAudio();
        } else {
            stopAudio();
        }
    };
    
    // Воспроизводим
    const offset = pauseTime / 1000 || 0;
    sourceNode.start(0, offset);
    
    isPlaying = true;
    startTime = audioContext.currentTime - offset;
    
    updatePlayButtonState(true);
    startTimeUpdate();
}

// Пауза
function pauseAudio() {
    if (sourceNode && isPlaying) {
        sourceNode.stop();
        pauseTime = (audioContext.currentTime - startTime) * 1000;
        isPlaying = false;
        updatePlayButtonState(false);
    }
}

// Остановка
function stopAudio() {
    if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
    }
    
    pauseTime = 0;
    state.currentTime = 0;
    isPlaying = false;
    
    updatePlayButtonState(false);
    updateTimeline();
}

// Обновление времени воспроизведения
function startTimeUpdate() {
    if (!isPlaying) return;
    
    state.currentTime = (audioContext.currentTime - startTime) * 1000;
    
    if (state.currentTime >= state.endTime) {
        if (state.isLooping) {
            state.currentTime = 0;
            pauseTime = 0;
            playAudio();
        } else {
            stopAudio();
        }
    }
    
    updateTimeline();
    requestAnimationFrame(startTimeUpdate);
}

// Обновление временной шкалы
function updateTimeline() {
    const currentTimeElem = document.getElementById('currentTime');
    const totalTimeElem = document.getElementById('totalTime');
    const timeline = document.getElementById('timeline');
    
    if (currentTimeElem) {
        const seconds = Math.floor(state.currentTime / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        currentTimeElem.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (totalTimeElem && state.endTime) {
        const seconds = Math.floor(state.endTime / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        totalTimeElem.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (timeline && state.endTime) {
        const percent = (state.currentTime / state.endTime) * 100;
        timeline.value = percent;
        timeline.style.background = `linear-gradient(90deg, var(--accent) 0%, var(--accent) ${percent}%, rgba(255,255,255,0.1) ${percent}%)`;
    }
    
    drawPlayhead();
}

// Обновление состояния кнопок
function updatePlayButtonState(playing) {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (playBtn && pauseBtn) {
        playBtn.style.display = playing ? 'none' : 'flex';
        pauseBtn.style.display = playing ? 'flex' : 'none';
    }
}

// Громкость
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const volumePercent = document.getElementById('volumePercent');

if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        state.volume = value;
        
        if (volumeValue) {
            volumeValue.textContent = `${value}%`;
        }
        
        if (volumePercent) {
            volumePercent.style.width = `${value}%`;
        }
        
        if (gainNode) {
            gainNode.gain.value = value / 100;
        }
    });
}

// Скорость
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        state.speed = value;
        
        if (speedValue) {
            speedValue.textContent = `${value.toFixed(1)}x`;
        }
        
        if (sourceNode) {
            sourceNode.playbackRate.value = value;
        }
    });
}

// Обрезка
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const timeline = document.getElementById('timeline');

if (timeline) {
    timeline.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value);
        state.currentTime = (percent / 100) * state.endTime;
        pauseTime = state.currentTime;
        
        if (isPlaying) {
            pauseAudio();
            playAudio();
        }
        
        updateTimeline();
    });
}

// Применить эффекты и сохранить
window.applyAndSave = () => {
    if (!audioBuffer) {
        tg.showPopup({
            title: '❌ Нет аудио',
            message: 'Сначала загрузите аудиофайл',
            buttons: [{ type: 'close' }]
        });
        return;
    }
    
    // Показываем диалог сохранения
    tg.showPopup({
        title: '💾 Сохранить изменения',
        message: 'Хотите сохранить обработанное аудио?',
        buttons: [
            { id: 'save', type: 'default', text: '💾 Сохранить' },
            { id: 'cancel', type: 'cancel', text: 'Отмена' }
        ]
    }, (buttonId) => {
        if (buttonId === 'save') {
            exportAudio();
        }
    });
};

// Экспорт аудио
async function exportAudio() {
    showLoading('Обработка аудио...');
    
    // Создаем offline контекст для рендеринга
    const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    const gain = offlineContext.createGain();
    gain.gain.value = state.volume / 100;
    
    source.playbackRate.value = state.speed;
    
    source.connect(gain);
    gain.connect(offlineContext.destination);
    
    // Обрабатываем обрезку
    const startSample = Math.floor(state.startTime / 1000 * audioBuffer.sampleRate);
    const endSample = Math.floor(state.endTime / 1000 * audioBuffer.sampleRate);
    
    source.start(0, startSample / audioBuffer.sampleRate, 
                 (endSample - startSample) / audioBuffer.sampleRate);
    
    // Рендерим аудио
    const renderedBuffer = await offlineContext.startRendering();
    
    // Конвертируем в WAV
    const wavBlob = await encodeWAV(renderedBuffer);
    
    // Отправляем в Telegram
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        
        tg.sendData(JSON.stringify({
            action: 'save_audio',
            audio_data: base64,
            format: 'wav',
            settings: {
                volume: state.volume,
                speed: state.speed,
                start: state.startTime,
                end: state.endTime
            }
        }));
        
        hideLoading();
        
        tg.showPopup({
            title: '✅ Готово!',
            message: 'Аудио сохранено и отправлено в чат',
            buttons: [{ type: 'close' }]
        });
    };
    
    reader.readAsDataURL(wavBlob);
}

// Конвертация в WAV
function encodeWAV(buffer) {
    return new Promise((resolve) => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        let bytesPerSample = bitDepth / 8;
        let blockAlign = numChannels * bytesPerSample;
        
        let dataLength = buffer.length * blockAlign;
        let headerLength = 44;
        let totalLength = headerLength + dataLength;
        
        let arrayBuffer = new ArrayBuffer(totalLength);
        let view = new DataView(arrayBuffer);
        
        // RIFF header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, totalLength - 8, true);
        writeString(view, 8, 'WAVE');
        
        // fmt subchunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, format, true); // audio format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true); // byte rate
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        
        // data subchunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Write audio data
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                let sample = buffer.getChannelData(channel)[i];
                sample = Math.max(-1, Math.min(1, sample));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample * (0x7FFF * 0.8), true);
                offset += 2;
            }
        }
        
        resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
    });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Вспомогательные функции
function showLoading(message) {
    let loader = document.querySelector('.loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'loader';
        document.body.appendChild(loader);
    }
    loader.innerHTML = `<div class="loader-content">⏳ ${message}</div>`;
    loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function showError(message) {
    tg.showPopup({
        title: '❌ Ошибка',
        message: message,
        buttons: [{ type: 'close' }]
    });
}

function showNoFileMessage() {
    document.getElementById('fileName').textContent = 'Файл не выбран';
    document.getElementById('fileDuration').textContent = '0:00';
    document.getElementById('fileSize').textContent = '0 KB';
    
    const fileCard = document.querySelector('.file-info-card');
    fileCard.innerHTML += `
        <div style="text-align: center; margin-top: 15px;">
            <button onclick="sendToBot()" class="action-btn" style="background: var(--accent);">
                📤 Отправить файл боту
            </button>
            <p style="font-size: 12px; color: #888; margin-top: 10px;">
                1. Напишите @YourBot<br>
                2. Отправьте аудиофайл<br>
                3. Нажмите "Открыть студию"
            </p>
        </div>
    `;
}

window.sendToBot = () => {
    tg.close();
};

function updateFileInfo(fileData) {
    document.getElementById('fileName').textContent = fileData.name || 'audio.mp3';
    
    const mins = Math.floor(fileData.duration / 60);
    const secs = Math.floor(fileData.duration % 60);
    document.getElementById('fileDuration').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('fileSize').textContent = `${fileData.size} MB`;
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Создаем аудио контекст при взаимодействии
    document.addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, { once: true });
});
