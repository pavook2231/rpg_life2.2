# Deploy на VDS

## Важный принцип

На VDS для `New Erra` нужно поднимать только backend API и базу данных. Само мобильное приложение не живёт на сервере: оно ставится на iPhone и Android и обращается к API по HTTPS.

## Почему это безопасно рядом с двумя уже существующими приложениями

- у `New Erra` отдельная папка
- отдельный compose-файл
- отдельный project name
- отдельная PostgreSQL внутри этого стека
- API слушает только `127.0.0.1`
- наружу его отдаёт твой текущий nginx по отдельному домену или поддомену

## Рекомендуемая схема

- проект на сервере: `/opt/new-erra`
- compose project: `new-erra`
- backend порт на хосте: `127.0.0.1:4011`
- внешний домен: например `api.new-erra.ru`

## Подготовка

В папке проекта создай `.env.vds` из шаблона:

```bash
cp .env.vds.example .env.vds
```

Заполни:

```env
NEW_ERRA_API_PORT=4011
NEW_ERRA_POSTGRES_DB=new_erra
NEW_ERRA_POSTGRES_USER=new_erra
NEW_ERRA_POSTGRES_PASSWORD=change-me-please
NEW_ERRA_JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
NEW_ERRA_CORS_ORIGIN=https://app.example.com
```

## Запуск

```bash
docker compose --env-file .env.vds -f docker-compose.vds.yml -p new-erra up -d --build
```

## Проверка

```bash
docker compose --env-file .env.vds -f docker-compose.vds.yml -p new-erra ps
docker compose --env-file .env.vds -f docker-compose.vds.yml -p new-erra logs --tail=200 api
curl http://127.0.0.1:4011/v1/health
```

## Обновление

```bash
git pull origin main
docker compose --env-file .env.vds -f docker-compose.vds.yml -p new-erra up -d --build
```

## Пример nginx

```nginx
server {
    server_name api.new-erra.ru;

    location / {
        proxy_pass http://127.0.0.1:4011;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Мобильный клиент

В `apps/mobile/.env` укажи:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.new-erra.ru/v1
```

После этого мобильное приложение начнёт работать уже не в demo-режиме, а с живым VDS API.
