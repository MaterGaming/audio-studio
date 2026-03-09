from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, filters, ContextTypes
)
from pydub import AudioSegment
import os
import json
import tempfile

TOKEN = "8532102228:AAFZji9fDEgiiSTcQJh485DKhXhEDYVhnz0"

# Этапы ConversationHandler
CHOOSING_EFFECT, PROCESSING = range(2)

# Главное меню с кнопкой Mini App
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton(
            "🎵 Открыть Audio Studio", 
            web_app=WebAppInfo(url="https://your-domain.com/mini-app")  # Замените на ваш URL
        )],
        [InlineKeyboardButton("📱 Помощь", callback_data="help")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎧 *Добро пожаловать в Audio Studio Bot!*\n\n"
        "Нажмите кнопку ниже, чтобы открыть студию обработки аудио.\n"
        "Там вы сможете:\n"
        "• Изменять громкость 🔊\n"
        "• Регулировать скорость ▶️\n"
        "• Обрезать аудио ✂️\n"
        "• Менять формат и качество 🎚️",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

# Обработка данных из Mini App
async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = json.loads(update.effective_message.web_app_data.data)
    action = data.get('action')
    
    if action == 'process_audio':
        # Здесь будет логика обработки аудио
        await update.effective_message.reply_text(
            "✅ Аудио обработано успешно!\n"
            "Файл будет отправлен через несколько секунд..."
        )
        # Добавьте вашу логику обработки аудио

async def handle_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    file = update.message.audio or update.message.voice
    if not file:
        await update.message.reply_text("Пожалуйста, отправьте аудиофайл.")
        return

    file_path = await file.get_file()
    await file_path.download_to_drive("original_audio.ogg")
    context.user_data["audio_path"] = "original_audio.ogg"
    context.user_data["working_audio_path"] = "original_audio.ogg"

    # Сохраняем оригинальные параметры
    audio = AudioSegment.from_file("original_audio.ogg")
    context.user_data.update({
        "original_channels": audio.channels,
        "original_samplewidth": audio.sample_width,
        "original_frame_rate": audio.frame_rate,
        "duration": len(audio)
    })

    # Отправляем информацию о файле
    duration_sec = len(audio) / 1000
    await update.message.reply_text(
        f"✅ Файл получен!\n\n"
        f"📊 Информация:\n"
        f"• Длительность: {duration_sec:.1f} сек\n"
        f"• Каналы: {'Стерео' if audio.channels == 2 else 'Моно'}\n"
        f"• Частота: {audio.frame_rate} Гц\n\n"
        f"Откройте Audio Studio для обработки:",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton(
                "🎛️ Открыть студию",
                web_app=WebAppInfo(url="https://your-domain.com/mini-app")
            )
        ]])
    )

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ Операция отменена.")
    return ConversationHandler.END

async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    for f in ["original_audio.ogg", "working_audio.wav", "final_audio.*"]:
        if os.path.exists(f):
            os.remove(f)
    context.user_data.clear()
    await update.message.reply_text("🔄 Сессия сброшена. Отправьте новый аудиофайл.")

if __name__ == "__main__":
    app = ApplicationBuilder().token(TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(MessageHandler(filters.AUDIO | filters.VOICE, handle_audio))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data))
    
    print("🚀 Бот запущен...")
    app.run_polling()