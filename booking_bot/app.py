import os
from datetime import date, timedelta
from html import escape

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    Update,
)
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from booking_bot.catalog import get_services, get_staff_for, slots_for_date
from booking_bot.storage import Booking, BookingRepository

SELECT_SERVICE, SELECT_STAFF, SELECT_DATE, SELECT_TIME, ENTER_NAME, ENTER_PHONE, CONFIRM = range(7)


def format_booking_summary(booking: Booking, service_name: str, staff_name: str) -> str:
    return (
        "<b>Детали записи</b>\n\n"
        f"Услуга: {escape(service_name)}\n"
        f"Специалист: {escape(staff_name)}\n"
        f"Дата: {booking.day:%d.%m.%Y}\n"
        f"Время: {escape(booking.time)}\n"
        f"Клиент: {escape(booking.customer_name)}\n"
        f"Телефон: {escape(booking.phone)}"
    )


def _services_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(service.name, callback_data=f"service:{service.id}")] for service in get_services()]
    )


def _staff_markup(service_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(staff.name, callback_data=f"staff:{staff.id}")] for staff in get_staff_for(service_id)]
    )


def _date_markup() -> InlineKeyboardMarkup:
    days = []
    for offset in range(7):
        day = date.today() + timedelta(days=offset)
        if slots_for_date(day):
            days.append([InlineKeyboardButton(day.strftime("%d.%m (%a)"), callback_data=f"date:{day.isoformat()}")])
    return InlineKeyboardMarkup(days)


def _time_markup(slots: tuple[str, ...]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton(slot, callback_data=f"time:{slot}")] for slot in slots])


def contact_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton("Поделиться контактом", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def _service_name(service_id: str) -> str:
    return next(service.name for service in get_services() if service.id == service_id)


def _staff_name(service_id: str, staff_id: str) -> str:
    return next(staff.name for staff in get_staff_for(service_id) if staff.id == staff_id)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text("Здравствуйте! Выберите услугу для записи:", reply_markup=_services_markup())
    return SELECT_SERVICE


async def select_service(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    service_id = query.data.removeprefix("service:")
    context.user_data["service_id"] = service_id
    await query.edit_message_text("Выберите специалиста:", reply_markup=_staff_markup(service_id))
    return SELECT_STAFF


async def select_staff(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["staff_id"] = query.data.removeprefix("staff:")
    await query.edit_message_text("Выберите дату:", reply_markup=_date_markup())
    return SELECT_DATE


async def select_date(update: Update, context: ContextTypes.DEFAULT_TYPE, repository: BookingRepository) -> int:
    query = update.callback_query
    await query.answer()
    selected_day = date.fromisoformat(query.data.removeprefix("date:"))
    context.user_data["day"] = selected_day
    slots = repository.available_slots(selected_day, context.user_data["staff_id"])
    if not slots:
        await query.edit_message_text("На эту дату свободных слотов нет. Выберите другую:", reply_markup=_date_markup())
        return SELECT_DATE
    await query.edit_message_text("Выберите свободное время:", reply_markup=_time_markup(slots))
    return SELECT_TIME


async def select_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["time"] = query.data.removeprefix("time:")
    await query.edit_message_text("Как вас зовут?")
    return ENTER_NAME


async def enter_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["customer_name"] = update.message.text.strip()
    await update.message.reply_text("Отправьте номер телефона или нажмите «Поделиться контактом».", reply_markup=contact_keyboard())
    return ENTER_PHONE


async def enter_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    contact = update.message.contact
    phone = contact.phone_number if contact else update.message.text.strip()
    context.user_data["phone"] = phone
    booking = Booking(
        context.user_data["service_id"],
        context.user_data["staff_id"],
        context.user_data["day"],
        context.user_data["time"],
        context.user_data["customer_name"],
        phone,
        update.effective_chat.id,
    )
    summary = format_booking_summary(
        booking,
        _service_name(booking.service_id),
        _staff_name(booking.service_id, booking.staff_id),
    )
    context.user_data["booking"] = booking
    buttons = InlineKeyboardMarkup(
        [[InlineKeyboardButton("Подтвердить", callback_data="confirm"), InlineKeyboardButton("Начать заново", callback_data="restart")]]
    )
    await update.message.reply_text(summary + "\n\nПодтверждаете запись?", parse_mode="HTML", reply_markup=ReplyKeyboardRemove())
    await update.message.reply_text("Выберите действие:", reply_markup=buttons)
    return CONFIRM


async def confirm_booking(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    repository: BookingRepository,
    owner_chat_id: int,
) -> int:
    query = update.callback_query
    await query.answer()
    if query.data == "restart":
        context.user_data.clear()
        await query.edit_message_text("Выберите услугу для записи:", reply_markup=_services_markup())
        return SELECT_SERVICE
    booking = context.user_data["booking"]
    if not repository.create_booking(booking):
        slots = repository.available_slots(booking.day, booking.staff_id)
        if not slots:
            await query.edit_message_text(
                "Этот слот уже заняли. Выберите другую дату:", reply_markup=_date_markup()
            )
            return SELECT_DATE
        await query.edit_message_text("Этот слот уже заняли. Выберите другое время:", reply_markup=_time_markup(slots))
        return SELECT_TIME
    summary = format_booking_summary(
        booking,
        _service_name(booking.service_id),
        _staff_name(booking.service_id, booking.staff_id),
    )
    await query.edit_message_text("Запись подтверждена. До встречи!")
    await context.bot.send_message(owner_chat_id, "<b>Новая запись</b>\n\n" + summary, parse_mode="HTML")
    context.user_data.clear()
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text("Запись отменена. Чтобы начать снова, используйте /start.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END


def build_application(token: str, repository: BookingRepository, owner_chat_id: int) -> Application:
    application = Application.builder().token(token).build()
    conversation = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            SELECT_SERVICE: [CallbackQueryHandler(select_service, pattern=r"^service:")],
            SELECT_STAFF: [CallbackQueryHandler(select_staff, pattern=r"^staff:")],
            SELECT_DATE: [CallbackQueryHandler(lambda u, c: select_date(u, c, repository), pattern=r"^date:")],
            SELECT_TIME: [CallbackQueryHandler(select_time, pattern=r"^time:")],
            ENTER_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, enter_name)],
            ENTER_PHONE: [MessageHandler((filters.CONTACT | filters.TEXT) & ~filters.COMMAND, enter_phone)],
            CONFIRM: [CallbackQueryHandler(lambda u, c: confirm_booking(u, c, repository, owner_chat_id), pattern=r"^(confirm|restart)$")],
        },
        fallbacks=[CommandHandler("cancel", cancel), CommandHandler("start", start)],
    )
    application.add_handler(conversation)
    return application


def main() -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    owner_chat_id = int(os.environ["OWNER_CHAT_ID"])
    repository = BookingRepository("data/bookings.sqlite3")
    build_application(token, repository, owner_chat_id).run_polling()


if __name__ == "__main__":
    main()
