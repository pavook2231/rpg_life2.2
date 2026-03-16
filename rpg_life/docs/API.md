# RPG Life Mobile API

Base path: `/api/v1`

Response envelope:

```json
{
  "status": "success",
  "data": {},
  "message": ""
}
```

Main endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/profile`
- `GET /api/v1/character/profile`
- `GET /api/v1/quests/daily`
- `GET /api/v1/inventory`
- `POST /api/v1/inventory/equip`
- `GET /api/v1/rewards/summary`
- `GET /api/v1/challenges`
- `GET /api/v1/leaderboard`
- `GET /api/v1/events`

Beta gameplay endpoints:

- `POST /chests/open`
- `GET /bosses`
- `GET /bosses/current`
- `POST /bosses/progress`
- `POST /bosses/complete`
- `POST /friends/add`
- `POST /friends/accept`
- `GET /friends/list`
- `POST /challenge/create`
- `POST /challenge/progress`
- `POST /challenge/finish`
- `GET /challenge/list`

Beta gameplay examples:

`POST /chests/open`

Request:

```json
{
  "chest_name": "COMMON_CHEST"
}
```

Response:

```json
{
  "item": {
    "id": 3,
    "name": "Vanguard Helm",
    "slot": "head",
    "rarity": "rare",
    "icon": "H3",
    "power": 14
  },
  "rarity": "rare"
}
```

`GET /bosses/current`

Response:

```json
{
  "boss": {
    "id": 1,
    "name": "Iron Walker",
    "description": "Walk 30000 steps",
    "requirement_type": "steps",
    "requirement_value": 30000,
    "reward_gold": 120,
    "reward_chest": "COMMON_CHEST",
    "progress": 12000,
    "completed": false
  }
}
```

`POST /bosses/complete`

Response:

```json
{
  "boss": {
    "id": 1,
    "name": "Iron Walker",
    "description": "Walk 30000 steps",
    "requirement_type": "steps",
    "requirement_value": 30000,
    "reward_gold": 120,
    "reward_chest": "COMMON_CHEST",
    "progress": 30000,
    "completed": true
  },
  "reward": {
    "gold": 120,
    "chest": {
      "chest": {
        "id": 1,
        "name": "COMMON_CHEST",
        "rarity": "common",
        "gold_cost": 50,
        "created_at": "2026-03-12T12:00:00"
      },
      "item": {
        "id": 1,
        "name": "Recruit Hood",
        "slot": "head",
        "rarity": "common",
        "icon": "H1",
        "power": 5
      },
      "rarity": "common"
    }
  }
}
```

`POST /challenge/create`

Request:

```json
{
  "opponent_id": 2,
  "type": "steps",
  "target_value": 10000,
  "end_date": "2026-03-20T12:00:00",
  "reward_gold": 100,
  "reward_chest": true
}
```

Response:

```json
{
  "challenge": {
    "id": 7,
    "creator_id": 1,
    "opponent_id": 2,
    "type": "steps",
    "target_value": 10000,
    "start_date": "2026-03-12T12:00:00",
    "end_date": "2026-03-20T12:00:00",
    "winner_id": null,
    "status": "active",
    "reward": {
      "gold": 100,
      "chest": "RARE_CHEST"
    },
    "progress": {
      "1": 0,
      "2": 0
    },
    "is_creator": true
  }
}
```

`GET /challenge/list`

Response:

```json
{
  "items": [
    {
      "id": 7,
      "creator_id": 1,
      "opponent_id": 2,
      "type": "steps",
      "target_value": 10000,
      "start_date": "2026-03-12T12:00:00",
      "end_date": "2026-03-20T12:00:00",
      "winner_id": null,
      "status": "active",
      "reward": {
        "gold": 100,
        "chest": "RARE_CHEST"
      },
      "progress": {
        "1": 4200,
        "2": 3900
      },
      "is_creator": true
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 1,
    "total_pages": 1
  }
}
```

Infrastructure:

- Redis is used as Celery broker/result backend, cache storage and temporary event state storage.
- Celery worker executes gameplay background jobs.
- Celery Beat triggers periodic jobs for daily quests, PvP resolution, world events and reward distribution.
- PostgreSQL is the target production database.
- Alembic manages schema migrations.

Background tasks:

- `app.tasks.daily_quests_task.daily_quests_task`
- `app.tasks.challenge_result_task.challenge_result_task`
- `app.tasks.world_events_task.world_events_task`
- `app.tasks.reward_distribution_task.reward_distribution_task`

Database and infrastructure commands:

```bash
alembic upgrade head
alembic revision --autogenerate -m "describe_change"
docker compose up --build
docker compose -f docker-compose.production.yml up --build -d
```

Recommended mobile stack:

- React Native if the team prefers TypeScript, shared UI logic and faster reuse with web.
- Flutter if the team prefers a single UI toolkit with stronger visual consistency across platforms.
