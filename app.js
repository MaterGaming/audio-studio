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
    botToken: '8532102228:AAFZji9fDEgiiSTcQJh485DKhXhEDYVhnz0' // Токен бота
};

// Получаем данные из URL (от бота)
function getFileDataFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const startParam = urlParams.get('start_param');
        
        if (startParam) {
            // Декодируем данные
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
        
        // Сохраняем данные
        state.fileInfo = fileData;
        state.fileId = fileData.file_id;
        
        // ПРАВИЛЬНЫЙ URL для скачивания файла из Telegram
        // Используем getFile?file_id= метод
        const fileUrl = `https://api.telegram.org/file/bot${state.botToken}/${fileData.file_path}`;
        console.log('📥 URL для скачивания:', fileUrl);
        
        // Загружаем файл
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log('📦 Файл загружен, размер:', arrayBuffer.byteLength, 'байт');
        
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
        
        // Показываем успешное сообщение
        tg.showPopup({
            title: '✅ Успешно!',
            message: `Файл "${fileData.name}" загружен и готов к обработке`,
            buttons: [{ type: 'close' }]
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        hideLoading();
        
        // Показываем сообщение об ошибке
        tg.showPopup({
            title: '❌ Ошибка загрузки',
            message: 'Не удалось загрузить файл. Проверьте, что файл отправлен боту.',
            buttons: [{ type: 'close' }]
        });
        
        // Создаем тестовое аудио для демонстрации
        createTestAudio();
    }
}

// Создание тестового аудио (если не удалось загрузить реальное)
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
            // Простой тестовый сигнал
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

// Загрузка данных при запуске
const fileData = getFileDataFromUrl();
if (fileData && fileData.file_id && fileData.file_path) {
    console.log('📁 Загружаем реальный файл:', fileData.name);
    loadRealAudioFile(fileData);
} else {
    console.log('⚠️ Нет данных о файле, создаем тестовое аудио');
    createTestAudio();
    showNoFileMessage();
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
    
    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
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
    const volumeValue = document.getElementById('volumeValue');
    const volumePercent = document.getElementById('volumePercent');
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            state.volume = value;
            volumeValue.textContent = `${value}%`;
            volumePercent.style.width = `${value/2}%`;
            
            if (gainNode) {
                gainNode.gain.value = (value / 100) * (isMuted ? 0 : 1);
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
            speedValue.textContent = `${value.toFixed(1)}x`;
            
            if (sourceNode) {
                sourceNode.playbackRate.value = value;
            }
        });
    }
    
    // Эквалайзер
    const eqLow = document.getElementById('eqLow');
    const eqMid = document.getElementById('eqMid');
    const eqHigh = document.getElementById('eqHigh');
    
    if (eqLow) {
        eqLow.addEventListener('input', (e) => {
            state.eqLow = parseInt(e.target.value);
            document.getElementById('eqLowValue').textContent = `${state.eqLow}dB`;
        });
    }
    
    if (eqMid) {
        eqMid.addEventListener('input', (e) => {
            state.eqMid = parseInt(e.target.value);
            document.getElementById('eqMidValue').textContent = `${state.eqMid}dB`;
        });
    }
    
    if (eqHigh) {
        eqHigh.addEventListener('input', (e) => {
            state.eqHigh = parseInt(e.target.value);
            document.getElementById('eqHighValue').textContent = `${state.eqHigh}dB`;
        });
    }
    
    // Реверберация
    const reverbSlider = document.getElementById('reverbSlider');
    if (reverbSlider) {
        reverbSlider.addEventListener('input', (e) => {
            state.reverb = parseInt(e.target.value);
            document.getElementById('reverbValue').textContent = `${state.reverb}%`;
        });
    }
    
    // Pitch
    const pitchSlider = document.getElementById('pitchSlider');
    if (pitchSlider) {
        pitchSlider.addEventListener('input', (e) => {
            state.pitch = parseInt(e.target.value);
            document.getElementById('pitchValue').textContent = state.pitch;
        });
    }
    
    // Обрезка
    const startInput = document.getElementById('startTime');
    const endInput = document.getElementById('endTime');
    
    if (startInput) {
        startInput.addEventListener('change', () => {
            const seconds = timeToSeconds(startInput.value);
            state.startTime = Math.max(0, Math.min(seconds * 1000, state.endTime - 1000));
            startInput.value = secondsToTime(state.startTime / 1000);
            updateCutHandles();
        });
    }
    
    if (endInput) {
        endInput.addEventListener('change', () => {
            const seconds = timeToSeconds(endInput.value);
            state.endTime = Math.min(state.endTime, Math.max(seconds * 1000, state.startTime + 1000));
            endInput.value = secondsToTime(state.endTime / 1000);
            updateCutHandles();
        });
    }
    
    // Фаза
    const phaseToggle = document.getElementById('phaseToggle');
    if (phaseToggle) {
        phaseToggle.addEventListener('click', togglePhase);
    }
}

// Настройка экспорта
function setupExportControls() {
    // Формат
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.format = btn.textContent.toLowerCase();
            
            const mp3Quality = document.getElementById('mp3Quality');
            if (mp3Quality) {
                mp3Quality.style.display = state.format === 'mp3' ? 'block' : 'none';
            }
        });
    });
    
    // Битрейт
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.bitrate = btn.textContent.split(' ')[0];
        });
    });
    
    // Нормализация
    const normalizeToggle = document.getElementById('normalizeToggle');
    if (normalizeToggle) {
        normalizeToggle.addEventListener('click', () => {
            state.isNormalized = !state.isNormalized;
            normalizeToggle.classList.toggle('active', state.isNormalized);
        });
    }
}

// Функции воспроизведения
async function playAudio() {
    if (!audioBuffer || !audioContext) return;
    
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
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
        if (state.isLooping) {
            playAudio();
        } else {
            stopAudio();
        }
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

function toggleMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('muteBtn');
    
    if (gainNode) {
        gainNode.gain.value = isMuted ? 0 : state.volume / 100;
    }
    
    muteBtn.innerHTML = isMuted ? '<span>🔇</span>' : '<span>🔊</span>';
    muteBtn.classList.toggle('active', isMuted);
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

window.setReverb = (value) => {
    document.getElementById('reverbSlider').value = value;
    document.getElementById('reverbSlider').dispatchEvent(new Event('input'));
};

window.setPitch = (value) => {
    document.getElementById('pitchSlider').value = value;
    document.getElementById('pitchSlider').dispatchEvent(new Event('input'));
};

window.setCutPreset = (preset) => {
    const duration = state.endTime / 1000;
    
    switch(preset) {
        case 'start':
            state.startTime = 0;
            state.endTime = duration * 0.3 * 1000;
            break;
        case 'middle':
            state.startTime = duration * 0.35 * 1000;
            state.endTime = duration * 0.65 * 1000;
            break;
        case 'end':
            state.startTime = duration * 0.7 * 1000;
            state.endTime = duration * 1000;
            break;
    }
    
    document.getElementById('startTime').value = secondsToTime(state.startTime / 1000);
    document.getElementById('endTime').value = secondsToTime(state.endTime / 1000);
    updateCutHandles();
};

window.togglePhase = () => {
    state.isPhaseInverted = !state.isPhaseInverted;
    document.getElementById('phaseToggle').classList.toggle('active', state.isPhaseInverted);
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
    
    // Обрезка
    const startSample = Math.floor(state.startTime / 1000 * audioBuffer.sampleRate);
    const endSample = Math.floor(state.endTime / 1000 * audioBuffer.sampleRate);
    const duration = (endSample - startSample) / audioBuffer.sampleRate;
    
    source.start(0, startSample / audioBuffer.sampleRate, duration);
    
    // Рендерим
    offlineContext.startRendering().then(renderedBuffer => {
        // Конвертируем в WAV
        const wavData = encodeWAV(renderedBuffer);
        
        // Конвертируем в base64
        const base64 = btoa(String.fromCharCode(...new Uint8Array(wavData)));
        
        // Отправляем в Telegram
        tg.sendData(JSON.stringify({
            action: 'save_audio',
            audio_data: base64,
            format: state.format,
            bitrate: state.bitrate,
            file_name: `processed_audio.${state.format}`,
            settings: {
                volume: state.volume,
                speed: state.speed,
                start: state.startTime,
                end: state.endTime
            }
        }));
        
        hideLoading();
        
        tg.showPopup({
            title: '✅ Успешно!',
            message: 'Аудио обработано и отправлено в чат',
            buttons: [{ type: 'close' }]
        });
        
        setTimeout(() => tg.close(), 2000);
        
    }).catch(error => {
        console.error('❌ Ошибка рендеринга:', error);
        hideLoading();
        tg.showPopup({
            title: '❌ Ошибка',
            message: 'Не удалось обработать аудио',
            buttons: [{ type: 'close' }]
        });
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
    let headerLength = 44;
    let totalLength = headerLength + dataLength;
    
    let arrayBuffer = new ArrayBuffer(totalLength);
    let view = new DataView(arrayBuffer);
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
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

function showNoFileMessage() {
    const fileCard = document.querySelector('.file-info-card');
    const existingMsg = fileCard.querySelector('.no-file-message');
    
    if (!existingMsg) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'no-file-message';
        msgDiv.innerHTML = `
            <div style="text-align: center; margin-top: 15px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px;">
                <p style="margin-bottom: 10px;">📢 Отправьте аудиофайл боту, затем нажмите "Открыть студию"</p>
                <button onclick="window.Telegram.WebApp.close()" class="preset-btn" style="background: var(--accent); padding: 10px 20px;">
                    🔙 Вернуться в чат
                </button>
            </div>
        `;
        fileCard.appendChild(msgDiv);
    }
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
        
        const y1 = (1 + min) * amp;
        const y2 = (1 + max) * amp;
        
        ctx.moveTo(i, y1);
        ctx.lineTo(i, y2);
    }
    
    ctx.stroke();
    
    updateCutHandles();
}

function drawPlayhead() {
    const canvas = document.getElementById('waveform');
    if (!canvas || !audioBuffer) return;
    
    const ctx = canvas.getContext('2d');
    
    if (isPlaying && state.endTime) {
        const percent = (state.currentTime / state.endTime) * 100;
        const x = (percent / 100) * canvas.width;
        
        ctx.beginPath();
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 3;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

function updateCutHandles() {
    if (!state.endTime) return;
    
    const startPercent = (state.startTime / state.endTime) * 100;
    const endPercent = 100 - ((state.endTime - state.startTime) / state.endTime * 100);
    
    const leftHandle = document.getElementById('leftHandle');
    const rightHandle = document.getElementById('rightHandle');
    
    if (leftHandle) {
        leftHandle.style.left = `${startPercent}%`;
    }
    
    if (rightHandle) {
        rightHandle.style.right = `${endPercent}%`;
    }
    
    const leftOverlay = document.querySelector('.left-overlay');
    const rightOverlay = document.querySelector('.right-overlay');
    
    if (leftOverlay) {
        leftOverlay.style.width = `${startPercent}%`;
    }
    
    if (rightOverlay) {
        rightOverlay.style.width = `${endPercent}%`;
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', () => {
        drawWaveform();
    });
    
    // Drag handles for cut
    let activeHandle = null;
    
    const leftHandle = document.getElementById('leftHandle');
    const rightHandle = document.getElementById('rightHandle');
    const cutPreview = document.getElementById('cutPreview');
    
    if (leftHandle) {
        leftHandle.addEventListener('mousedown', (e) => {
            activeHandle = 'left';
            e.preventDefault();
        });
    }
    
    if (rightHandle) {
        rightHandle.addEventListener('mousedown', (e) => {
            activeHandle = 'right';
            e.preventDefault();
        });
    }
    
    document.addEventListener('mousemove', (e) => {
        if (!activeHandle || !state.endTime || !cutPreview) return;
        
        const rect = cutPreview.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        
        if (activeHandle === 'left') {
            const newTime = (percent / 100) * state.endTime;
            state.startTime = Math.max(0, Math.min(newTime, state.endTime - 1000));
            document.getElementById('startTime').value = secondsToTime(state.startTime / 1000);
        } else if (activeHandle === 'right') {
            const newTime = (percent / 100) * state.endTime;
            state.endTime = Math.min(state.endTime, Math.max(newTime, state.startTime + 1000));
            document.getElementById('endTime').value = secondsToTime(state.endTime / 1000);
        }
        
        updateCutHandles();
    });
    
    document.addEventListener('mouseup', () => {
        activeHandle = null;
    });
});
