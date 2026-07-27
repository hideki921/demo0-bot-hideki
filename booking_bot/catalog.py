from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Service:
    id: str
    name: str
    duration_minutes: int
    price: int


@dataclass(frozen=True)
class Staff:
    id: str
    name: str


SERVICES = (
    Service("haircut", "Стрижка", 60, 1500),
    Service("coloring", "Окрашивание", 120, 3500),
)

STAFF_BY_SERVICE = {
    "haircut": (Staff("alex", "Алексей"), Staff("maria", "Мария")),
    "coloring": (Staff("maria", "Мария"),),
}


def get_services() -> tuple[Service, ...]:
    return SERVICES


def get_staff_for(service_id: str) -> tuple[Staff, ...]:
    return STAFF_BY_SERVICE.get(service_id, ())


def slots_for_date(day: date) -> tuple[str, ...]:
    if day.weekday() >= 5:
        return ()
    return ("10:00", "12:00", "14:00", "16:00")
