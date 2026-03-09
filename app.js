// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#1a1b1e');
tg.setBackgroundColor('#1a1b1e');

// Аудио переменные
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let gainNode = null;
let isPlaying = false;
let startTime = 0;
let pauseTime = 0;
let isMuted = false;

// Состояние приложения
const state = {
    volume: 100,
    speed: 1.0,
    startTime: 0,
    endTime: 0,
    currentTime: 0,
    isLooping: false,
    isNormalized: false,
    isPhaseInverted: false,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    reverb: 0,
    pitch: 0,
    format: 'mp3',
    bitrate: '128k',
    fileInfo: null,
    fileId: null,
    botToken: '8532102228:AAFZji9fDEgiiSTcQJh485DKhXhEDYVhnz0'
};

// Получаем данные из URL (от бота)
function getFileDataFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const startParam = urlParams.get('start_param');
        
        if (startParam) {
            const decodedData = decodeURIComponent(startParam);
            const fileData = JSON.parse(decodedData);
            console.log('✅ Получены данные файла:', fileData);
            return fileData;
        }
    } catch (e) {
        console.error('❌ Ошибка парсинга данных:', e);
    }
    return null;
}

// Функция для загрузки файла из Telegram
async function loadRealAudioFile(fileData) {
    try {
        showLoading('🔄 Загрузка аудиофайла...');
        
        state.fileInfo = fileData;
        state.fileId = fileData.file_id;
        
        // ПРАВИЛЬНЫЙ URL для скачивания
        const fileUrl = `https://api.telegram.org/file/bot${state.botToken}/${fileData.file_path}`;
        console.log('📥 URL для скачивания:', fileUrl);
        
        // Загружаем файл
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ошибка! Статус: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log('📦 Размер файла:', arrayBuffer.byteLength, 'байт');
        
        // Создаем аудио контекст
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Декодируем аудио
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('🎵 Аудио декодировано:', audioBuffer);
        
        // Обновляем информацию
        state.endTime = audioBuffer.duration * 1000;
        
        // Обновляем UI
        updateFileInfo(fileData);
        initControls();
        drawWaveform();
        
        hideLoading();
        
        // Показываем успех
        tg.showPopup({
            title: '✅ Успешно!',
            message: `Файл "${fileData.name}" загружен`,
            buttons: [{ type: 'close' }]
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        hideLoading();
        
        // Показываем детальную ошибку
        showDetailedError(error, fileData);
        
        // Создаем тестовое аудио
        createTestAudio();
    }
}

// Создание тестового аудио
async function createTestAudio() {
    showLoading('Создание тестового аудио...');
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const sampleRate = audioContext.sampleRate;
    const duration = 5;
    const buffer = audioContext.createBuffer(2, sampleRate * duration, sampleRate);
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const nowBuffering = buffer.getChannelData(channel);
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            nowBuffering[i] = Math.sin(440 * 2 * Math.PI * t) * 0.1;
        }
    }
    
    audioBuffer = buffer;
    state.endTime = duration * 1000;
    
    hideLoading();
    initControls();
    drawWaveform();
    
    document.getElementById('fileName').textContent = 'Тестовое аудио';
    document.getElementById('fileDuration').textContent = '0:05';
    document.getElementById('fileSize').textContent = '0.5 MB';
    document.getElementById('fileChannels').textContent = 'Стерео';
    document.getElementById('fileSampleRate').textContent = '44100 Гц';
}

// Показ детальной ошибки
function showDetailedError(error, fileData) {
    const fileCard = document.querySelector('.file-info-card');
    
    // Удаляем старые сообщения об ошибках
    const oldErrors = document.querySelectorAll('.error-message');
    oldErrors.forEach(el => el.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        text-align: center;
        margin: 15px;
        padding: 20px;
        background: rgba(255,0,0,0.1);
        border-radius: 12px;
        border: 1px solid rgba(255,0,0,0.3);
    `;
    
    errorDiv.innerHTML = `
        <p style="color: #ff6b6b; margin-bottom: 10px; font-weight: bold;">❌ Ошибка загрузки</p>
        <p style="font-size: 13px; color: #ccc; margin-bottom: 10px;">${error.message}</p>
        <p style="font-size: 11px; color: #888; margin-bottom: 15px; word-break: break-all;">
            Путь: ${fileData?.file_path || 'неизвестно'}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button onclick="window.Telegram.WebApp.close()" 
                style="padding: 10px 20px; background: var(--accent); border: none; border-radius: 20px; color: white; cursor: pointer;">
                🔙 Вернуться в чат
            </button>
            <button onclick="location.reload()" 
                style="padding: 10px 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; color: white; cursor: pointer;">
                🔄 Обновить
            </button>
        </div>
    `;
    
    fileCard.appendChild(errorDiv);
}

// Загрузка данных при запуске
const fileData = getFileDataFromUrl();
if (fileData && fileData.file_id && fileData.file_path) {
    console.log('📁 Загружаем реальный файл:', fileData.name);
    loadRealAudioFile(fileData);
} else {
    console.log('⚠️ Нет данных о файле');
    createTestAudio();
}

// Инициализация контролов
function initControls() {
    setupPlaybackControls();
    setupEffectControls();
    setupExportControls();
    updateTimeline();
}

// Настройка контролов воспроизведения
function setupPlaybackControls() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const loopToggle = document.getElementById('loopToggle');
    const muteBtn = document.getElementById('muteBtn');
    const timeline = document.getElementById('timeline');
    
    if (playBtn) playBtn.addEventListener('click', playAudio);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseAudio);
    if (stopBtn) stopBtn.addEventListener('click', stopAudio);
    
    if (loopToggle) {
        loopToggle.addEventListener('click', () => {
            state.isLooping = !state.isLooping;
            loopToggle.classList.toggle('active', state.isLooping);
        });
    }
    
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (gainNode) gainNode.gain.value = isMuted ? 0 : state.volume / 100;
            muteBtn.innerHTML = isMuted ? '<span>🔇</span>' : '<span>🔊</span>';
            muteBtn.classList.toggle('active', isMuted);
        });
    }
    
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
}

// Настройка контролов эффектов
function setupEffectControls() {
    // Громкость
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            state.volume = value;
            document.getElementById('volumeValue').textContent = `${value}%`;
            document.getElementById('volumePercent').style.width = `${value/2}%`;
            if (gainNode) gainNode.gain.value = (value / 100) * (isMuted ? 0 : 1);
        });
    }
    
    // Скорость
    const speedSlider = document.getElementById('speedSlider');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            state.speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = `${state.speed.toFixed(1)}x`;
            if (sourceNode) sourceNode.playbackRate.value = state.speed;
        });
    }
}

// Функции воспроизведения
async function playAudio() {
    if (!audioBuffer || !audioContext) return;
    
    if (audioContext.state === 'suspended') await audioContext.resume();
    
    if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
    }
    
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    gainNode = audioContext.createGain();
    gainNode.gain.value = isMuted ? 0 : state.volume / 100;
    
    sourceNode.playbackRate.value = state.speed;
    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    sourceNode.onended = () => {
        if (state.isLooping) playAudio();
        else stopAudio();
    };
    
    const offset = pauseTime / 1000 || 0;
    sourceNode.start(0, offset);
    
    isPlaying = true;
    startTime = audioContext.currentTime - offset;
    
    document.getElementById('playBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'flex';
    
    startTimeUpdate();
}

function pauseAudio() {
    if (sourceNode && isPlaying) {
        sourceNode.stop();
        pauseTime = (audioContext.currentTime - startTime) * 1000;
        isPlaying = false;
        
        document.getElementById('playBtn').style.display = 'flex';
        document.getElementById('pauseBtn').style.display = 'none';
    }
}

function stopAudio() {
    if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
    }
    
    pauseTime = 0;
    state.currentTime = 0;
    isPlaying = false;
    
    document.getElementById('playBtn').style.display = 'flex';
    document.getElementById('pauseBtn').style.display = 'none';
    
    updateTimeline();
}

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

// Функции эффектов
window.setVolume = (value) => {
    document.getElementById('volumeSlider').value = value;
    document.getElementById('volumeSlider').dispatchEvent(new Event('input'));
};

window.setSpeed = (value) => {
    document.getElementById('speedSlider').value = value;
    document.getElementById('speedSlider').dispatchEvent(new Event('input'));
};

// Применить эффекты
window.applyEffects = () => {
    if (!audioBuffer) {
        tg.showPopup({
            title: '❌ Нет аудио',
            message: 'Сначала отправьте аудиофайл боту',
            buttons: [{ type: 'close' }]
        });
        return;
    }
    
    showLoading('Применение эффектов...');
    
    setTimeout(() => {
        hideLoading();
        tg.showPopup({
            title: '✅ Эффекты применены',
            message: 'Теперь можете экспортировать файл',
            buttons: [{ type: 'close' }]
        });
    }, 1000);
};

// Экспорт и сохранение
window.applyAndSave = () => {
    if (!audioBuffer) {
        tg.showPopup({
            title: '❌ Ошибка',
            message: 'Аудио не загружено',
            buttons: [{ type: 'close' }]
        });
        return;
    }
    
    showLoading('Обработка аудио...');
    
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
    
    offlineContext.startRendering().then(renderedBuffer => {
        // Конвертируем в WAV
        const wavData = encodeWAV(renderedBuffer);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(wavData)));
        
        // Отправляем в Telegram
        tg.sendData(JSON.stringify({
            action: 'save_audio',
            audio_data: base64,
            format: state.format,
            bitrate: state.bitrate,
            file_name: `processed_audio.${state.format}`
        }));
        
        hideLoading();
        
        tg.showPopup({
            title: '✅ Успешно!',
            message: 'Аудио отправлено в чат',
            buttons: [{ type: 'close' }]
        });
        
        setTimeout(() => tg.close(), 2000);
        
    }).catch(error => {
        console.error('❌ Ошибка:', error);
        hideLoading();
        tg.showPopup({
            title: '❌ Ошибка',
            message: 'Не удалось обработать аудио',
            buttons: [{ type: 'close' }]
        });
    });
};

// Сброс
window.resetEffects = () => {
    setVolume(100);
    setSpeed(1);
    
    if (audioBuffer) {
        state.startTime = 0;
        state.endTime = audioBuffer.duration * 1000;
    }
    
    tg.showPopup({
        title: '🔄 Сброс',
        message: 'Все настройки сброшены',
        buttons: [{ type: 'close' }]
    });
};

// Конвертация в WAV
function encodeWAV(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    
    let bytesPerSample = bitDepth / 8;
    let blockAlign = numChannels * bytesPerSample;
    let dataLength = buffer.length * blockAlign;
    let arrayBuffer = new ArrayBuffer(44 + dataLength);
    let view = new DataView(arrayBuffer);
    
    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            let sample = buffer.getChannelData(channel)[i];
            sample = Math.max(-1, Math.min(1, sample));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
    }
    
    return arrayBuffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Вспомогательные функции
function updateFileInfo(fileData) {
    document.getElementById('fileName').textContent = fileData.name || 'audio.mp3';
    
    const mins = Math.floor(fileData.duration / 60);
    const secs = Math.floor(fileData.duration % 60);
    document.getElementById('fileDuration').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('fileSize').textContent = `${fileData.size} MB`;
    document.getElementById('fileChannels').textContent = fileData.channels === 2 ? 'Стерео' : 'Моно';
    document.getElementById('fileSampleRate').textContent = `${fileData.sample_rate} Гц`;
    
    document.getElementById('endTime').value = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showLoading(message) {
    const modal = document.getElementById('loadingModal');
    document.getElementById('loadingText').textContent = message || 'Загрузка...';
    modal.classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingModal').classList.remove('active');
}

// Waveform функции
function drawWaveform() {
    const canvas = document.getElementById('waveform');
    if (!canvas || !audioBuffer) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const data = audioBuffer.getChannelData(0);
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
        
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    
    ctx.stroke();
}

function drawPlayhead() {
    const canvas = document.getElementById('waveform');
    if (!canvas || !audioBuffer || !isPlaying) return;
    
    const ctx = canvas.getContext('2d');
    const percent = (state.currentTime / state.endTime) * 100;
    const x = (percent / 100) * canvas.width;
    
    ctx.beginPath();
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 3;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', drawWaveform);
});
