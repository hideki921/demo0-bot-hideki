# Демо-бот записи на Cloudflare Workers

Это статeless-демо: бот проводит клиента по кнопкам выбора услуги, мастера, даты и времени, но не хранит настоящие записи и не проверяет занятые слоты.

## Публикация

1. Зарегистрируйтесь в Cloudflare и откройте Workers & Pages.
2. Создайте Worker, загрузите содержимое папки `cloudflare-worker` в GitHub и подключите репозиторий к Worker.
3. В настройках Worker добавьте секреты:
   - `TELEGRAM_BOT_TOKEN`
   - `OWNER_CHAT_ID`
   - `WEBHOOK_SECRET` — длинная случайная строка.
4. После публикации получите адрес Worker вида `https://booking-demo-bot.<subdomain>.workers.dev`.
5. Откройте в браузере адрес:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://booking-demo-bot.<subdomain>.workers.dev&secret_token=<WEBHOOK_SECRET>
```

Замените `<TOKEN>`, адрес Worker и `<WEBHOOK_SECRET>` на свои значения. Затем напишите `/start` своему боту.

Не добавляйте токен и webhook-secret в код или GitHub.
