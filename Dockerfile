FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY booking_bot ./booking_bot

CMD ["python", "-m", "booking_bot.app"]
