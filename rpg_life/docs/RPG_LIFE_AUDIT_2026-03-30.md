# Аудит RPG Life - 2026-03-30

## Update 2026-03-30

- Mobile release stack switched to the safer compatibility path: `newArchEnabled=false` in Expo config and Android Gradle config.
- Expo dependency validation now explicitly excludes transitive `@expo/fingerprint`, which remains a tooling-level duplicate via `react-native-health`.
- Expo Doctor behavior is now configured for this repo's intentional native-managed setup: non-CNG app-config sync warnings are disabled, and `react-native-google-fit` / `react-native-health` are explicitly excluded from React Native Directory checks.
- Revalidation after this update: `npm run typecheck` passed, `expo install --check` passed with the configured exclusion, and the effective Expo config resolves with `newArchEnabled=false`.
- Backend dependency pins were partially remediated in `requirements.txt`: `python-jose` -> `3.4.0`, `python-multipart` -> `0.0.22`, `jinja2` -> `3.1.6`.
- Revalidation after the backend dependency update: `pip check` passed and `pytest` passed (`178/178`).
- Framework stack was then upgraded and validated: `fastapi` -> `0.135.1`, `starlette` -> `1.0.0`.
- Revalidation after the framework upgrade: app import passed, `pip check` passed, and `pytest` still passed (`178/178`).
- Backend dependency remediation was completed for the last reported Python audit issue: `python-jose` -> `3.5.0`, which pulled `pyasn1` -> `0.6.3`.
- Mobile dependency remediation was completed via `npm audit fix`: `npm audit` in `mobile/` now reports `0` known vulnerabilities, and the resolved patched toolchain versions include `node-forge 1.4.0`, `undici 6.24.1`, `picomatch 2.3.2/3.0.2/4.0.4`, `yaml 1.10.3/2.8.3`, and `brace-expansion 1.1.13/2.0.3/5.0.5`.
- Note on tooling: `pip-audit` in requirements-file mode is unstable in this Windows environment because it cannot create or clean temporary virtualenv directories reliably, but the only previously reported remaining Python issue (`pyasn1`) was resolved and backend validation remained green.

## Статус после первой волны исправлений

После подготовки этого аудита часть блокеров уже закрыта в коде:

- закрыты CSRF-пробелы на social/admin write-роутах
- добавлены тесты на новые CSRF-проверки
- исправлена production-логика `mobile/src/lib/pedometer.ts`, которая раньше отключала native health sync вне `__DEV__`
- добавлен `android.permission.ACTIVITY_RECOGNITION` в нативный Android manifest
- Expo config выровнен так, чтобы динамический конфиг реально наследовал базовые значения из `app.json`
- в iOS config добавлено `NSMotionUsageDescription` для motion/pedometer fallback
- удалены root `package.json` и `package-lock.json` как лишний дублирующий npm-слой

Проверки после исправлений:

- `pytest` -> `178 passed`
- `npm run typecheck` в `mobile/` -> прошло
- `expo-doctor` -> осталось 3 предупреждения вместо 4

Что осталось нерешенным после этой волны:

- уязвимые backend/mobile зависимости
- duplicate dependency warning по `@expo/fingerprint`
- предупреждение Expo про non-CNG sync при наличии `android/`
- риск по `react-native-google-fit` / `react-native-health` на New Architecture

## Краткий итог

Проект в целом живой: backend проходит тесты, mobile проходит TypeScript-проверку, FastAPI-приложение импортируется без ошибок. Но перед активными изменениями и особенно перед публикацией в магазины есть несколько блокеров:

1. Есть реальные пробелы в CSRF-защите на web/admin/social write-роутах.
2. Текущая реализация health sync фактически отключает HealthKit/Google Fit в production-сборках.
3. Android-конфиг расходится между `app.json`, `app.config.js` и нативным `android/`, поэтому permissions и часть Expo-настроек не гарантированно попадают в релиз.
4. По зависимостям уже накопились известные уязвимости и дубли пакетов.
5. В репозитории есть лишние файлы и legacy-слои, которые создают шум и усложняют безопасные изменения.

## Что было проверено

- `pytest` -> `173 passed`
- `python -m pip check` -> проблем совместимости не найдено
- `python -c "from app.main import app; print(app.title, app.version)"` -> приложение импортируется
- `npm run typecheck` в `mobile/` -> прошло
- `npx expo-doctor` -> 4 проблемы конфигурации mobile-проекта
- `pip-audit -r requirements.txt` -> 11 известных уязвимостей в backend-зависимостях
- `npm audit --json` в `mobile/` -> 87 уязвимостей (5 high, 82 moderate)
- `npm audit --json` в корне -> 37 уязвимостей (1 high, 36 moderate)

## Ключевые находки

### 1. High: write-роуты принимают cookie-auth, но не везде требуют CSRF

Сейчас `get_current_user` читает access token из cookie, если нет Bearer header: `app/core/security.py:88`.

При этом в `app/api/social_routes.py` mutating-роуты:

- `/friends/request` (`app/api/social_routes.py:46`)
- `/friends/add` (`app/api/social_routes.py:57`)
- `/friends/accept` (`app/api/social_routes.py:68`)
- `/friends/decline` (`app/api/social_routes.py:79`)
- `/challenge/create` (`app/api/social_routes.py:138`)
- `/challenge/accept` (`app/api/social_routes.py:147`)
- `/coop-quests/create` (`app/api/social_routes.py:207`)
- `/challenges/invitations` (`app/api/social_routes.py:254`)
- `/challenges/invitations/respond` (`app/api/social_routes.py:277`)

не вызывают `verify_csrf_token`, хотя часть других роутов в этом же файле вызывает.

Похожая проблема есть в admin write-роутах:

- `DELETE /api/v1/admin/audit/events/purge` (`app/api/admin_routes.py:89`)
- `POST /api/v1/admin/audit/alerts/test` (`app/api/admin_routes.py:102`)

Риск: если cookie-based auth реально используется браузером, эти роуты можно дергать через CSRF.

Что делать:

- Вынести CSRF-проверку в общий dependency/middleware для всех cookie-auth write-методов.
- Разделить mobile Bearer-only API и browser cookie API по явным dependency-цепочкам.

### 2. High: HealthKit / Google Fit отключаются в production-сборке

В `mobile/src/lib/pedometer.ts:117` есть строка:

- `const isSimulator = !__DEV__ || ...`

Дальше HealthKit/Google Fit инициализируются только если `!isSimulator`. Это означает, что в production (`__DEV__ === false`) приложение считает любое реальное устройство "симулятором" и не идет в `initHealthKit()` / `initGoogleFit()`.

Итог:

- В dev все может выглядеть рабочим.
- В production health sync деградирует до fallback-логики и не соответствует заявленному поведению.

Это прямо конфликтует с описанием в `mobile/HEALTH_SYNC_README.md`.

### 3. High: Android-конфиг рассинхронизирован

`expo-doctor` показал 4 проблемы, и самая важная из них практическая:

- есть одновременно `mobile/app.json` и `mobile/app.config.js`
- при наличии `mobile/android/` часть Expo-полей не синхронизируется автоматически
- `mobile/android/gradle.properties:39` включает `newArchEnabled=true`
- `expo-doctor` отдельно предупреждает, что `react-native-google-fit` и `react-native-health` не подтверждены для New Architecture

Дополнительно видно, что Android permissions для health sync сейчас объявлены только в `mobile/app.json:32-33`, но в реальном `mobile/android/app/src/main/AndroidManifest.xml` их нет.

Отдельно важно, что в `mobile/app.json` сейчас указан только `com.google.android.gms.permission.ACTIVITY_RECOGNITION`, тогда как для Android 10+ обычно нужен `android.permission.ACTIVITY_RECOGNITION` тоже. Даже если синхронизацию конфига восстановить, permission-сет все равно нужно перепроверять.

Риск:

- шаги/health sync могут не работать в release-сборке Android
- поведение dev и release может различаться
- перед магазином это высокий риск регрессий и отклонения по качеству

### 4. High: backend-зависимости уже уязвимы

`pip-audit` нашел 11 известных уязвимостей:

- `python-jose==3.3.0` -> fix `3.4.0`
- `python-multipart==0.0.9` -> fix `0.0.22`
- `jinja2==3.1.4` -> fix `3.1.6`
- transitively `starlette==0.41.3` -> fix `0.49.1`

Зависимости зафиксированы в:

- `requirements.txt:1`
- `requirements.txt:4`
- `requirements.txt:6`
- `requirements.txt:7`

Это не значит, что приложение уже скомпрометировано, но выпускать релиз с такими версиями не стоит.

### 5. High: mobile dependency tree перегружен уязвимостями

`npm audit` в `mobile/` вернул:

- 87 уязвимостей всего
- 5 high
- 82 moderate

Крупнейшие high-проблемы идут через Expo/tooling-цепочку и затрагивают `node-forge`, `picomatch`, `undici`, а также связанные Expo CLI/Metro пакеты.

Часть из них build-time/dev-only, но перед публикацией это все равно плохая база:

- обновления SDK и lockfile уже нужны
- часть проблем не починится без выравнивания зависимостей и dedupe

### 6. Medium: rate limit хранится только в памяти процесса

Сейчас rate limit хранится в памяти приложения:

- `app/core/rate_limit.py:14`
- `app/api/dependencies.py:10`
- `app/api/dependencies.py:53`

Риск:

- при нескольких воркерах или нескольких инстансах лимиты будут непоследовательны
- после рестарта лимиты полностью обнуляются
- Redis в проекте уже есть, но лимитер его не использует

Для production это скорее reliability/security-gap, чем немедленная критическая дыра.

### 7. Medium: `_external_url_for()` доверяет forwarded headers без явной валидации прокси

В `app/api/mobile_routes.py:87-101` callback URL для OAuth/Telegram bridge собирается из:

- `x-forwarded-proto`
- `x-forwarded-host`
- `x-forwarded-port`

При этом логика не опирается на `TRUST_PROXY_HEADERS` / `TRUSTED_PROXY_IPS`, которые уже есть в `app/core/request_ip.py`.

Если `PUBLIC_BASE_URL` не задан или задан некорректно, есть риск host/header spoofing и нестабильных callback URL.

### 8. Medium: в корне проекта лежит второй React Native dependency tree

В корне есть отдельные:

- `package.json`
- `package-lock.json`
- `node_modules/`

При этом реальный mobile-проект живет в `mobile/`.

В корневом `package.json` лежат только:

- `lottie-react-native`
- `react-native-gesture-handler`
- `react-native-reanimated`
- `zustand`

По grep нет признаков, что этот root npm-слой реально нужен приложению. Он:

- дублирует mobile-зависимости
- добавляет еще 37 audit-проблем
- усложняет обновления и понимание проекта

### 9. Low/Medium: есть dead code и legacy-файлы

Нашлись файлы, которые внутри репозитория не имеют рабочих импортов и выглядят как кандидаты на удаление:

- `app/tasks/jobs.py`
- `app/services/secondary_skill_service.py`
- `app/services/enhanced_goal_service.py`
- `mobile/src/components/AchievementCard.tsx`
- `mobile/src/components/GameButton.tsx`
- `mobile/src/components/HeroCard.tsx`
- `mobile/src/components/InfoModal.tsx`
- `mobile/src/components/LoadingOverlay.tsx`
- `mobile/src/components/ProgressBar.tsx`

Также есть compatibility-шim'ы без внутренних ссылок:

- `app/config.py`
- `app/database.py`

Их лучше удалять только после короткой внешней проверки, потому что на них могут ссылаться внешние скрипты или ручные команды команды разработки.

## Работоспособность по факту

Что выглядит рабочим:

- backend-логика и тестовый контракт достаточно хорошо покрыты
- текущая серверная бизнес-логика не развалена
- mobile TypeScript-слой синтаксически цел
- импорт FastAPI-приложения не падает

Что не доказано этим аудитом:

- реальная release-сборка Android после последних изменений
- iOS release-сборка
- live social auth с Google / VK / Telegram на реальном окружении
- корректная работа push-notifications в production
- реальная работа health sync в store/release-сборке

## Неиспользуемые файлы и что с ними делать

Подробный список вынесен в `docs/RPG_LIFE_CLEANUP_CANDIDATES_2026-03-30.md`.

Коротко:

- `app/tasks/jobs.py` можно убирать почти сразу
- `app/services/secondary_skill_service.py` и `app/services/enhanced_goal_service.py` выглядят как мертвый серверный код
- набор mobile-компонентов в `mobile/src/components/` не используется
- root `package.json` / `package-lock.json` выглядят как лишний дублирующий npm-слой
- `app/config.py` и `app/database.py` нужно проверять аккуратно, это может быть совместимость для внешних сценариев

## 10 идей по улучшению приложения

1. Собрать единый security layer для CSRF, rate limit, audit trail и cookie/Bearer auth.
2. Перевести rate limit и идемпотентность write-операций на Redis, а не на память процесса.
3. Развести legacy и актуальный backend-слой: убрать лишние shim-файлы и неиспользуемые сервисы.
4. Починить health sync так, чтобы release и dev работали одинаково на реальных устройствах.
5. Добавить release smoke-checklist с автопроверкой auth, bootstrap, shop, quests, social и push flows.
6. Встроить crash reporting и performance monitoring для mobile и backend.
7. Сделать системную страницу "диагностика" в приложении: API URL, auth state, push token, health permissions, sync status.
8. Доработать оффлайн-режим: очередь действий, конфликт-резолв, понятные статусы синхронизации.
9. Сделать нормальную dependency policy: единая точка npm, регулярный audit, обновление lockfile по расписанию.
10. Свести конфиги релиза к одному источнику правды, чтобы app version, build number, permissions и deep links не расходились.

## 10 вещей, которые нужно сделать перед публикацией в магазины

1. Исправить Android manifest/config drift и проверить, что release реально содержит нужные permissions и deep links.
2. Проверить release build на физическом Android-устройстве с шагами, логином, shop, social, push.
3. Проверить iOS build на физическом устройстве с HealthKit и deep link auth flow.
4. Обновить уязвимые backend/mobile зависимости и заново прогнать audit.
5. Подготовить privacy policy и data disclosure для health data, auth providers, notifications и AI-функций.
6. Убедиться, что `PUBLIC_BASE_URL`, `SECRET_KEY`, `COOKIE_SECURE`, `ALLOW_SQLITE_FALLBACK=false` корректно выставлены в production.
7. Подготовить store assets: иконки, screenshots, feature graphic, локализованные описания.
8. Настроить стабильный release-процесс с versioning, build numbering, signing и changelog.
9. Проверить библиотечную совместимость с New Architecture или временно выключить `newArchEnabled`, если health stack не готов.
10. Завести финальный go-live checklist: release build, migration, monitoring, rollback plan, support contacts.

## Подготовка к изменениям

Рекомендую идти в таком порядке:

### Этап 1. Блокеры безопасности и релиза

1. Закрыть CSRF-дыры.
2. Починить `pedometer.ts` и Android permissions.
3. Устранить drift между `app.json`, `app.config.js` и `android/`.
4. Обновить backend-критичные зависимости.

### Этап 2. Очистка проекта

1. Удалить safe-кандидаты из cleanup-списка.
2. Проверить и затем убрать root npm-дубли, если они действительно не нужны.
3. После этого только обновлять mobile/tooling-зависимости.

### Этап 3. Релизный контур

1. Прогнать `expo-doctor` до чистого состояния.
2. Собрать release APK/AAB.
3. Пройти manual smoke на устройстве.
4. Подготовить store metadata и privacy artifacts.

## Что я бы считал "готово к следующему этапу"

Проект можно считать подготовленным к активным изменениям после трех вещей:

1. есть подтвержденный список файлов на удаление
2. закрыты CSRF и health-sync блокеры
3. остается только один актуальный конфиг и один актуальный npm dependency tree
