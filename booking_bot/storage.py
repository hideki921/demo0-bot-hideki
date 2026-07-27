import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from booking_bot.catalog import slots_for_date


@dataclass(frozen=True)
class Booking:
    service_id: str
    staff_id: str
    day: date
    time: str
    customer_name: str
    phone: str
    chat_id: int


class BookingRepository:
    def __init__(self, database_path: str) -> None:
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self.database_path = database_path
        self._create_schema()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database_path)

    def _create_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS bookings (
                    id INTEGER PRIMARY KEY,
                    service_id TEXT NOT NULL,
                    staff_id TEXT NOT NULL,
                    day TEXT NOT NULL,
                    time TEXT NOT NULL,
                    customer_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    chat_id INTEGER NOT NULL,
                    UNIQUE(day, time, staff_id)
                )
                """
            )

    def create_booking(self, booking: Booking) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO bookings
                    (service_id, staff_id, day, time, customer_name, phone, chat_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    booking.service_id,
                    booking.staff_id,
                    booking.day.isoformat(),
                    booking.time,
                    booking.customer_name,
                    booking.phone,
                    booking.chat_id,
                ),
            )
        return cursor.rowcount == 1

    def available_slots(self, day: date, staff_id: str) -> tuple[str, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT time FROM bookings WHERE day = ? AND staff_id = ?",
                (day.isoformat(), staff_id),
            ).fetchall()
        occupied = {row[0] for row in rows}
        return tuple(slot for slot in slots_for_date(day) if slot not in occupied)
