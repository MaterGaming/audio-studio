from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler,
    filters, ContextTypes
)
from pydub import AudioSegment
import os
import json
import urllib.parse
import tempfile
import logging

# Включим логирование для отладки
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

TOKEN = "8532102228:AAFZji9fDEgiiSTcQJh485DKhXhEDYVhnz0"
# ЗАМЕНИТЕ НА ВАШ РЕАЛЬНЫЙ URL GITHUB PAGES
WEBAPP_URL = "https://matergaming.github.io/audio-studio/"

# Главное меню с кнопкой Mini App
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton(
            "🎵 Открыть Audio Studio", 
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
        [InlineKeyboardButton("📱 Помощь", callback_data="help")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎧 *Добро пожаловать в Audio Studio Bot!*\n\n"
        "1️⃣ Отправьте мне аудиофайл\n"
        "2️⃣ Нажмите кнопку ниже\n"
        "3️⃣ Обработайте в студии и сохраните\n\n"
        "⬇️ Нажмите кнопку, чтобы начать:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

# Обработка аудиофайла
async def handle_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        # Получаем файл (аудио или голосовое)
        file = update.message.audio or update.message.voice
        if not file:
            await update.message.reply_text("❌ Пожалуйста, отправьте аудиофайл.")
            return

        # Отправляем сообщение о начале загрузки
        status_msg = await update.message.reply_text("⏳ Загружаю файл...")

        # Получаем информацию о файле
        file_id = file.file_id
        file_name = file.file_name if hasattr(file, 'file_name') else 'audio_file.mp3'
        duration = file.duration if hasattr(file, 'duration') else 0
        file_size = file.file_size if hasattr(file, 'file_size') else 0
        
        logger.info(f"Получен файл: {file_name}, ID: {file_id}")

        # Получаем file_path для прямой загрузки
        file_info = await context.bot.get_file(file_id)
        file_path = file_info.file_path
        
        # Скачиваем файл для анализа
        await status_msg.edit_text("⏳ Анализирую аудио...")
        
        # Скачиваем файл во временную директорию
        with tempfile.NamedTemporaryFile(suffix='.ogg', delete=False) as tmp_file:
            await file_info.download_to_drive(tmp_file.name)
            temp_path = tmp_file.name

        # Анализируем аудио
        audio = AudioSegment.from_file(temp_path)
        
        # Сохраняем в context.user_data
        context.user_data["file_id"] = file_id
        context.user_data["file_name"] = file_name
        context.user_data["duration"] = len(audio)  # в миллисекундах
        context.user_data["channels"] = audio.channels
        context.user_data["frame_rate"] = audio.frame_rate
        context.user_data["file_size"] = file_size
        context.user_data["file_path"] = temp_path  # сохраняем путь для дальнейшей работы
        
        # Форматируем информацию для пользователя
        duration_sec = len(audio) / 1000
        minutes = int(duration_sec // 60)
        seconds = int(duration_sec % 60)
        size_mb = file_size / (1024 * 1024)
        
        # Создаём данные для передачи в мини-приложение
        file_data = {
            "file_id": file_id,
            "file_path": file_path,  # ВАЖНО: передаем путь для скачивания
            "name": file_name,
            "duration": duration_sec,
            "channels": audio.channels,
            "sample_rate": audio.frame_rate,
            "size": round(size_mb, 1)
        }
        
        # Кодируем данные для передачи в URL
        encoded_data = urllib.parse.quote(json.dumps(file_data))
        webapp_url = f"{WEBAPP_URL}?start_param={encoded_data}"
        
        # Удаляем временное сообщение
        await status_msg.delete()
        
        # Отправляем информацию о файле с кнопкой
        await update.message.reply_text(
            f"✅ *Файл получен и готов к обработке!*\n\n"
            f"📊 *Информация:*\n"
            f"• Название: `{file_name}`\n"
            f"• Длительность: {minutes}:{seconds:02d}\n"
            f"• Каналы: {'Стерео' if audio.channels == 2 else 'Моно'}\n"
            f"• Частота: {audio.frame_rate} Гц\n"
            f"• Размер: {size_mb:.1f} MB\n\n"
            f"🎛️ *Нажмите кнопку ниже для открытия студии:*",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    "🎛️ Открыть Audio Studio",
                    web_app=WebAppInfo(url=webapp_url)
                )
            ]]),
            parse_mode='Markdown'
        )
        
        # Сохраняем файл в формате WAV для дальнейшей обработки
        wav_path = "working_audio.wav"
        audio.export(wav_path, format="wav")
        context.user_data["working_path"] = wav_path
        
    except Exception as e:
        logger.error(f"Ошибка обработки файла: {e}")
        await update.message.reply_text(f"❌ Ошибка при обработке файла: {str(e)}")

# Обработка данных из Mini App
async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        data = json.loads(update.effective_message.web_app_data.data)
        action = data.get('action')
        
        logger.info(f"Получены данные из Mini App: {action}")
        
        if action == 'save_audio':
            await handle_save_audio(update, context, data)
        elif action == 'apply_effects':
            await handle_apply_effects(update, context, data)
        elif action == 'request_file':
            await handle_request_file(update, context)
            
    except Exception as e:
        logger.error(f"Ошибка обработки данных: {e}")
        await update.effective_message.reply_text(f"❌ Ошибка: {str(e)}")

async def handle_save_audio(update: Update, context: ContextTypes.DEFAULT_TYPE, data):
    """Обработка сохранения аудио"""
    try:
        audio_data = data.get('audio_data')
        format = data.get('format', 'mp3')
        bitrate = data.get('bitrate', '128k')
        settings = data.get('settings', {})
        
        status_msg = await update.effective_message.reply_text("⏳ Сохраняю обработанное аудио...")
        
        # Если есть working_path, используем его
        working_path = context.user_data.get("working_path")
        
        if working_path and os.path.exists(working_path):
            audio = AudioSegment.from_file(working_path)
            
            # Применяем настройки
            if settings.get('volume', 100) != 100:
                # Конвертируем проценты в dB (примерно)
                db = 20 * (settings['volume'] / 100)
                audio = audio + db
            
            if settings.get('speed', 1) != 1:
                audio = audio._spawn(audio.raw_data, overrides={
                    "frame_rate": int(audio.frame_rate * settings['speed'])
                }).set_frame_rate(audio.frame_rate)
            
            # Обрезка если есть
            if settings.get('start', 0) > 0 or settings.get('end', 0) < len(audio):
                start = int(settings.get('start', 0))
                end = int(settings.get('end', len(audio)))
                audio = audio[start:end]
            
            # Экспортируем
            export_path = f"final_audio.{format}"
            export_params = {}
            if format in ['mp3', 'ogg']:
                export_params['bitrate'] = bitrate
            
            audio.export(export_path, format=format, **export_params)
            
            # Отправляем файл
            with open(export_path, 'rb') as f:
                await update.effective_message.reply_audio(
                    f,
                    caption=f"✅ Обработано в Audio Studio\n"
                           f"• Формат: {format.upper()}\n"
                           f"• Битрейт: {bitrate}\n"
                           f"• Громкость: {settings.get('volume', 100)}%\n"
                           f"• Скорость: {settings.get('speed', 1)}x"
                )
            
            # Удаляем временный файл
            os.remove(export_path)
            
        await status_msg.delete()
        
    except Exception as e:
        logger.error(f"Ошибка сохранения: {e}")
        await update.effective_message.reply_text(f"❌ Ошибка сохранения: {str(e)}")

async def handle_apply_effects(update: Update, context: ContextTypes.DEFAULT_TYPE, data):
    """Применение эффектов (предпросмотр)"""
    file_id = data.get('file_id')
    effects = data.get('effects', {})
    
    await update.effective_message.reply_text(
        f"✅ Эффекты применены!\n"
        f"• Громкость: {effects.get('volume', 100)}%\n"
        f"• Скорость: {effects.get('speed', 1)}x\n"
        f"• Pitch: {effects.get('pitch', 0)}\n\n"
        f"Нажмите 'Сохранить' в студии для экспорта."
    )

async def handle_request_file(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Пользователь запросил файл"""
    await update.effective_message.reply_text(
        "📁 Отправьте аудиофайл, и я открою студию для его обработки!"
    )

# Команда помощи
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = """
🎧 *Audio Studio Bot - Помощь*

*Как пользоваться:*
1️⃣ Отправьте аудиофайл (mp3, wav, ogg, и т.д.)
2️⃣ Нажмите "Открыть Audio Studio"
3️⃣ В студии вы можете:
   • Слушать аудио в реальном времени
   • Менять громкость и скорость
   • Обрезать файл
   • Применять эквалайзер
   • Добавлять реверберацию
   • Менять тональность
4️⃣ Нажмите "Сохранить" для экспорта

*Команды:*
/start - Запустить бота
/help - Эта справка
/reset - Сбросить сессию
/cancel - Отменить операцию

*Поддерживаемые форматы:*
MP3, WAV, OGG, M4A, FLAC и другие
    """
    await update.message.reply_text(help_text, parse_mode='Markdown')

# Сброс сессии
async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Удаляем временные файлы
    files_to_remove = ["temp_audio.ogg", "working_audio.wav", "final_audio.*"]
    for pattern in files_to_remove:
        import glob
        for f in glob.glob(pattern):
            try:
                os.remove(f)
            except:
                pass
    
    context.user_data.clear()
    await update.message.reply_text(
        "🔄 Сессия сброшена. Отправьте новый аудиофайл для обработки.",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🎵 Открыть студию", web_app=WebAppInfo(url=WEBAPP_URL))
        ]])
    )

# Отмена
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ Операция отменена.")

# Callback для кнопок
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == "help":
        await help_command(update, context)

if __name__ == "__main__":
    print("🚀 Audio Studio Bot запускается...")
    print(f"📱 WebApp URL: {WEBAPP_URL}")
    print("⚡ Ожидание сообщений...")
    
    app = ApplicationBuilder().token(TOKEN).build()
    
    # Добавляем обработчики
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(CommandHandler("cancel", cancel))
    
    # Обработка аудиофайлов
    app.add_handler(MessageHandler(filters.AUDIO | filters.VOICE, handle_audio))
    
    # Обработка данных из WebApp
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data))
    
    # Обработка callback кнопок
    app.add_handler(CallbackQueryHandler(button_callback))
    
    # Запускаем бота
    app.run_polling(allowed_updates=Update.ALL_TYPES)
