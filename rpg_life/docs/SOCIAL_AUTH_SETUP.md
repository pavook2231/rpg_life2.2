# Social Auth Setup

Этот документ нужен, чтобы подключить вход через `Google`, `Telegram` и `Yandex` без хаоса.

## Что уже подготовлено в проекте

- backend знает список провайдеров и их конфиг из `.env`
- в БД есть отдельная таблица под привязки соцаккаунтов
- mobile login screen уже показывает кнопки провайдеров
- mobile и backend уже умеют обмениваться списком доступных провайдеров

Сейчас не реализована только самая внешняя часть:
- получение токена у провайдера на клиенте
- серверная проверка токена провайдера
- создание или привязка пользователя по этим данным

## Порядок подключения

### 1. Google

1. Создать проект в Google Cloud.
2. Включить `Google Identity`.
3. Создать OAuth client для mobile/web.
4. Получить `client id`.
5. Вписать в `.env`:

```env
GOOGLE_AUTH_ENABLED=true
GOOGLE_AUTH_MOBILE_CLIENT_ID=...
GOOGLE_AUTH_CLIENT_SECRET=...
```

6. На mobile добавить Expo/AuthSession или Google Sign-In SDK.
7. Отправлять `id_token` на `/api/v1/auth/social`.
8. На backend валидировать `id_token`, искать или создавать `UserSocialAccount`.

### 2. Telegram

1. Создать бота через `@BotFather`.
2. Получить `bot token`.
3. Выбрать username бота.
4. Вписать в `.env`:

```env
TELEGRAM_AUTH_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
```

5. Для mobile выбрать способ входа:
   - через Telegram Login Widget в web-flow
   - или через mini app / deep link сценарий
6. Передавать на backend `init_data` или подписанные данные Telegram.
7. На backend проверять подпись Telegram и создавать/привязывать `UserSocialAccount`.

Что уже готово сейчас:

- backend уже умеет проверять Telegram-подпись по `init_data`
- поддержаны оба частых формата: Telegram Login и Telegram Mini App/WebApp
- если подпись валидна, сервер создаст или привяжет локального пользователя
- mobile login уже умеет открыть бота по username

Что осталось для полного end-to-end входа:

1. Настроить у бота реальный auth flow через домен или mini app.
2. Вернуть подписанные Telegram данные обратно в приложение по deep link:

```text
rpglife://auth/telegram?init_data=...
```

3. Использовать backend bridge endpoint:

```text
/api/v1/auth/telegram/bridge
```

Он принимает Telegram query string и редиректит в:

```text
rpglife://auth/telegram?init_data=...
```

4. Передать эти данные в `/api/v1/auth/social` как `init_data`.
5. Получить обычные JWT токены RPG Life.

### 3. Yandex

1. Создать приложение в Yandex OAuth.
2. Получить `client id` и `secret`.
3. Вписать в `.env`:

```env
YANDEX_AUTH_ENABLED=true
YANDEX_AUTH_MOBILE_CLIENT_ID=...
YANDEX_AUTH_CLIENT_SECRET=...
```

4. На mobile поднять OAuth flow через browser/AuthSession.
5. Отправлять `authorization_code` или `access_token` на backend.
6. На backend обменивать код на профиль пользователя Yandex.
7. Создавать или привязывать `UserSocialAccount`.

## Как начать прямо сейчас

Самый простой старт:

1. Сначала сделать `Google`.
2. После него повторить ту же схему для `Yandex`.
3. `Telegram` оставить третьим, потому что он обычно требует больше ручной логики.

## Что будем делать в следующем шаге разработки

### Google first pass

1. Добавим Expo `AuthSession`.
2. Получим `id_token` после входа.
3. Отправим его на backend.
4. На backend проверим токен Google.
5. Создадим или найдем локального пользователя.
6. Вернем обычные JWT `access/refresh` токены твоего приложения.

Именно после этого соцвход станет рабочим end-to-end.

### Telegram next pass

1. Создать у бота команду или mini app entry для `rpglife_login`.
2. Настроить возврат в приложение по deep link `rpglife://auth/telegram?init_data=...`.
3. Передавать Telegram `init_data` в mobile экран входа.
4. Отправлять `init_data` на backend.
5. Получать обычный вход в RPG Life без пароля.
