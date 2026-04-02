# Runbook

## 1. Установка зависимостей

Из корня `new erra`:

```bash
npm install
```

## 2. Backend API

Перейди в `apps/api`, создай `.env` из примера и заполни PostgreSQL:

```bash
cp .env.example .env
```

Пример обязательных значений:

```env
PORT=4001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/new_erra
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:8081
```

Дальше:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## 3. Мобильное приложение

Перейди в `apps/mobile` и создай `.env`:

```bash
cp .env.example .env
```

Минимум для live-режима:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:4001/v1
```

После этого:

```bash
npm run start
```

Для запуска на устройствах:

```bash
npm run android
npm run ios
```

## 4. Demo и live режимы

Если `EXPO_PUBLIC_API_BASE_URL` не указан, приложение автоматически работает в demo-режиме. Это полезно для быстрого показа интерфейса и сценария:

- регистрация
- анамнез
- ежедневные квесты
- серия дней
- прогресс
- профиль и настройки

Если `EXPO_PUBLIC_API_BASE_URL` указан, мобильный клиент начинает работать с живым API.
