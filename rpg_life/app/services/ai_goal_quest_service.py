from __future__ import annotations

import random
import re

from app.goals import DEFAULT_GOAL_TYPE, get_goal_info, get_goal_templates, normalize_goal_type

_PLACEHOLDER_RE = re.compile(r"{([a-z_]+)}")
_NUMBERED_TEMPLATE_RE = re.compile(r"^\s*(\d+)\s+(.+?)\s*$")

_CATEGORY_ICONS = {
    "activity": "run-fast",
    "water": "cup-water",
    "reading": "book-open-page-variant-outline",
    "meditation": "meditation",
    "journal": "notebook-edit-outline",
}

_CATEGORY_DESCRIPTIONS = {
    "activity": "Физическая активность поддержит темп на пути к выбранной цели.",
    "water": "Водный баланс поможет не проседать по энергии и ритму.",
    "reading": "Полезное чтение укрепляет знания и держит фокус на результате.",
    "meditation": "Короткая пауза на концентрацию поможет сохранить устойчивость и не сорваться.",
    "journal": "Рефлексия и заметки помогают осознанно двигаться к результату.",
}

_GOAL_SUPPORT_PROFILES = {
    "weight_health": {
        "core_target": 6,
        "support_weights": {"activity": 5, "water": 3, "reading": 1, "meditation": 1, "journal": 1},
        "keywords": {
            "activity": ("шаг", "трениров", "кардио", "заряд", "планку", "присед", "берпи", "растяж"),
            "water": ("воду", "газировки", "сладкого", "трениров"),
            "reading": ("по здоровью", "саморазвитию"),
            "meditation": ("расслабление", "дыхание", "спокойствие"),
            "journal": ("цель", "план", "итог", "улучшения"),
        },
    },
    "new_profession": {
        "core_target": 6,
        "support_weights": {"activity": 1, "water": 1, "reading": 4, "meditation": 1, "journal": 3},
        "keywords": {
            "reading": ("обучающей", "по профессии", "статью", "без перерыва"),
            "journal": ("чему научился", "план развития", "цель", "идею проекта", "вывод"),
            "meditation": ("концентрацию", "фокусом", "началом дня"),
        },
    },
    "financial_growth": {
        "core_target": 6,
        "support_weights": {"activity": 1, "water": 1, "reading": 3, "meditation": 1, "journal": 4},
        "keywords": {
            "reading": ("по финансам", "обучающей", "статью"),
            "journal": ("идею бизнеса", "план месяца", "план достижения", "цели", "идею проекта"),
            "meditation": ("спокойствие", "концентрацию"),
        },
    },
    "discipline_productivity": {
        "core_target": 6,
        "support_weights": {"activity": 2, "water": 1, "reading": 2, "meditation": 2, "journal": 4},
        "keywords": {
            "journal": ("план дня", "задачи на завтра", "план недели", "итог дня", "вывод дня"),
            "meditation": ("концентрацию", "началом дня", "после работы", "с таймером"),
            "reading": ("без телефона", "в тишине", "саморазвитию"),
        },
    },
    "personal_development": {
        "core_target": 6,
        "support_weights": {"activity": 1, "water": 1, "reading": 3, "meditation": 2, "journal": 3},
        "keywords": {
            "reading": ("по психологии", "саморазвитию", "художественной", "любимой"),
            "journal": ("мысли", "вывод", "итог", "чему научился", "размышлений"),
            "meditation": ("благодарность", "спокойствие", "дыхание", "концентрацию"),
        },
    },
    "business_building": {
        "core_target": 6,
        "support_weights": {"activity": 1, "water": 1, "reading": 2, "meditation": 1, "journal": 5},
        "keywords": {
            "reading": ("по финансам", "по профессии", "статью"),
            "journal": ("идею бизнеса", "идею проекта", "план достижения", "цели на год", "план месяца"),
            "meditation": ("концентрацию", "началом дня"),
        },
    },
    "relationships": {
        "core_target": 5,
        "support_weights": {"activity": 1, "water": 1, "reading": 1, "meditation": 3, "journal": 4},
        "keywords": {
            "reading": ("по психологии",),
            "journal": ("эмоции", "благодарность другому человеку", "сложный момент", "лучший момент", "мысли"),
            "meditation": ("благодарность", "спокойствие", "расслабление", "дыхание"),
        },
    },
    "creativity": {
        "core_target": 6,
        "support_weights": {"activity": 1, "water": 1, "reading": 2, "meditation": 2, "journal": 4},
        "keywords": {
            "reading": ("художественной", "любимой", "новой книги"),
            "journal": ("идею проекта", "идею развития", "идею", "размышлений"),
            "meditation": ("концентрацию", "на благодарность", "спокойствие"),
        },
    },
    "language_learning": {
        "core_target": 6,
        "support_weights": {"activity": 1, "water": 1, "reading": 4, "meditation": 1, "journal": 3},
        "keywords": {
            "reading": ("без перерыва", "утром", "вечером", "в тишине", "новой книги"),
            "journal": ("чему научился", "план развития", "цель", "мысли"),
            "meditation": ("концентрацию", "дыхание"),
        },
    },
}

_PARAMETER_SPECS = {
    "steps": {
        "kind": "int",
        "objective_type": "steps",
        "easy": (3500, 6500, 500),
        "medium": (7000, 10000, 500),
        "hard": (10500, 15000, 500),
    },
    "km": {
        "kind": "int",
        "objective_type": "walking_km",
        "easy": (3, 5, 1),
        "medium": (5, 8, 1),
        "hard": (8, 10, 1),
    },
    "pushups": {
        "kind": "int",
        "objective_type": "pushups",
        "easy": (10, 20, 2),
        "medium": (22, 36, 2),
        "hard": (38, 60, 2),
    },
    "squats": {
        "kind": "int",
        "objective_type": "squats",
        "easy": (15, 30, 5),
        "medium": (35, 60, 5),
        "hard": (65, 90, 5),
    },
    "lunges": {
        "kind": "int",
        "objective_type": "lunges",
        "easy": (10, 16, 2),
        "medium": (18, 28, 2),
        "hard": (30, 42, 2),
    },
    "situps": {
        "kind": "int",
        "objective_type": "situps",
        "easy": (12, 20, 2),
        "medium": (22, 34, 2),
        "hard": (36, 50, 2),
    },
    "seconds": {
        "kind": "int",
        "objective_type": "plank_seconds",
        "easy": (30, 60, 5),
        "medium": (70, 120, 10),
        "hard": (130, 240, 10),
    },
    "minutes": {
        "kind": "int",
        "objective_type": "duration_minutes",
        "easy": (10, 20, 5),
        "medium": (20, 35, 5),
        "hard": (35, 60, 5),
    },
    "burpees": {
        "kind": "int",
        "objective_type": "burpees",
        "easy": (6, 12, 2),
        "medium": (14, 22, 2),
        "hard": (24, 34, 2),
    },
    "jumping_jacks": {
        "kind": "int",
        "objective_type": "jumping_jacks",
        "easy": (20, 40, 5),
        "medium": (45, 80, 5),
        "hard": (85, 130, 5),
    },
    "floors": {
        "kind": "int",
        "objective_type": "stairs_floors",
        "easy": (4, 8, 1),
        "medium": (8, 12, 1),
        "hard": (12, 18, 1),
    },
    "glasses": {
        "kind": "int",
        "objective_type": "water_glasses",
        "easy": (5, 7, 1),
        "medium": (7, 9, 1),
        "hard": (9, 11, 1),
    },
    "liters": {
        "kind": "float",
        "objective_type": "water_ml",
        "easy": (1.5, 2.0, 0.5),
        "medium": (2.0, 2.5, 0.5),
        "hard": (2.5, 3.0, 0.5),
    },
    "ml": {
        "kind": "int",
        "objective_type": "water_ml",
        "easy": (250, 400, 50),
        "medium": (450, 650, 50),
        "hard": (700, 900, 50),
    },
    "pages": {
        "kind": "int",
        "objective_type": "reading_pages",
        "easy": (6, 10, 1),
        "medium": (11, 20, 1),
        "hard": (21, 32, 1),
    },
    "ideas": {
        "kind": "int",
        "objective_type": "ideas_count",
        "easy": (2, 4, 1),
        "medium": (4, 6, 1),
        "hard": (6, 8, 1),
    },
    "lines": {
        "kind": "int",
        "objective_type": "journal_lines",
        "easy": (4, 8, 1),
        "medium": (8, 12, 1),
        "hard": (12, 18, 1),
    },
}

_SUPPORT_REWARD_BASE = {
    "activity": {"easy": (34, 12), "medium": (56, 16), "hard": (92, 22)},
    "water": {"easy": (24, 9), "medium": (42, 12), "hard": (70, 18)},
    "reading": {"easy": (30, 10), "medium": (50, 14), "hard": (82, 20)},
    "meditation": {"easy": (26, 9), "medium": (44, 12), "hard": (76, 18)},
    "journal": {"easy": (28, 10), "medium": (46, 13), "hard": (78, 19)},
}

_SUPPORT_DIFFICULTY_WEIGHTS = {
    1: {"easy": 0.78, "medium": 0.22, "hard": 0.0},
    2: {"easy": 0.38, "medium": 0.5, "hard": 0.12},
    3: {"easy": 0.2, "medium": 0.5, "hard": 0.3},
}

_AI_TEMPLATE_BLOCKS = {
    "activity": """
1 пройти {steps} шагов
2 пройти {steps} шагов утром
3 пройти {steps} шагов вечером
4 пройти {km} км пешком
5 пройти {km} км быстрым шагом
6 пройти {steps} шагов без лифта
7 пройти {steps} шагов новым маршрутом
8 сделать {pushups} отжиманий
9 сделать {pushups} отжиманий утром
10 сделать {pushups} отжиманий вечером
11 сделать {squats} приседаний
12 сделать {squats} приседаний медленно
13 сделать {squats} приседаний подряд
14 сделать {lunges} выпадов
15 сделать {situps} скручиваний
16 сделать планку {seconds} секунд
17 сделать планку {minutes} минут
18 сделать тренировку {minutes} минут
19 сделать кардио {minutes} минут
20 сделать растяжку {minutes} минут
21 сделать зарядку {minutes} минут
22 сделать тренировку ног {minutes} минут
23 сделать тренировку пресса {minutes} минут
24 сделать тренировку спины {minutes} минут
25 сделать тренировку всего тела {minutes} минут
26 сделать HIIT тренировку {minutes} минут
27 сделать {burpees} берпи
28 сделать {jumping_jacks} прыжков
29 подняться по лестнице {floors} этажей
30 пройти {steps} шагов за один час
31 пройти {steps} шагов до обеда
32 пройти {steps} шагов после ужина
33 пройти {km} км в парке
34 пройти {km} км на природе
35 сделать тренировку дома {minutes} минут
36 сделать тренировку на улице {minutes} минут
37 сделать тренировку без остановки {minutes} минут
38 сделать {pushups} широких отжиманий
39 сделать {pushups} узких отжиманий
40 сделать {squats} быстрых приседаний
41 сделать {squats} медленных приседаний
42 сделать {lunges} выпадов на каждую ногу
43 сделать {situps} скручиваний без паузы
44 пройти {steps} шагов без телефона
45 пройти {steps} шагов после работы
46 сделать тренировку с таймером {minutes} минут
47 сделать {burpees} берпи подряд
48 сделать {jumping_jacks} прыжков подряд
49 пройти {steps} шагов за день
50 пройти {steps} шагов вечером
""",
    "water": """
51 выпить {glasses} стаканов воды
52 выпить {liters} литров воды
53 выпить стакан воды сразу после пробуждения
54 выпить воду перед завтраком
55 выпить воду перед обедом
56 выпить воду перед ужином
57 выпить воду перед тренировкой
58 выпить воду после тренировки
59 выпить воду вместо сладкого напитка
60 выпить воду вместо газировки
61 выпить {glasses} стаканов воды до обеда
62 выпить {glasses} стаканов воды до 15:00
63 выпить {glasses} стаканов воды до 18:00
64 выпить стакан воды перед сном
65 выпить воду после прогулки
66 выпить воду после еды
67 выпить воду после медитации
68 выпить воду после чтения
69 выпить воду после работы
70 выпить воду вместо кофе
71 выпить {ml} мл воды за один раз
72 выпить воду сразу после пробуждения
73 выпить воду после тренировки
74 выпить воду вместо сладкого чая
75 выпить воду после прогулки
76 выпить воду перед выходом из дома
77 выпить воду после возвращения домой
78 выпить воду перед чтением
79 выпить воду после чтения
80 выпить воду перед медитацией
""",
    "reading": """
81 прочитать {pages} страниц книги
82 читать книгу {minutes} минут
83 прочитать одну главу книги
84 прочитать {pages} страниц перед сном
85 прочитать {pages} страниц утром
86 прочитать книгу без телефона
87 прочитать книгу в тишине
88 прочитать книгу на улице
89 прочитать книгу в парке
90 прочитать книгу дома
91 прочитать {pages} страниц художественной книги
92 прочитать {pages} страниц обучающей книги
93 прочитать статью по саморазвитию
94 прочитать статью по здоровью
95 прочитать статью по финансам
96 выписать {ideas} идей из книги
97 сделать заметку по книге
98 продолжить чтение текущей книги
99 дочитать начатую главу
100 прочитать {pages} страниц без перерыва
101 прочитать книгу вместо соцсетей
102 прочитать книгу после ужина
103 прочитать книгу перед медитацией
104 прочитать книгу после прогулки
105 прочитать книгу утром вместо телефона
106 прочитать книгу перед сном
107 прочитать {pages} страниц новой книги
108 прочитать {pages} страниц любимой книги
109 прочитать {pages} страниц книги по профессии
110 прочитать {pages} страниц книги по психологии
111 прочитать {pages} страниц книги по финансам
112 прочитать {pages} страниц книги по здоровью
113 читать книгу {minutes} минут подряд
114 читать книгу {minutes} минут утром
115 читать книгу {minutes} минут вечером
116 читать книгу {minutes} минут в тишине
117 читать книгу {minutes} минут на улице
118 читать книгу {minutes} минут перед сном
119 читать книгу {minutes} минут после работы
120 читать книгу {minutes} минут без перерыва
""",
    "meditation": """
121 медитировать {minutes} минут
122 сделать дыхательную практику {minutes} минут
123 медитировать утром {minutes} минут
124 медитировать вечером {minutes} минут
125 медитировать перед сном
126 медитировать после пробуждения
127 сделать дыхание 4-7-8 {minutes} минут
128 сделать дыхание через нос {minutes} минут
129 медитировать на дыхание {minutes} минут
130 медитировать на расслабление {minutes} минут
131 медитировать на концентрацию {minutes} минут
132 медитировать сидя {minutes} минут
133 медитировать в тишине {minutes} минут
134 медитировать на улице {minutes} минут
135 медитировать после прогулки {minutes} минут
136 медитировать после работы {minutes} минут
137 медитировать после чтения {minutes} минут
138 медитировать перед тренировкой {minutes} минут
139 медитировать после тренировки {minutes} минут
140 медитировать перед началом дня {minutes} минут
141 медитировать с таймером {minutes} минут
142 медитировать без музыки {minutes} минут
143 медитировать с закрытыми глазами {minutes} минут
144 медитировать с фокусом на дыхании {minutes} минут
145 медитировать с фокусом на теле {minutes} минут
146 медитировать на благодарность {minutes} минут
147 медитировать на спокойствие {minutes} минут
148 медитировать на концентрацию {minutes} минут
149 медитировать перед сном {minutes} минут
150 медитировать после пробуждения {minutes} минут
""",
    "journal": """
151 написать {lines} строк в дневнике
152 описать сегодняшний день
153 записать 3 мысли дня
154 записать 3 благодарности
155 записать одну идею
156 записать цель на завтра
157 записать цель на неделю
158 записать план дня
159 записать одну проблему и решение
160 описать свои эмоции
161 записать 5 мыслей
162 записать 5 идей
163 записать 5 целей
164 написать вывод дня
165 написать урок дня
166 написать что получилось сегодня
167 написать что можно улучшить
168 написать план улучшения
169 записать новую привычку
170 записать новую цель
171 описать лучший момент дня
172 описать сложный момент дня
173 записать чему научился сегодня
174 записать одну победу дня
175 записать одну ошибку дня
176 записать одну идею для будущего
177 записать 3 задачи на завтра
178 написать план недели
179 написать план месяца
180 написать план развития
181 написать 10 строк размышлений
182 написать письмо самому себе
183 написать мотивационную заметку
184 написать благодарность себе
185 написать благодарность другому человеку
186 написать 5 вещей за которые благодарен
187 написать 3 достижения недели
188 написать 3 цели на завтра
189 написать вывод недели
190 написать вывод месяца
191 описать свои цели на год
192 написать план улучшения привычек
193 записать новую идею проекта
194 записать новую идею бизнеса
195 записать новую идею развития
196 написать план достижения цели
197 написать первый шаг к цели
198 написать второй шаг к цели
199 написать третий шаг к цели
200 написать итог дня
""",
}


def _parse_templates() -> dict[str, list[dict]]:
    parsed: dict[str, list[dict]] = {}
    for category, block in _AI_TEMPLATE_BLOCKS.items():
        items: list[dict] = []
        for raw_line in block.strip().splitlines():
            match = _NUMBERED_TEMPLATE_RE.match(raw_line)
            if not match:
                continue
            template_id = int(match.group(1))
            title = match.group(2).strip()
            items.append(
                {
                    "id": template_id,
                    "category": category,
                    "title": title,
                    "placeholders": _PLACEHOLDER_RE.findall(title),
                }
            )
        parsed[category] = items
    return parsed


_SUPPORT_TEMPLATES_BY_CATEGORY = _parse_templates()


def _normalize_title(value: str | None) -> str:
    return str(value or "").strip().lower()


def _goal_profile(goal_type: str) -> dict:
    normalized_goal = normalize_goal_type(goal_type)
    return _GOAL_SUPPORT_PROFILES.get(normalized_goal, _GOAL_SUPPORT_PROFILES[DEFAULT_GOAL_TYPE])


def _pick_weighted_key(weight_map: dict[str, int]) -> str | None:
    keys = [key for key, weight in weight_map.items() if weight > 0]
    if not keys:
        return None
    weights = [weight_map[key] for key in keys]
    return random.choices(keys, weights=weights, k=1)[0]


def _pick_support_difficulty(phase: int) -> str:
    weights = _SUPPORT_DIFFICULTY_WEIGHTS.get(max(1, min(3, int(phase or 1))), _SUPPORT_DIFFICULTY_WEIGHTS[1])
    keys = [key for key, weight in weights.items() if weight > 0]
    values = [weights[key] for key in keys]
    return random.choices(keys, weights=values, k=1)[0]


def _score_support_template(goal_type: str, category: str, title: str) -> float:
    keywords = _goal_profile(goal_type).get("keywords", {}).get(category, ())
    title_lower = title.lower()
    score = 1.0
    for keyword in keywords:
        if keyword in title_lower:
            score += 4.0
    return score + random.random()


def _int_choices(start: int, stop: int, step: int) -> list[int]:
    safe_step = max(1, int(step or 1))
    if start >= stop:
        return [int(start)]
    return list(range(int(start), int(stop) + safe_step, safe_step))


def _float_choices(start: float, stop: float, step: float) -> list[float]:
    values: list[float] = []
    current = float(start)
    safe_stop = float(stop)
    safe_step = max(0.1, float(step or 0.5))
    while current <= safe_stop + 1e-9:
        values.append(round(current, 1))
        current += safe_step
    return values or [round(float(start), 1)]


def _resolve_parameter(name: str, difficulty: str, level: int) -> int | float:
    spec = _PARAMETER_SPECS[name]
    low, high, step = spec[difficulty]
    level_bonus = min(max(level - 1, 0), 20)
    if spec["kind"] == "float":
        scaled_high = min(high + level_bonus * 0.05, high + 1.0)
        return random.choice(_float_choices(low, scaled_high, step))
    scaled_high = int(round(high + level_bonus * 0.35))
    return random.choice(_int_choices(int(low), scaled_high, int(step)))


def _format_parameter(name: str, value: int | float) -> str:
    if name == "liters":
        return str(value).replace(".", ",")
    return str(int(value))


def _resolve_objective_type(category: str, title: str, params: dict[str, int | float]) -> tuple[str | None, int | None]:
    title_lower = title.lower()

    if "steps" in params:
        return "steps", int(params["steps"])
    if "km" in params:
        return "walking_km", int(params["km"])
    if "pushups" in params:
        return "pushups", int(params["pushups"])
    if "squats" in params:
        return "squats", int(params["squats"])
    if "lunges" in params:
        return "lunges", int(params["lunges"])
    if "situps" in params:
        return "situps", int(params["situps"])
    if "burpees" in params:
        return "burpees", int(params["burpees"])
    if "jumping_jacks" in params:
        return "jumping_jacks", int(params["jumping_jacks"])
    if "floors" in params:
        return "stairs_floors", int(params["floors"])
    if "seconds" in params:
        return "plank_seconds", int(params["seconds"])
    if "minutes" in params:
        if category == "reading":
            return "reading_minutes", int(params["minutes"])
        if category == "meditation":
            return "meditation_minutes", int(params["minutes"])
        if "планку" in title_lower:
            return "plank_minutes", int(params["minutes"])
        return "training_minutes" if category == "activity" else "duration_minutes", int(params["minutes"])
    if "glasses" in params:
        return "water_glasses", int(params["glasses"])
    if "liters" in params:
        return "water_ml", int(float(params["liters"]) * 1000)
    if "ml" in params:
        return "water_ml", int(params["ml"])
    if "pages" in params:
        return "reading_pages", int(params["pages"])
    if "ideas" in params:
        return "ideas_count", int(params["ideas"])
    if "lines" in params:
        return "journal_lines", int(params["lines"])

    if category == "water":
        return "hydration_habit", 1
    if category == "reading":
        return "reading_session", 1
    if category == "meditation":
        return "meditation_session", 1
    if category == "journal":
        return "journal_task", 1
    if category == "activity":
        return "activity_session", 1
    return None, None


def _build_support_description(goal_type: str, category: str, difficulty: str) -> str:
    goal_title = get_goal_info(goal_type)["title"]
    emphasis = {
        "easy": "Лёгкий шаг",
        "medium": "Основной шаг",
        "hard": "Сильный шаг",
    }[difficulty]
    return f"{emphasis} для цели «{goal_title}». {_CATEGORY_DESCRIPTIONS[category]}"


def _build_support_template(goal_type: str, template: dict, difficulty: str, level: int) -> dict:
    params: dict[str, int | float] = {}
    for placeholder in template.get("placeholders", []):
        params[placeholder] = _resolve_parameter(placeholder, difficulty, level)

    title = str(template["title"])
    for placeholder, value in params.items():
        title = title.replace(f"{{{placeholder}}}", _format_parameter(placeholder, value))

    objective_type, target_value = _resolve_objective_type(template["category"], title, params)
    base_xp, base_gold = _SUPPORT_REWARD_BASE[template["category"]][difficulty]

    return {
        "template_key": f"ai:{template['category']}:{template['id']}",
        "title": title,
        "description": _build_support_description(goal_type, template["category"], difficulty),
        "difficulty": difficulty,
        "base_xp": base_xp,
        "base_gold": base_gold,
        "icon": _CATEGORY_ICONS[template["category"]],
        "objective_type": objective_type,
        "target_value": target_value,
        "source": "ai",
        "category": template["category"],
    }


def _build_core_template(goal_type: str, template: dict) -> dict:
    title = str(template.get("title") or "").strip()
    return {
        **template,
        "template_key": f"core:{normalize_goal_type(goal_type)}:{_normalize_title(title)}",
        "source": "ai",
    }


def _rank_core_templates(goal_type: str, phase: int) -> list[dict]:
    templates = [dict(template) for template in get_goal_templates(goal_type, "daily", phase)]
    random.shuffle(templates)
    return templates


def _available_support_categories(goal_type: str, used_template_keys: set[str], used_categories: dict[str, int]) -> dict[str, int]:
    profile = _goal_profile(goal_type)
    available: dict[str, int] = {}
    for category, weight in profile.get("support_weights", {}).items():
        if used_categories.get(category, 0) >= 2:
            continue
        count = 0
        for template in _SUPPORT_TEMPLATES_BY_CATEGORY.get(category, []):
            key = f"ai:{category}:{template['id']}"
            if key not in used_template_keys:
                count += 1
        if count > 0 and weight > 0:
            available[category] = weight
    return available


def _pick_support_template(goal_type: str, phase: int, level: int, used_template_keys: set[str], used_categories: dict[str, int]) -> dict | None:
    available_categories = _available_support_categories(goal_type, used_template_keys, used_categories)
    if not available_categories:
        return None

    category = _pick_weighted_key(available_categories)
    if not category:
        return None

    candidates = [
        template
        for template in _SUPPORT_TEMPLATES_BY_CATEGORY.get(category, [])
        if f"ai:{category}:{template['id']}" not in used_template_keys
    ]
    if not candidates:
        return None

    candidates.sort(key=lambda template: _score_support_template(goal_type, category, template["title"]), reverse=True)
    pool = candidates[: min(8, len(candidates))]
    selected = random.choice(pool)
    difficulty = _pick_support_difficulty(phase)
    return _build_support_template(goal_type, selected, difficulty, level)


def build_daily_quest_plan(
    *,
    goal_type: str,
    phase: int,
    level: int,
    count: int,
    used_template_keys: set[str] | None = None,
    used_titles: set[str] | None = None,
    used_categories: dict[str, int] | None = None,
) -> list[dict]:
    normalized_goal = normalize_goal_type(goal_type)
    used_keys = set(used_template_keys or set())
    used_title_keys = {_normalize_title(title) for title in (used_titles or set()) if _normalize_title(title)}
    used_cats = used_categories or {}
    profile = _goal_profile(normalized_goal)
    items: list[dict] = []

    for template in _rank_core_templates(normalized_goal, phase):
        candidate = _build_core_template(normalized_goal, template)
        title_key = _normalize_title(candidate.get("title"))
        if candidate["template_key"] in used_keys:
            continue
        if title_key and title_key in used_title_keys:
            continue
        items.append(candidate)
        used_keys.add(candidate["template_key"])
        if title_key:
            used_title_keys.add(title_key)
        if len(items) >= min(int(profile.get("core_target", 6)), max(0, count)):
            break

    support_attempts = 0
    support_attempt_limit = max(40, count * 10)
    while len(items) < count:
        support_attempts += 1
        if support_attempts > support_attempt_limit:
            break
        support_template = _pick_support_template(normalized_goal, phase, level, used_keys, used_cats)
        if not support_template:
            break
        title_key = _normalize_title(support_template.get("title"))
        if title_key and title_key in used_title_keys:
            used_keys.add(str(support_template["template_key"]))
            continue
        items.append(support_template)
        used_keys.add(str(support_template["template_key"]))
        if title_key:
            used_title_keys.add(title_key)
        used_cats[support_template["category"]] = used_cats.get(support_template["category"], 0) + 1

    if len(items) < count:
        fallback_templates: list[dict] = []
        for category_templates in _SUPPORT_TEMPLATES_BY_CATEGORY.values():
            for template in category_templates:
                key = f"ai:{template['category']}:{template['id']}"
                if key in used_keys:
                    continue
                fallback_templates.append(template)
        fallback_templates.sort(
            key=lambda template: _score_support_template(normalized_goal, template["category"], template["title"]),
            reverse=True,
        )
        for template in fallback_templates:
            if len(items) >= count:
                break
            difficulty = _pick_support_difficulty(phase)
            candidate = _build_support_template(normalized_goal, template, difficulty, level)
            title_key = _normalize_title(candidate.get("title"))
            if used_cats.get(candidate["category"], 0) >= 2:
                continue
            if candidate["template_key"] in used_keys:
                continue
            if title_key and title_key in used_title_keys:
                used_keys.add(str(candidate["template_key"]))
                continue
            items.append(candidate)
            used_keys.add(str(candidate["template_key"]))
            if title_key:
                used_title_keys.add(title_key)
            used_cats[candidate["category"]] = used_cats.get(candidate["category"], 0) + 1

    return items[:count]
