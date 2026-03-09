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
    fileId: null
};

// Получаем данные из URL
function getFileDataFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const startParam = urlParams.get('start_param');
        
        if (startParam) {
            return JSON.parse(decodeURIComponent(startParam));
        }
    } catch (e) {
        console.error('Ошибка парсинга данных:', e);
    }
    return null;
}

// Загрузка данных
const fileData = getFileDataFromUrl();
if (fileData) {
    state.fileInfo = fileData;
    state.fileId = fileData.file_id;
    state.endTime = fileData.duration * 1000;
    updateFileInfo(fileData);
    createDemoAudio();
} else {
    showNoFileMessage();
}

// Создание демо-аудио
async function createDemoAudio() {
    showLoading('Создание тестового аудио...');
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const sampleRate = audioContext.sampleRate;
    const duration = 5;
    const buffer = audioContext.createBuffer(2, sampleRate * duration, sampleRate);
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const nowBuffering = buffer.getChannelData(channel);
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            if (t < 1) {
                nowBuffering[i] = Math.sin(440 * 2 * Math.PI * t) * 0.1;
            } else if (t < 2) {
                nowBuffering[i] = Math.sin(493.88 * 2 * Math.PI * t) * 0.1;
            } else if (t < 3) {
                nowBuffering[i] = Math.sin(523.25 * 2 * Math.PI * t) * 0.1;
            } else if (t < 4) {
                nowBuffering[i] = Math.sin(587.33 * 2 * Math.PI * t) * 0.1;
            } else {
                nowBuffering[i] = Math.sin(659.25 * 2 * Math.PI * t) * 0.1 * (1 - (t-4));
            }
        }
    }
    
    audioBuffer = buffer;
    state.endTime = duration * 1000;
    
    hideLoading();
    initControls();
    drawWaveform();
}

// Инициализация контролов
function initControls() {
    setupPlaybackControls();
    setupEffectControls();
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
            volumePercent.style.width = `${value}%`;
            
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
            state.startTime = seconds * 1000;
            updateCutHandles();
        });
    }
    
    if (endInput) {
        endInput.addEventListener('change', () => {
            const seconds = timeToSeconds(endInput.value);
            state.endTime = seconds * 1000;
            updateCutHandles();
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

// Форматы
window.setFormat = (format) => {
    document.querySelectorAll('.format-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.format = format;
    
    const mp3Quality = document.getElementById('mp3Quality');
    if (mp3Quality) {
        mp3Quality.style.display = format === 'mp3' ? 'block' : 'none';
    }
};

window.setBitrate = (bitrate) => {
    document.querySelectorAll('.quality-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    state.bitrate = bitrate;
};

// Применить эффекты
window.applyEffects = () => {
    showLoading('Применение эффектов...');
    
    setTimeout(() => {
        hideLoading();
        tg.showPopup({
            title: '✅ Готово',
            message: 'Эффекты применены! Нажмите "Сохранить" для экспорта.',
            buttons: [{ type: 'close' }]
        });
    }, 1000);
};

// Предпросмотр
window.previewExport = () => {
    const modal = document.getElementById('previewModal');
    modal.classList.add('active');
};

window.playPreview = () => {
    playAudio();
};

window.pausePreview = () => {
    pauseAudio();
};

window.closePreview = () => {
    document.getElementById('previewModal').classList.remove('active');
};

// Сохранение
window.applyAndSave = () => {
    showLoading('Обработка аудио...');
    
    setTimeout(() => {
        hideLoading();
        
        tg.showPopup({
            title: '✅ Успешно!',
            message: 'Аудио обработано и отправлено в чат!',
            buttons: [{ type: 'close' }]
        });
        
        setTimeout(() => tg.close(), 2000);
    }, 2000);
};

// Сброс
window.resetEffects = () => {
    setVolume(100);
    setSpeed(1);
    setReverb(0);
    setPitch(0);
    
    state.eqLow = 0;
    state.eqMid = 0;
    state.eqHigh = 0;
    state.isPhaseInverted = false;
    
    document.getElementById('eqLow').value = 0;
    document.getElementById('eqMid').value = 0;
    document.getElementById('eqHigh').value = 0;
    document.getElementById('eqLowValue').textContent = '0dB';
    document.getElementById('eqMidValue').textContent = '0dB';
    document.getElementById('eqHighValue').textContent = '0dB';
    
    document.getElementById('phaseToggle').classList.remove('active');
    
    if (state.fileInfo) {
        state.startTime = 0;
        state.endTime = state.fileInfo.duration * 1000;
        document.getElementById('startTime').value = '0:00';
        document.getElementById('endTime').value = secondsToTime(state.fileInfo.duration);
    }
    
    updateCutHandles();
    
    tg.showPopup({
        title: '🔄 Сброс',
        message: 'Все настройки сброшены',
        buttons: [{ type: 'close' }]
    });
};

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
    document.getElementById('fileName').textContent = 'Файл не выбран';
    document.getElementById('fileDuration').textContent = '0:00';
    document.getElementById('fileSize').textContent = '0 MB';
    document.getElementById('fileChannels').textContent = '—';
    document.getElementById('fileSampleRate').textContent = '— Гц';
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
    const endPercent = (state.endTime / state.endTime) * 100;
    
    const leftHandle = document.getElementById('leftHandle');
    const rightHandle = document.getElementById('rightHandle');
    
    if (leftHandle) {
        leftHandle.style.left = `${startPercent}%`;
    }
    
    if (rightHandle) {
        rightHandle.style.right = `${100 - endPercent}%`;
    }
    
    const leftOverlay = document.querySelector('.left-overlay');
    const rightOverlay = document.querySelector('.right-overlay');
    
    if (leftOverlay) {
        leftOverlay.style.width = `${startPercent}%`;
    }
    
    if (rightOverlay) {
        rightOverlay.style.width = `${100 - endPercent}%`;
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Обновляем размер canvas при изменении окна
    window.addEventListener('resize', () => {
        drawWaveform();
    });
    
    // Добавляем перетаскивание для маркеров обрезки
    let activeHandle = null;
    
    document.getElementById('leftHandle')?.addEventListener('mousedown', (e) => {
        activeHandle = 'left';
    });
    
    document.getElementById('rightHandle')?.addEventListener('mousedown', (e) => {
        activeHandle = 'right';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!activeHandle || !state.endTime) return;
        
        const rect = document.getElementById('cutPreview').getBoundingClientRect();
        const x = e.clientX - rect.left;
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
