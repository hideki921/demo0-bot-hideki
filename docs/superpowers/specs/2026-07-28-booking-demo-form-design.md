# Booking demo: contact form design

## Goal

Make the Cloudflare-hosted Telegram appointment demo feel like a client-ready portfolio piece while keeping it stateless and free to host.

## User flow

1. `/start` shows:
   `(демо-версия)`
   `Добро пожаловать, <имя>.`
   `Выберите услугу, и мы подберём удобное время.`
2. The user chooses a service, specialist, date, and time through inline buttons.
3. The bot asks for a name, then a phone number.
4. The bot shows the complete booking summary and explicit buttons to confirm or cancel.
5. On confirmation, the user sees a success message and the owner receives all booking details, including name and phone.
6. The completed message offers one `Новая запись` button. Intermediate screens do not offer `Начать заново`.

## Interaction design

- The welcome message has `Записаться` and a URL button leading to `https://t.me/hideki_code`.
- Text-input prompts use Telegram ForceReply, so each answer is tied to the booking data in the preceding bot message.
- An inline `Отменить` button is available while entering contact details and at the final confirmation.
- The confirmation screen is rendered only after both non-empty name and phone have been received.

## Architecture

- Keep the Worker stateless; do not add Redis or a database.
- Encode service, specialist, date, and time in callback data.
- Carry the selected booking and entered name in the text of ForceReply prompts. The reply-to message lets the Worker reconstruct the form state on the next Telegram update.
- Validate that name and phone have non-empty trimmed values before continuing. The demo does not format or verify phone numbers beyond this.
- Remove the temporary public `?health` diagnostic once the deployment is confirmed, so the Worker exposes only its normal health text on GET requests.

## Verification

- Unit tests cover the reply-prompt state encoding and parsing, welcome keyboard, and required name/phone validation.
- Manual Telegram test: `/start` → booking selection → name → phone → confirmation → owner notification → `Новая запись`.
