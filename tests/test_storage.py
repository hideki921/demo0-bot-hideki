from datetime import date

from booking_bot.storage import Booking, BookingRepository


def test_booked_slot_is_not_available(tmp_path):
    repository = BookingRepository(str(tmp_path / "bookings.sqlite3"))
    booking = Booking(
        "haircut", "alex", date(2026, 7, 28), "10:00", "Анна", "+79990000000", 1
    )

    assert repository.create_booking(booking) is True
    assert "10:00" not in repository.available_slots(date(2026, 7, 28), "alex")


def test_duplicate_booking_is_rejected(tmp_path):
    repository = BookingRepository(str(tmp_path / "bookings.sqlite3"))
    booking = Booking(
        "haircut", "alex", date(2026, 7, 28), "10:00", "Анна", "+79990000000", 1
    )

    assert repository.create_booking(booking) is True
    assert repository.create_booking(booking) is False
