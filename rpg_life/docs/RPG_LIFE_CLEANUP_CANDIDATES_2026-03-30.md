# Cleanup Candidates - 2026-03-30

## Статус

Следующие safe-кандидаты уже удалены после аудита и не требуют повторной проверки:

- `app/tasks/jobs.py`
- `app/services/secondary_skill_service.py`
- `app/services/enhanced_goal_service.py`
- `mobile/src/components/AchievementCard.tsx`
- `mobile/src/components/GameButton.tsx`
- `mobile/src/components/HeroCard.tsx`
- `mobile/src/components/InfoModal.tsx`
- `mobile/src/components/LoadingOverlay.tsx`
- `mobile/src/components/ProgressBar.tsx`
- root `package.json`
- root `package-lock.json`
- root `node_modules/`
- `.audit_tools/`
- `celerybeat-schedule`

Ниже список файлов и артефактов, которые выглядят лишними по результатам grep-аудита. Я их не удалял, только подготовил список и разделил по уровню уверенности.

## Почти безопасно удалять

### Сервер

- `app/tasks/jobs.py`
  Причина: файл только реэкспортирует задачи; внутренних импортов на него не найдено.

- `app/services/secondary_skill_service.py`
  Причина: внутренних ссылок по репозиторию не найдено.

- `app/services/enhanced_goal_service.py`
  Причина: внутренних ссылок по репозиторию не найдено; выглядит как legacy/experimental ветка модели целей.

### Mobile

- `mobile/src/components/AchievementCard.tsx`
  Причина: найдено только объявление компонента, импортов нет.

- `mobile/src/components/GameButton.tsx`
  Причина: найдено только объявление компонента, импортов нет.

- `mobile/src/components/HeroCard.tsx`
  Причина: найдено только объявление компонента, импортов нет.

- `mobile/src/components/InfoModal.tsx`
  Причина: это re-export, внутренних импортов нет.

- `mobile/src/components/LoadingOverlay.tsx`
  Причина: найдено только объявление компонента, импортов нет.

- `mobile/src/components/ProgressBar.tsx`
  Причина: найдено только объявление компонента, импортов нет.

## Удалять после короткой внешней проверки

- `app/config.py`
  Причина: внутри репозитория не используется, но это compatibility shim.

- `app/database.py`
  Причина: внутри репозитория не используется, но это compatibility shim.

- `mobile/HEALTH_SYNC_README.md`
  Причина: документ нигде не ссылается из кода; возможно полезен как техзаметка, но не влияет на runtime.

## Частично выполнено: дублирующий npm-слой

- root `package.json` удален
- root `package-lock.json` удален
- root `node_modules/` пока не удалялся, потому что это локальный артефакт и его лучше чистить отдельно

Причина:

- реальный mobile-проект живет в `mobile/`
- корневой npm-слой дублирует React Native-зависимости
- внутренних признаков использования root npm-слоя не найдено
- этот слой добавляет отдельные audit-проблемы и путает сопровождение

Осталось при необходимости:

1. удалить root `node_modules/`
2. заново прогнать `npm audit` и `npm ls` только в `mobile/`

## Локальные артефакты, которые можно чистить по необходимости

Эти файлы не относятся к исходникам и не должны считаться частью приложения:

- `app.db`

Удалять их можно только с учетом локального workflow:

- `app.db` может быть нужен как dev fallback

## Предлагаемый порядок удаления

1. Удалить явно мертвые mobile-компоненты.
2. Удалить `app/tasks/jobs.py`.
3. Удалить `app/services/secondary_skill_service.py` и `app/services/enhanced_goal_service.py`.
4. Отдельно подтвердить судьбу `app/config.py` и `app/database.py`.
5. После этого убрать root npm-слой целиком, если команда его не использует.

## Что удалить без подтверждения я не рекомендую

- `mobile/android/app/debug.keystore`
  Причина: это debug-артефакт Android-проекта, а не явный мертвый файл.

- любые файлы из `mobile/android/`, кроме явно пересобираемых build-артефактов
  Причина: там уже есть кастомная нативная конфигурация.
# Update 2026-03-30

- `app/config.py` and `app/database.py` were verified in runtime and must be kept as compatibility shims.
- Safe local artifacts already cleaned: `app.db`, Python caches, Expo cache, and Android Gradle/build caches inside the repo.
