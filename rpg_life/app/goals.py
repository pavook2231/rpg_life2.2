from __future__ import annotations

DEFAULT_GOAL_TYPE = "personal_development"
DEFAULT_GOAL_TERM_MONTHS = 6
SUPPORTED_GOAL_TERMS = (3, 6, 9)

GOAL_TERMS = {
    3: {
        "id": 3,
        "title": "3 months",
        "ru_title": "3 месяца",
        "tempo": "fast",
        "daily_goal_tasks": 2,
        "weekly_goal_tasks": 1,
        "long_term_goal_tasks": 1,
        "xp_multiplier": 1.1,
    },
    6: {
        "id": 6,
        "title": "6 months",
        "ru_title": "6 месяцев",
        "tempo": "balanced",
        "daily_goal_tasks": 3,
        "weekly_goal_tasks": 1,
        "long_term_goal_tasks": 1,
        "xp_multiplier": 1.0,
    },
    9: {
        "id": 9,
        "title": "9 months",
        "ru_title": "9 месяцев",
        "tempo": "deep",
        "daily_goal_tasks": 3,
        "weekly_goal_tasks": 2,
        "long_term_goal_tasks": 2,
        "xp_multiplier": 0.9,
    },
}

UNIVERSAL_DAILY_TEMPLATES = [
    {
        "id": "universal_steps",
        "title": "Пройти 8000 шагов",
        "description": "Базовая активность для энергии и здоровья.",
        "objective_type": "steps",
        "target_value": 8000,
        "difficulty": "easy",
        "bucket": "daily",
        "base_xp": 40,
        "base_gold": 18,
    },
    {
        "id": "universal_water",
        "title": "Выпить 1.8 литра воды",
        "description": "Поддерживай водный баланс в течение дня.",
        "objective_type": "water_ml",
        "target_value": 1800,
        "difficulty": "easy",
        "bucket": "daily",
        "base_xp": 30,
        "base_gold": 14,
    },
    {
        "id": "universal_reading",
        "title": "Чтение 10 минут",
        "description": "Минимум 10 минут вдумчивого чтения.",
        "objective_type": "reading_minutes",
        "target_value": 10,
        "difficulty": "easy",
        "bucket": "daily",
        "base_xp": 28,
        "base_gold": 12,
    },
    {
        "id": "universal_journal",
        "title": "Заполнить дневник",
        "description": "Запиши мысли, итоги дня или ключевой инсайт.",
        "objective_type": "journal_entry",
        "target_value": 1,
        "difficulty": "easy",
        "bucket": "daily",
        "base_xp": 26,
        "base_gold": 12,
    },
    {
        "id": "universal_plan",
        "title": "Спланировать следующий день",
        "description": "Составь короткий план на завтра.",
        "objective_type": "day_planning",
        "target_value": 1,
        "difficulty": "easy",
        "bucket": "daily",
        "base_xp": 24,
        "base_gold": 10,
    },
]

GOAL_CARDS = {
    "weight_health": {
        "id": "weight_health",
        "title": "Похудение и здоровье",
        "description": "Снижение веса, улучшение формы и здоровые привычки.",
        "result_example": "Минус 4-8 кг, стабильный режим сна и активности.",
        "icon": "run-fast",
        "accent_color": "#2ecc71",
        "recommended_term_months": 6,
        "is_primary": True,
    },
    "new_profession": {
        "id": "new_profession",
        "title": "Освоение новой профессии",
        "description": "Переход в новую сферу через системное обучение и практику.",
        "result_example": "Портфолио, первые заказы или выход на стажировку.",
        "icon": "briefcase-variant-outline",
        "accent_color": "#8b5cf6",
        "recommended_term_months": 9,
        "is_primary": True,
    },
    "financial_growth": {
        "id": "financial_growth",
        "title": "Финансовый рост",
        "description": "Рост дохода, контроль расходов и накопления.",
        "result_example": "Подушка безопасности и рост ежемесячного дохода.",
        "icon": "cash-multiple",
        "accent_color": "#f1c40f",
        "recommended_term_months": 6,
        "is_primary": True,
    },
    "discipline_productivity": {
        "id": "discipline_productivity",
        "title": "Самодисциплина и продуктивность",
        "description": "Режим дня, фокус и системная работа без срывов.",
        "result_example": "Стабильный ритм и рост количества завершенных задач.",
        "icon": "timer-check-outline",
        "accent_color": "#3498db",
        "recommended_term_months": 3,
        "is_primary": True,
    },
    "personal_development": {
        "id": "personal_development",
        "title": "Личностное развитие",
        "description": "Чтение, мышление, навыки и осознанность.",
        "result_example": "Новые навыки, расширенный кругозор и ясный фокус.",
        "icon": "brain",
        "accent_color": "#f39c12",
        "recommended_term_months": 6,
        "is_primary": True,
    },
    "business_building": {
        "id": "business_building",
        "title": "Построение бизнеса",
        "description": "Запуск и развитие собственного дела.",
        "result_example": "MVP продукта и первые продажи.",
        "icon": "office-building-outline",
        "accent_color": "#e67e22",
        "recommended_term_months": 9,
        "is_primary": False,
    },
    "relationships": {
        "id": "relationships",
        "title": "Улучшение отношений",
        "description": "Качество общения, эмпатия и доверие.",
        "result_example": "Больше осознанных контактов и меньше конфликтов.",
        "icon": "account-group-outline",
        "accent_color": "#e91e63",
        "recommended_term_months": 6,
        "is_primary": False,
    },
    "creativity": {
        "id": "creativity",
        "title": "Развитие креативности",
        "description": "Генерация идей и развитие творческой практики.",
        "result_example": "Собственное портфолио и регулярные творческие сессии.",
        "icon": "palette-outline",
        "accent_color": "#9b59b6",
        "recommended_term_months": 6,
        "is_primary": False,
    },
    "language_learning": {
        "id": "language_learning",
        "title": "Изучение языков",
        "description": "Системное развитие словаря, речи и понимания.",
        "result_example": "Уверенное общение и регулярная языковая практика.",
        "icon": "translate",
        "accent_color": "#1abc9c",
        "recommended_term_months": 9,
        "is_primary": False,
    },
}


def _quest(
    title: str,
    description: str,
    objective_type: str,
    target_value: int,
    difficulty: str,
    bucket: str,
    difficulty_phase: int,
    base_xp: int,
    base_gold: int,
) -> dict:
    return {
        "title": title,
        "description": description,
        "objective_type": objective_type,
        "target_value": target_value,
        "difficulty": difficulty,
        "bucket": bucket,
        "difficulty_phase": difficulty_phase,
        "base_xp": base_xp,
        "base_gold": base_gold,
    }


# Goal-specific quest templates. difficulty_phase means the earliest phase
# where this template can appear (1..3).
GOAL_QUEST_LIBRARY = {
    "weight_health": [
        _quest("Прогулка 25 минут", "Быстрый шаг без пауз.", "steps", 5000, "easy", "daily", 1, 32, 12),
        _quest("Утренняя зарядка 10 минут", "Легкая разминка, чтобы разбудить тело.", "training_minutes", 10, "easy", "daily", 1, 28, 10),
        _quest("Собрать сбалансированный прием пищи", "Добавь белок, овощи и убери лишний сахар.", "balanced_meal", 1, "easy", "daily", 1, 26, 10),
        _quest("Не есть за 2 часа до сна", "Поддержи вечерний режим без позднего перекуса.", "evening_food_control", 1, "easy", "daily", 1, 24, 9),
        _quest("Кардио 20 минут", "Бег, велосипед или активная ходьба без длинных пауз.", "training_minutes", 20, "medium", "daily", 2, 46, 16),
        _quest("Силовая тренировка 25 минут", "Сделай короткий комплекс на все тело.", "strength_session", 25, "medium", "daily", 2, 52, 18),
        _quest("Активный день: 9000 шагов", "Добери повышенную активность в течение дня.", "steps", 9000, "medium", "daily", 2, 48, 17),
        _quest("Неделя без сладких напитков", "7 дней без газировки и сладких соков.", "habit_consistency", 7, "hard", "weekly", 2, 120, 44),
        _quest("4 тренировки за неделю", "Набери четыре полноценных занятия за 7 дней.", "weekly_workouts", 4, "hard", "weekly", 2, 132, 48),
        _quest("6 чистых дней питания", "Держи план питания минимум 6 дней из 7.", "clean_eating_days", 6, "hard", "weekly", 2, 128, 46),
        _quest("Стабильный режим сна 14 дней", "Ложиться до заданного времени 14 дней.", "sleep_consistency", 14, "hard", "long_term", 3, 180, 66),
        _quest("20 активных дней за цикл", "Выполни норму шагов или тренировку в 20 днях цикла.", "activity_days", 20, "hard", "long_term", 3, 210, 74),
        _quest("Месяц без срывов в режиме", "Соблюдай базовые привычки питания и движения 30 дней.", "health_habit_cycle", 30, "hard", "long_term", 3, 220, 78),
    ],
    "new_profession": [
        _quest("Изучить одну тему профессии", "Закрой одну новую тему и сделай конспект.", "study_topic", 1, "easy", "daily", 1, 36, 13),
        _quest("Прочитать профильную статью", "Выдели одну полезную статью и выпиши главное.", "industry_reading", 1, "easy", "daily", 1, 28, 10),
        _quest("Собрать словарь из 10 терминов", "Запиши и повтори ключевые понятия новой сферы.", "profession_terms", 10, "easy", "daily", 1, 30, 11),
        _quest("Конспект урока 20 минут", "Перескажи материал своими словами и сохрани заметки.", "lesson_notes", 20, "easy", "daily", 1, 32, 11),
        _quest("Решить 5 практических задач", "Пять небольших заданий по новой теме.", "practice_tasks", 5, "medium", "daily", 2, 52, 18),
        _quest("Практика 40 минут", "Отработай один навык на реальном примере.", "skill_practice_minutes", 40, "medium", "daily", 2, 48, 17),
        _quest("Сделать маленький рабочий результат", "Коммит, макет, текст, прототип или готовый блок работы.", "micro_project_step", 1, "medium", "daily", 2, 54, 19),
        _quest("Собрать мини-проект за неделю", "Готовый прототип с демонстрацией результата.", "project_milestone", 1, "hard", "weekly", 2, 135, 50),
        _quest("3 дня практики без пропуска", "Закрой минимум три учебных сессии за неделю.", "practice_streak", 3, "hard", "weekly", 2, 122, 45),
        _quest("Получить обратную связь на работу", "Покажи результат и получи комментарии от другого человека.", "feedback_request", 1, "hard", "weekly", 2, 126, 46),
        _quest("Портфолио: 2 новых кейса", "Добавь два завершенных кейса в портфолио.", "portfolio_cases", 2, "hard", "long_term", 3, 210, 75),
        _quest("Закрыть крупный учебный модуль", "Заверши один большой блок обучения с практикой.", "course_module", 1, "hard", "long_term", 3, 195, 70),
        _quest("Обновить резюме и профиль", "Подготовь актуальный профиль под новую профессию.", "career_profile_update", 1, "hard", "long_term", 3, 185, 68),
    ],
    "financial_growth": [
        _quest("Записать все расходы за день", "Фиксируй каждую трату без пропусков.", "expense_tracking", 1, "easy", "daily", 1, 30, 11),
        _quest("Проверить остаток бюджета", "Открой бюджет и зафиксируй, сколько доступно до конца периода.", "budget_check", 1, "easy", "daily", 1, 24, 9),
        _quest("Один день без импульсивных трат", "Не покупай ничего вне заранее запланированного списка.", "no_impulse_spend", 1, "easy", "daily", 1, 28, 10),
        _quest("15 минут финансового обучения", "Видео, статья или книга про деньги и доход.", "finance_learning", 15, "easy", "daily", 1, 26, 10),
        _quest("Сделать полезный финансовый шаг", "Оптимизация подписки, тарифов или расходов.", "finance_action", 1, "medium", "daily", 2, 44, 15),
        _quest("Найти один способ заработать", "Проработай одну идею подработки, услуги или продажи.", "income_idea", 1, "medium", "daily", 2, 42, 16),
        _quest("Отложить деньги в накопления", "Сделай один осознанный перевод в резерв или фонд цели.", "savings_transfer", 1, "medium", "daily", 2, 40, 15),
        _quest("Недельный бюджет без перерасхода", "Уложиться в лимит и сохранить остаток.", "weekly_budget", 1, "hard", "weekly", 2, 125, 46),
        _quest("Разбор расходов за 7 дней", "Выдели слабые места и три статьи для оптимизации.", "expense_review", 7, "hard", "weekly", 2, 118, 43),
        _quest("Один шаг к росту дохода", "Отклик, предложение услуги, созвон, публикация или продажа.", "income_growth_step", 1, "hard", "weekly", 2, 130, 48),
        _quest("Целевой фонд: +10% за цикл", "Системно пополняй накопления до целевого роста.", "savings_growth", 10, "hard", "long_term", 3, 190, 70),
        _quest("30 дней финансовой дисциплины", "Веди учет и не выходи за ключевые лимиты в течение месяца.", "finance_discipline_cycle", 30, "hard", "long_term", 3, 205, 74),
        _quest("Подушка безопасности: первый этап", "Собери заранее заданную сумму резерва.", "emergency_fund_milestone", 1, "hard", "long_term", 3, 220, 78),
    ],
    "discipline_productivity": [
        _quest("Три приоритетные задачи дня", "Выдели 3 ключевые задачи и закрой их.", "priority_tasks", 3, "easy", "daily", 1, 34, 12),
        _quest("Начать день вовремя", "Подъем без затяжного откладывания и хаотичного старта.", "on_time_start", 1, "easy", "daily", 1, 24, 9),
        _quest("Один фокус-блок 25 минут", "Без соцсетей и переключений между задачами.", "focus_sessions", 1, "easy", "daily", 1, 28, 10),
        _quest("Разгрузить входящий список", "Разобрать заметки, задачи или письма за 15 минут.", "inbox_cleanup", 15, "easy", "daily", 1, 26, 10),
        _quest("2 сессии фокус-работы по 25 минут", "Без отвлечений и соцсетей.", "focus_sessions", 2, "medium", "daily", 2, 48, 16),
        _quest("90 минут глубокой работы", "Выдели блок на важную задачу и не дроби внимание.", "deep_work_minutes", 90, "medium", "daily", 2, 52, 18),
        _quest("Подготовить план на завтра", "Собери короткий понятный план до конца текущего дня.", "day_planning_plus", 1, "medium", "daily", 2, 40, 14),
        _quest("Неделя без срывов режима", "Соблюдай фиксированное время начала дня.", "routine_consistency", 7, "hard", "weekly", 2, 130, 48),
        _quest("5 дней по плану", "Закрывай дневной план хотя бы в пяти днях недели.", "planned_days", 5, "hard", "weekly", 2, 122, 44),
        _quest("12 фокус-сессий за неделю", "Набери заметный объем сфокусированной работы.", "weekly_focus_sessions", 12, "hard", "weekly", 2, 136, 49),
        _quest("21 день стабильного планирования", "Каждый вечер составляй план на завтра.", "planning_streak", 21, "hard", "long_term", 3, 200, 72),
        _quest("30 дней утреннего режима", "Держи предсказуемое начало дня без хаоса.", "morning_routine_cycle", 30, "hard", "long_term", 3, 215, 76),
        _quest("Собрать собственную систему продуктивности", "Настрой задачи, календарь и еженедельный обзор в одну систему.", "productivity_system", 1, "hard", "long_term", 3, 190, 68),
    ],
    "personal_development": [
        _quest("Чтение 20 минут", "Непрерывное чтение с коротким конспектом.", "reading_minutes", 20, "easy", "daily", 1, 32, 11),
        _quest("Записать 3 мысли дня", "Сохрани важные наблюдения, идеи или выводы.", "reflection_points", 3, "easy", "daily", 1, 24, 9),
        _quest("15 минут познавательного контента", "Лекция, подкаст или полезное видео с заметкой.", "learning_minutes", 15, "easy", "daily", 1, 26, 10),
        _quest("Прогулка без телефона 15 минут", "Оставь шум и дай голове пространство на мысли.", "mindful_walk", 15, "easy", "daily", 1, 24, 9),
        _quest("Практика осознанности 10 минут", "Дыхание, медитация или прогулка без телефона.", "mindfulness_minutes", 10, "medium", "daily", 2, 46, 16),
        _quest("Практика нового навыка 25 минут", "Дай время одному выбранному навыку без переключений.", "skill_practice", 25, "medium", "daily", 2, 44, 15),
        _quest("Конспект одного урока или главы", "Сформулируй главное своими словами.", "lesson_summary", 1, "medium", "daily", 2, 40, 14),
        _quest("Недельный разбор: 7 записей", "Каждый день короткий рефлексивный отчет.", "reflection_entries", 7, "hard", "weekly", 2, 118, 44),
        _quest("Одна глубокая сессия самоанализа", "Выдели 45 минут на честный разбор целей и состояния.", "deep_reflection", 1, "hard", "weekly", 2, 122, 45),
        _quest("Закрыть мини-цикл книги", "Прочитай и законспектируй большой блок выбранной книги.", "book_section_complete", 1, "hard", "weekly", 2, 126, 46),
        _quest("Освоить новый навык до уровня 1", "Пройти базовый курс и выполнить практику.", "skill_unlock", 1, "hard", "long_term", 3, 205, 74),
        _quest("Прочитать книгу до конца", "Выбери одну книгу и доведи ее до финала с заметками.", "finish_book", 1, "hard", "long_term", 3, 190, 69),
        _quest("30 дней осознанной практики", "Собери длинную серию рефлексии, чтения и тишины.", "self_growth_cycle", 30, "hard", "long_term", 3, 212, 76),
    ],
    "business_building": [
        _quest("Описать одну бизнес-гипотезу", "Сформулируй ценность и проблему клиента.", "business_hypothesis", 1, "easy", "daily", 1, 34, 12),
        _quest("Поговорить с одним потенциальным клиентом", "Собери хотя бы один реальный инсайт от аудитории.", "customer_interview", 1, "easy", "daily", 1, 30, 11),
        _quest("Разобрать один пример конкурента", "Посмотри, как похожий продукт показывает ценность и привлекает клиентов.", "competitor_review", 1, "easy", "daily", 1, 32, 11),
        _quest("Сделать один шаг в продукте", "Экран, текст, цена, оффер или прототип.", "business_build_step", 1, "medium", "daily", 2, 46, 16),
        _quest("Подготовить оффер", "Собери понятное описание продукта и результата.", "offer_pack", 1, "medium", "daily", 2, 44, 15),
        _quest("5 касаний с аудиторией за неделю", "Сообщения, публикации, созвоны или диалоги.", "audience_touchpoints", 5, "hard", "weekly", 2, 132, 48),
        _quest("Собрать MVP-блок", "Подготовь рабочий кусок продукта, который можно показать.", "mvp_block", 1, "hard", "weekly", 2, 138, 50),
        _quest("Получить первые деньги", "Дойди до первой продажи или предоплаты.", "first_revenue", 1, "hard", "long_term", 3, 225, 82),
        _quest("Собрать базовую бизнес-систему", "Оффер, канал, продукт и цикл обратной связи в одной структуре.", "business_system", 1, "hard", "long_term", 3, 210, 76),
    ],
    "relationships": [
        _quest("Один теплый контакт", "Напиши или позвони человеку осознанно, а не формально.", "warm_contact", 1, "easy", "daily", 1, 28, 10),
        _quest("Слушать без перебивания 10 минут", "Сделай фокус на собеседнике и его чувствах.", "active_listening", 10, "easy", "daily", 1, 30, 11),
        _quest("Сказать искреннюю благодарность", "Отметь вклад другого человека словами.", "gratitude_social", 1, "easy", "daily", 1, 24, 9),
        _quest("Задать один внимательный вопрос", "Спроси о важном для человека и действительно выслушай ответ.", "supportive_question", 1, "easy", "daily", 1, 28, 10),
        _quest("Один содержательный разговор", "Выдели время на разговор без спешки и телефона.", "meaningful_conversation", 1, "medium", "daily", 2, 42, 15),
        _quest("Три качественных контакта за неделю", "Повтори практику глубокого общения в течение недели.", "quality_contacts", 3, "hard", "weekly", 2, 118, 43),
        _quest("Неделя без резких реакций", "Следи за тоном и не уходи в эмоциональные срывы.", "calm_communication_week", 7, "hard", "weekly", 2, 124, 45),
        _quest("Укрепить важные отношения", "Собери стабильный цикл заботы, внимания и общения.", "relationship_cycle", 1, "hard", "long_term", 3, 198, 71),
        _quest("30 дней осознанного общения", "Регулярно инвестируй время и внимание в близких людей.", "relationship_streak", 30, "hard", "long_term", 3, 208, 74),
    ],
    "creativity": [
        _quest("20 минут творческой практики", "Рисунок, текст, музыка, фото или любая живая работа.", "creative_minutes", 20, "easy", "daily", 1, 30, 11),
        _quest("Одна новая идея", "Запиши и развей хотя бы одну свежую мысль.", "idea_capture", 1, "easy", "daily", 1, 24, 9),
        _quest("Собрать 3 референса", "Найди три вдохновляющих примера под текущую творческую задачу.", "creative_references", 3, "easy", "daily", 1, 28, 10),
        _quest("Сделать один законченный набросок", "Доведи маленькую творческую задачу до формы.", "creative_sketch", 1, "medium", "daily", 2, 42, 15),
        _quest("45 минут без цензуры", "Создавай без оценки и исправлений в процессе.", "free_creation", 45, "medium", "daily", 2, 46, 16),
        _quest("3 творческие сессии за неделю", "Собери ритм и не жди вдохновения.", "creative_sessions_week", 3, "hard", "weekly", 2, 120, 44),
        _quest("Поделиться одной работой", "Покажи результат публично или близкому кругу.", "creative_publish", 1, "hard", "weekly", 2, 126, 46),
        _quest("Собрать мини-портфолио", "Сформируй подборку законченных работ.", "creative_portfolio", 1, "hard", "long_term", 3, 198, 71),
        _quest("30 дней творческого ритма", "Поддерживай регулярную практику без длинных пауз.", "creative_cycle", 30, "hard", "long_term", 3, 210, 75),
    ],
    "language_learning": [
        _quest("Выучить 10 новых слов", "Повтори и закрепи новую лексику.", "new_words", 10, "easy", "daily", 1, 30, 11),
        _quest("15 минут аудирования", "Слушай речь и выпиши незнакомые конструкции.", "listening_minutes", 15, "easy", "daily", 1, 28, 10),
        _quest("Одна короткая письменная практика", "Составь несколько предложений или мини-текст.", "language_writing", 1, "easy", "daily", 1, 26, 10),
        _quest("Поговорить 10 минут", "Голосовая практика, тень или диалог вслух.", "speaking_minutes", 10, "medium", "daily", 2, 44, 15),
        _quest("Разобрать одну грамматическую тему", "Изучи правило и сразу закрепи примерами.", "grammar_topic", 1, "medium", "daily", 2, 42, 15),
        _quest("5 языковых сессий за неделю", "Держи стабильный контакт с языком.", "language_sessions_week", 5, "hard", "weekly", 2, 124, 45),
        _quest("Один мини-диалог без подсказки", "Проведи короткую речь или переписку своими силами.", "dialogue_milestone", 1, "hard", "weekly", 2, 128, 46),
        _quest("Закрыть базовый языковой уровень", "Дойди до устойчивого понимания и практики на ступени.", "language_level_up", 1, "hard", "long_term", 3, 205, 74),
        _quest("30 дней без паузы в языке", "Поддерживай ежедневный контакт без выпадений.", "language_cycle", 30, "hard", "long_term", 3, 214, 77),
    ],
}


def normalize_goal_type(goal_type: str | None) -> str:
    if not goal_type:
        return DEFAULT_GOAL_TYPE
    if goal_type in GOAL_CARDS:
        return goal_type
    aliases = {
        "weight_loss": "weight_health",
        "self_development": "personal_development",
        "productivity": "discipline_productivity",
        "financial_independence": "financial_growth",
        "self_realization": "personal_development",
    }
    mapped = aliases.get(goal_type)
    return mapped if mapped in GOAL_CARDS else DEFAULT_GOAL_TYPE


def normalize_goal_term_months(months: int | None) -> int:
    if months in SUPPORTED_GOAL_TERMS:
        return int(months)
    return DEFAULT_GOAL_TERM_MONTHS


def get_goal_term(months: int | None) -> dict:
    term_months = normalize_goal_term_months(months)
    return GOAL_TERMS[term_months]


def get_goal_info(goal_type: str | None) -> dict:
    normalized = normalize_goal_type(goal_type)
    return GOAL_CARDS[normalized]


def list_goal_cards(include_optional: bool = True) -> list[dict]:
    cards = [card for card in GOAL_CARDS.values() if include_optional or card.get("is_primary", False)]
    return sorted(cards, key=lambda entry: (not entry.get("is_primary", False), entry.get("title", "")))


def get_goal_templates(goal_type: str | None, bucket: str, phase: int) -> list[dict]:
    normalized = normalize_goal_type(goal_type)
    templates = GOAL_QUEST_LIBRARY.get(normalized, GOAL_QUEST_LIBRARY[DEFAULT_GOAL_TYPE])
    current_phase = max(1, min(3, int(phase or 1)))
    return [
        template
        for template in templates
        if template.get("bucket") == bucket and int(template.get("difficulty_phase", 1)) <= current_phase
    ]


GOALS = {
    key: {
        "name": value["title"],
        "icon": value["icon"],
        "description": value["description"],
        "color": value["accent_color"],
        "quests": GOAL_QUEST_LIBRARY.get(key, []),
    }
    for key, value in GOAL_CARDS.items()
}


def get_goal_quests(goal_type: str):
    normalized = normalize_goal_type(goal_type)
    return GOAL_QUEST_LIBRARY.get(normalized, GOAL_QUEST_LIBRARY[DEFAULT_GOAL_TYPE])


def get_all_goals():
    return list(GOAL_CARDS.keys())
