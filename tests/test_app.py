from datetime import date

from booking_bot.app import contact_keyboard, format_booking_summary
from booking_bot.storage import Booking


def test_booking_summary_contains_all_client_details():
    booking = Booking(
        "haircut", "alex", date(2026, 7, 28), "10:00", "Анна", "+79990000000", 1
    )

    summary = format_booking_summary(booking, "Стрижка", "Алексей")

    assert "Стрижка" in summary
    assert "Алексей" in summary
    assert "28.07.2026" in summary
    assert "10:00" in summary
    assert "Анна" in summary
    assert "+79990000000" in summary


def test_booking_summary_escapes_html_from_customer_input():
    booking = Booking(
        "haircut", "alex", date(2026, 7, 28), "10:00", "<Анна>", "+79990000000", 1
    )

    summary = format_booking_summary(booking, "Стрижка", "Алексей")

    assert "&lt;Анна&gt;" in summary


def test_contact_keyboard_requests_telegram_contact():
    button = contact_keyboard().keyboard[0][0]

    assert button.request_contact is True
