# Полноценная синхронизация с приложениями здоровья

## Обзор изменений

Приложение теперь поддерживает полноценную синхронизацию шагов с:
- **iOS**: HealthKit (через react-native-health)
- **Android**: Google Fit (через react-native-google-fit)

## Добавленные зависимости

- `react-native-health`: ^1.19.0
- `react-native-google-fit`: ^0.22.1

## Изменения в коде

### pedometer.ts
- Добавлена инициализация HealthKit для iOS
- Добавлена инициализация Google Fit для Android
- Функции `getTodaySteps()` и `watchTodaySteps()` теперь сначала пытаются получить данные из приложений здоровья
- Fallback на expo-sensors если health apps недоступны

### GameContext.tsx
- Обновлена логика определения источника шагов:
  - iOS: "healthkit"
  - Android: "googlefit"
  - Другие: "pedometer"

### app.json
- Добавлены разрешения для iOS (NSHealthShareUsageDescription, NSHealthUpdateUsageDescription)
- Добавлены разрешения для Android (BODY_SENSORS, ACTIVITY_RECOGNITION)

## Как это работает

1. При запуске приложения проверяется доступность HealthKit/Google Fit
2. Если доступен, запрашиваются шаги за текущий день
3. Данные синхронизируются с сервером с соответствующим source
4. Если health apps недоступны, используется expo-sensors как fallback

## Тестирование

- Убедитесь, что на устройстве установлены и настроены приложения здоровья
- Предоставьте разрешения при первом запуске
- Шаги должны автоматически синхронизироваться с сервером