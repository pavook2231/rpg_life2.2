# Render Deploy

Самый простой путь для `RPG Life` на Render уже подготовлен через [`render.yaml`](/d:/rpg_life_clean/rpg_life/render.yaml).

## Что создаст Render

- `rpg-life-api` - web service
- `rpg-life-db` - Postgres
- `rpg-life-redis` - Redis / Key Value
- `rpg-life-celery-worker` - фоновые задачи
- `rpg-life-celery-beat` - планировщик

## Как запустить

1. Залей проект в GitHub.
2. Открой Render.
3. Нажми `New +` -> `Blueprint`.
4. Подключи GitHub-репозиторий с этим проектом.
5. Render сам увидит [`render.yaml`](/d:/rpg_life_clean/rpg_life/render.yaml).
6. Подтверди создание сервисов.

## Что нужно заполнить в Render вручную

В `rpg-life-api` и worker-сервисах:

- `SECRET_KEY`
- `TELEGRAM_AUTH_ENABLED=true`
- `TELEGRAM_BOT_TOKEN=...`
- `TELEGRAM_BOT_USERNAME=...`

Опционально позже:

- `EXPO_PUSH_ACCESS_TOKEN`
- `GOOGLE_AUTH_ENABLED`
- `GOOGLE_AUTH_MOBILE_CLIENT_ID`
- `GOOGLE_AUTH_CLIENT_SECRET`
- `YANDEX_AUTH_ENABLED`
- `YANDEX_AUTH_MOBILE_CLIENT_ID`
- `YANDEX_AUTH_CLIENT_SECRET`

## Что сделать после первого деплоя

1. Открыть:

```text
https://<твой-render-url>/healthz
```

2. Проверить, что API отвечает `status: ok`.

3. Подключить custom domain:

```text
beta-api.rpglife.ru
```

4. После подключения домена проверить:

```text
https://beta-api.rpglife.ru/healthz
https://beta-api.rpglife.ru/api/v1/auth/telegram/bridge
```

## Что важно

- Для Telegram нужен публичный `HTTPS` домен.
- Для первой беты Render подходит лучше, чем VPS, если хочется меньше ручной настройки.
- Если Blueprint на Render ругнется на какой-то параметр, пришли мне текст ошибки, и я быстро подгоню [`render.yaml`](/d:/rpg_life_clean/rpg_life/render.yaml) под их формат.
