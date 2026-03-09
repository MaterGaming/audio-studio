from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler,
    filters, ContextTypes
)
from pydub import AudioSegment
import os
import json
import urllib.parse

TOKEN = "8532102228:AAFZji9fDEgiiSTcQJh485DKhXhEDYVhnz0"

# Главное меню с кнопкой Mini App
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton(
            "🎵 Открыть Audio Studio", 
            web_app=WebAppInfo(url="https://matergaming.github.io/audio-studio/")
        )],
        [InlineKeyboardButton("📱 Помощь", callback_data="help")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎧 *Добро пожаловать в Audio Studio Bot!*\n\n"
        "1. Отправьте аудиофайл\n"
        "2. Нажмите кнопку ниже\n"
        "3. Обработайте в студии\n\n"
        "⬇️ Нажмите кнопку, чтобы начать:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

# Обработка аудиофайла
async def handle_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    file = update.message.audio or update.message.voice
    if not file:
        await update.message.reply_text("Пожалуйста, отправьте аудиофайл.")
        return

    # Получаем информацию о файле
    file_id = file.file_id
    file_name = file.file_name if hasattr(file, 'file_name') else 'audio_file.mp3'
    duration = file.duration if hasattr(file, 'duration') else 0
    file_size = file.file_size if hasattr(file, 'file_size') else 0
    
    # Скачиваем файл для анализа
    file_path = await file.get_file()
    await file_path.download_to_drive("temp_audio.ogg")
    
    # Анализируем аудио
    audio = AudioSegment.from_file("temp_audio.ogg")
    
    # Сохраняем в context.user_data
    context.user_data["file_id"] = file_id
    context.user_data["file_name"] = file_name
    context.user_data["duration"] = len(audio)  # в миллисекундах
    context.user_data["channels"] = audio.channels
    context.user_data["frame_rate"] = audio.frame_rate
    context.user_data["file_size"] = file_size
    
    # Форматируем информацию для пользователя
    duration_sec = len(audio) / 1000
    minutes = int(duration_sec // 60)
    seconds = int(duration_sec % 60)
    size_mb = file_size / (1024 * 1024)
    
    # Создаём ссылку с данными о файле
    file_data = {
        "file_id": file_id,
        "name": file_name,
        "duration": duration_sec,
        "channels": audio.channels,
        "sample_rate": audio.frame_rate,
        "size": round(size_mb, 1)
    }
    
    # Кодируем данные для передачи в мини-приложение
    encoded_data = urllib.parse.quote(json.dumps(file_data))
    webapp_url = f"https://matergaming.github.io/audio-studio/?start_param={encoded_data}"
    
    # Отправляем информацию о файле
    await update.message.reply_text(
        f"✅ *Файл получен!*\n\n"
        f"📊 *Информация:*\n"
        f"• Длительность: {minutes}:{seconds:02d} мин\n"
        f"• Каналы: {'Стерео' if audio.channels == 2 else 'Моно'}\n"
        f"• Частота: {audio.frame_rate} Гц\n"
        f"• Размер: {size_mb:.1f} MB\n\n"
        f"🎛️ *Откройте Audio Studio для обработки:*",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton(
                "🎛️ Открыть студию",
                web_app=WebAppInfo(url=webapp_url)
            )
        ]]),
        parse_mode='Markdown'
    )
    
    # Сохраняем файл для дальнейшей обработки
    audio.export("working_audio.wav", format="wav")
    context.user_data["working_path"] = "working_audio.wav"

# Обработка данных из Mini App
async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        data = json.loads(update.effective_message.web_app_data.data)
        action = data.get('action')
        
        if action == 'apply_effects':
            file_id = data.get('file_id')
            effects = data.get('effects', {})
            
            await update.effective_message.reply_text(
                "🔄 Применяю эффекты...\n"
                f"• Громкость: {effects.get('volume', 0)} dB\n"
                f"• Скорость: {effects.get('speed', 1)}x"
            )
            
        elif action == 'export_audio':
            file_id = data.get('file_id')
            settings = data.get('settings', {})
            
            # Здесь будет логика обработки и отправки файла
            await update.effective_message.reply_text(
                f"✅ Аудио обработано!\n"
                f"Формат: {settings.get('format', 'mp3').upper()}\n"
                f"Битрейт: {settings.get('bitrate', '128k')}\n"
                f"Скоро отправлю файл..."
            )
            
            # Отправляем обработанный файл
            if os.path.exists("working_audio.wav"):
                audio = AudioSegment.from_file("working_audio.wav")
                
                # Применяем настройки
                if settings.get('volume', 0) != 0:
                    audio = audio + float(settings['volume'])
                
                if settings.get('speed', 1) != 1:
                    audio = audio._spawn(audio.raw_data, overrides={
                        "frame_rate": int(audio.frame_rate * float(settings['speed']))
                    }).set_frame_rate(audio.frame_rate)
                
                # Экспортируем
                format = settings.get('format', 'mp3')
                export_path = f"final_audio.{format}"
                
                export_params = {}
                if format in ['mp3', 'ogg'] and settings.get('bitrate'):
                    export_params['bitrate'] = settings['bitrate']
                
                audio.export(export_path, format=format, **export_params)
                
                # Отправляем файл
                with open(export_path, 'rb') as f:
                    await update.effective_message.reply_audio(f)
                
                os.remove(export_path)
            
    except Exception as e:
        await update.effective_message.reply_text(f"❌ Ошибка: {str(e)}")

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ Операция отменена.")

async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    for f in ["temp_audio.ogg", "working_audio.wav", "final_audio.*"]:
        if os.path.exists(f):
            os.remove(f)
    context.user_data.clear()
    await update.message.reply_text("🔄 Сессия сброшена. Отправьте новый аудиофайл.")

if __name__ == "__main__":
    app = ApplicationBuilder().token(TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(CommandHandler("cancel", cancel))
    app.add_handler(MessageHandler(filters.AUDIO | filters.VOICE, handle_audio))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data))
    
    print("🚀 Бот запущен...")
    app.run_polling()
