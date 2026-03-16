SYSTEM_QUESTS = [
    # Здоровье
    {
        "title": "Выпить 2 литра воды",
        "description": "Поддерживай водный баланс",
        "xp_reward": 50,
        "crystal_reward": 5,
        "category": "health"
    },
    {
        "title": "10 минут медитации",
        "description": "Практикуй осознанность",
        "xp_reward": 75,
        "crystal_reward": 10,
        "category": "health"
    },
    {
        "title": "Лечь спать до 23:00",
        "description": "Режим сна — залог продуктивности",
        "xp_reward": 100,
        "crystal_reward": 15,
        "category": "health"
    },
    
    # Спорт
    {
        "title": "20 отжиманий",
        "description": "Укрепи мышцы",
        "xp_reward": 80,
        "crystal_reward": 10,
        "category": "sport"
    },
    {
        "title": "Пробежка 3 км",
        "description": "Кардио тренировка",
        "xp_reward": 120,
        "crystal_reward": 15,
        "category": "sport"
    },
    {
        "title": "Растяжка 15 минут",
        "description": "Забота о гибкости",
        "xp_reward": 60,
        "crystal_reward": 8,
        "category": "sport"
    },
    
    # Развитие
    {
        "title": "Прочитать 10 страниц",
        "description": "Инвестируй в знания",
        "xp_reward": 70,
        "crystal_reward": 10,
        "category": "learning"
    },
    {
        "title": "Выучить 5 новых слов",
        "description": "Расширяй словарный запас",
        "xp_reward": 50,
        "crystal_reward": 7,
        "category": "learning"
    },
    {
        "title": "30 минут без телефона",
        "description": "Цифровой детокс",
        "xp_reward": 90,
        "crystal_reward": 12,
        "category": "learning"
    },
    
    # Продуктивность
    {
        "title": "Составить план на день",
        "description": "Планирование — ключ к успеху",
        "xp_reward": 60,
        "crystal_reward": 8,
        "category": "productivity"
    },
    {
        "title": "Разобрать рабочий стол",
        "description": "Порядок вокруг = порядок в голове",
        "xp_reward": 50,
        "crystal_reward": 6,
        "category": "productivity"
    },
    {
        "title": "Ответить на все важные сообщения",
        "description": "Не копи дела",
        "xp_reward": 70,
        "crystal_reward": 9,
        "category": "productivity"
    },
]


def get_system_quests_by_category(category: str = None):
    """Получить системные задания, можно фильтровать по категории"""
    if category:
        return [q for q in SYSTEM_QUESTS if q["category"] == category]
    return SYSTEM_QUESTS


def get_all_system_quests():
    """Получить все системные задания"""
    return SYSTEM_QUESTS


def get_random_system_quest(category: str = None):
    """Получить случайное системное задание"""
    import random
    quests = get_system_quests_by_category(category)
    if quests:
        return random.choice(quests)
    return None