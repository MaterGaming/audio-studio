from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler,
    filters, ContextTypes
)
from pydub import AudioSegment
import os
import json
import urllib.parse
import base64
import tempfile

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

    try:
        # Отправляем сообщение о начале обработки
        processing_msg = await update.message.reply_text("🔄 Анализирую аудиофайл...")
        
        # Получаем информацию о файле
        file_id = file.file_id
        file_name = file.file_name if hasattr(file, 'file_name') else 'audio_file.mp3'
        duration = file.duration if hasattr(file, 'duration') else 0
        file_size = file.file_size if hasattr(file, 'file_size') else 0
        
        # Получаем file_path для скачивания
        file_info = await context.bot.get_file(file_id)
        file_path = file_info.file_path
        
        # Скачиваем файл для анализа
        await file_info.download_to_drive("temp_audio.ogg")
        
        # Анализируем аудио
        audio = AudioSegment.from_file("temp_audio.ogg")
        
        # Форматируем информацию
        duration_sec = len(audio) / 1000
        minutes = int(duration_sec // 60)
        seconds = int(duration_sec % 60)
        size_mb = file_size / (1024 * 1024)
        
        # Сохраняем в context.user_data
        context.user_data["file_id"] = file_id
        context.user_data["file_name"] = file_name
        context.user_data["file_path"] = file_path
        context.user_data["duration"] = duration_sec
        context.user_data["channels"] = audio.channels
        context.user_data["frame_rate"] = audio.frame_rate
        context.user_data["file_size"] = size_mb
        
        # Сохраняем файл для дальнейшей обработки
        audio.export("working_audio.wav", format="wav")
        
        # Создаём данные для передачи в мини-приложение
        file_data = {
            "file_id": file_id,
            "file_path": file_path,  # ВАЖНО: передаем путь к файлу
            "name": file_name,
            "duration": round(duration_sec, 1),
            "channels": audio.channels,
            "sample_rate": audio.frame_rate,
            "size": round(size_mb, 1)
        }
        
        # Кодируем данные для передачи в URL
        json_str = json.dumps(file_data)
        encoded_data = urllib.parse.quote(json_str)
        
        # Создаем ссылку на мини-приложение с данными
        webapp_url = f"https://matergaming.github.io/audio-studio/?start_param={encoded_data}"
        
        # Удаляем сообщение об обработке
        await processing_msg.delete()
        
        # Отправляем информацию о файле
        await update.message.reply_text(
            f"✅ *Файл получен!*\n\n"
            f"📊 *Информация:*\n"
            f"• Длительность: {minutes}:{seconds:02d} мин\n"
            f"• Каналы: {'Стерео' if audio.channels == 2 else 'Моно'}\n"
            f"• Частота: {audio.frame_rate} Гц\n"
            f"• Размер: {size_mb:.1f} MB\n\n"
            f"🎛️ *Нажмите кнопку ниже для обработки:*",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    "🎛️ Открыть студию",
                    web_app=WebAppInfo(url=webapp_url)
                )
            ]]),
            parse_mode='Markdown'
        )
        
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка при обработке файла: {str(e)}")
        print(f"Ошибка: {e}")

# Обработка данных из Mini App
async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        data = json.loads(update.effective_message.web_app_data.data)
        action = data.get('action')
        
        if action == 'save_audio':
            await handle_save_audio(update, context, data)
        elif action == 'apply_effects':
            await handle_apply_effects(update, context, data)
            
    except Exception as e:
        await update.effective_message.reply_text(f"❌ Ошибка: {str(e)}")
        print(f"Ошибка обработки webapp data: {e}")

# Сохранение обработанного аудио
async def handle_save_audio(update: Update, context: ContextTypes.DEFAULT_TYPE, data):
    try:
        audio_data = data.get('audio_data')
        file_format = data.get('format', 'mp3')
        file_name = data.get('file_name', f'processed_audio.{file_format}')
        
        # Отправляем сообщение о начале обработки
        processing_msg = await update.effective_message.reply_text("🔄 Сохраняю обработанное аудио...")
        
        # Декодируем base64
        audio_bytes = base64.b64decode(audio_data)
        
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_format}') as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_path = tmp_file.name
        
        # Отправляем файл пользователю
        with open(tmp_path, 'rb') as f:
            await update.effective_message.reply_audio(
                audio=f,
                filename=file_name,
                title=f"Обработанное аудио",
                performer="Audio Studio Bot"
            )
        
        # Удаляем временный файл
        os.unlink(tmp_path)
        
        # Удаляем сообщение об обработке
        await processing_msg.delete()
        
        # Отправляем подтверждение
        await update.effective_message.reply_text(
            "✅ Аудио успешно обработано и отправлено!\n"
            "Хотите обработать еще один файл? Просто отправьте его мне."
        )
        
    except Exception as e:
        await update.effective_message.reply_text(f"❌ Ошибка при сохранении: {str(e)}")
        print(f"Ошибка сохранения: {e}")

# Применение эффектов (предварительная обработка)
async def handle_apply_effects(update: Update, context: ContextTypes.DEFAULT_TYPE, data):
    effects = data.get('effects', {})
    file_id = data.get('file_id')
    
    await update.effective_message.reply_text(
        f"✅ Эффекты применены!\n"
        f"• Громкость: {effects.get('volume', 100)}%\n"
        f"• Скорость: {effects.get('speed', 1.0)}x\n"
        f"• Обрезка: {effects.get('start', 0)}ms - {effects.get('end', 0)}ms\n\n"
        f"Теперь нажмите 'Сохранить' в студии для получения файла."
    )

# Помощь
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("🎵 Открыть студию", web_app=WebAppInfo(
            url="https://ваш-логин.github.io/audio-studio/"
        ))],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "📚 *Как пользоваться ботом:*\n\n"
        "1️⃣ Отправьте мне аудиофайл (MP3, WAV, OGG)\n"
        "2️⃣ Я проанализирую его и покажу информацию\n"
        "3️⃣ Нажмите кнопку 'Открыть студию'\n"
        "4️⃣ В студии вы можете:\n"
        "   • Изменять громкость 🔊\n"
        "   • Регулировать скорость ⚡\n"
        "   • Обрезать аудио ✂️\n"
        "   • Применять эквалайзер 📊\n"
        "   • Добавлять реверберацию 🌊\n"
        "   • Менять тональность 🎼\n"
        "5️⃣ Нажмите 'Сохранить' и получите готовый файл!\n\n"
        "🎯 Все эффекты применяются в реальном времени!",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

# Отмена
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ Операция отменена.")

# Сброс
async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Удаляем временные файлы
    for f in ["temp_audio.ogg", "working_audio.wav", "temp_audio.wav"]:
        if os.path.exists(f):
            os.remove(f)
    
    context.user_data.clear()
    
    keyboard = [[
        InlineKeyboardButton(
            "🎵 Открыть студию", 
            web_app=WebAppInfo(url="https://matergaming.github.io/audio-studio/")
        )
    ]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🔄 *Сессия сброшена!*\n\n"
        "Отправьте новый аудиофайл для обработки.",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

# Обработка ошибок
async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    print(f"Ошибка: {context.error}")
    try:
        await update.message.reply_text(
            "❌ Произошла ошибка. Пожалуйста, попробуйте еще раз или используйте /reset"
        )
    except:
        pass

if __name__ == "__main__":
    print("🚀 Запуск Audio Studio Bot...")
    
    app = ApplicationBuilder().token(TOKEN).build()
    
    # Добавляем обработчики
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(CommandHandler("cancel", cancel))
    
    # Обработка аудиофайлов
    app.add_handler(MessageHandler(filters.AUDIO | filters.VOICE, handle_audio))
    
    # Обработка данных из мини-приложения
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data))
    
    # Обработка ошибок
    app.add_error_handler(error_handler)
    
    print("✅ Бот успешно запущен!")
    print("📢 Нажмите Ctrl+C для остановки")
    
    app.run_polling()
