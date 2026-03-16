from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import ALLOW_SQLITE_FALLBACK, APP_ENV, AUTO_CREATE_TABLES, DATABASE_URL

ACTIVE_DATABASE_URL = DATABASE_URL
IS_SQLITE = ACTIVE_DATABASE_URL.startswith("sqlite")

def _build_engine(database_url: str):
    engine_kwargs = {}
    if database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    else:
        engine_kwargs["pool_pre_ping"] = True
    return create_engine(database_url, **engine_kwargs)

engine = _build_engine(ACTIVE_DATABASE_URL)
if not IS_SQLITE and APP_ENV != "production" and ALLOW_SQLITE_FALLBACK:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError:
        ACTIVE_DATABASE_URL = "sqlite:///./app.db"
        IS_SQLITE = True
        engine = _build_engine(ACTIVE_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_sqlite_schema():
    if not IS_SQLITE:
        return

    # SQLite используется как dev-фолбэк (обычно без Alembic). Если база пустая,
    # то инспекция таблиц упадет. create_all() идемпотентен и безопасен для SQLite.
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    required_columns = {
        "name": "ALTER TABLE users ADD COLUMN name VARCHAR",
        "birth_year": "ALTER TABLE users ADD COLUMN birth_year INTEGER",
        "gender": "ALTER TABLE users ADD COLUMN gender VARCHAR DEFAULT 'unspecified'",
        "selected_goal_type": "ALTER TABLE users ADD COLUMN selected_goal_type VARCHAR DEFAULT 'personal_development'",
        "goal_term_months": "ALTER TABLE users ADD COLUMN goal_term_months INTEGER DEFAULT 6",
        "goal_cycle_index": "ALTER TABLE users ADD COLUMN goal_cycle_index INTEGER DEFAULT 1",
        "goal_cycle_started_at": "ALTER TABLE users ADD COLUMN goal_cycle_started_at DATETIME",
        "goal_cycle_deadline_at": "ALTER TABLE users ADD COLUMN goal_cycle_deadline_at DATETIME",
        "goal_cycle_xp": "ALTER TABLE users ADD COLUMN goal_cycle_xp INTEGER DEFAULT 0",
        "goal_target_xp": "ALTER TABLE users ADD COLUMN goal_target_xp INTEGER DEFAULT 20000",
        "goal_progress_percent": "ALTER TABLE users ADD COLUMN goal_progress_percent INTEGER DEFAULT 0",
        "last_goal_change_at": "ALTER TABLE users ADD COLUMN last_goal_change_at DATETIME",
    }

    with engine.begin() as connection:
        for column_name, ddl in required_columns.items():
            if column_name not in columns:
                connection.execute(text(ddl))

        progress_columns = {column["name"] for column in inspector.get_columns("user_class_progress")}
        progress_required_columns = {
            "stamina": "ALTER TABLE user_class_progress ADD COLUMN stamina FLOAT DEFAULT 1.0",
            "max_health": "ALTER TABLE user_class_progress ADD COLUMN max_health INTEGER DEFAULT 100",
            "current_health": "ALTER TABLE user_class_progress ADD COLUMN current_health INTEGER DEFAULT 100",
            "wounded_until": "ALTER TABLE user_class_progress ADD COLUMN wounded_until DATETIME",
            "penalty_quests_remaining": "ALTER TABLE user_class_progress ADD COLUMN penalty_quests_remaining INTEGER DEFAULT 0",
            "reward_penalty_percent": "ALTER TABLE user_class_progress ADD COLUMN reward_penalty_percent FLOAT DEFAULT 0",
            "last_health_decay_at": "ALTER TABLE user_class_progress ADD COLUMN last_health_decay_at DATETIME",
        }
        for column_name, ddl in progress_required_columns.items():
            if column_name not in progress_columns:
                connection.execute(text(ddl))

        item_columns = {column["name"] for column in inspector.get_columns("items")}
        item_required_columns = {
            "critical_bonus": "ALTER TABLE items ADD COLUMN critical_bonus FLOAT DEFAULT 0",
            "luck_bonus": "ALTER TABLE items ADD COLUMN luck_bonus FLOAT DEFAULT 0",
            "power": "ALTER TABLE items ADD COLUMN power INTEGER DEFAULT 0",
            "is_beta_item": "ALTER TABLE items ADD COLUMN is_beta_item BOOLEAN DEFAULT 0",
        }
        for column_name, ddl in item_required_columns.items():
            if column_name not in item_columns:
                connection.execute(text(ddl))

        ability_columns = {column["name"] for column in inspector.get_columns("item_unique_abilities")}
        ability_required_columns = {
            "effect_critical_bonus": "ALTER TABLE item_unique_abilities ADD COLUMN effect_critical_bonus FLOAT DEFAULT 0",
            "effect_luck_bonus": "ALTER TABLE item_unique_abilities ADD COLUMN effect_luck_bonus FLOAT DEFAULT 0",
        }
        for column_name, ddl in ability_required_columns.items():
            if column_name not in ability_columns:
                connection.execute(text(ddl))

        quest_columns = {column["name"] for column in inspector.get_columns("quests")}
        quest_required_columns = {
            "quest_type": "ALTER TABLE quests ADD COLUMN quest_type VARCHAR DEFAULT 'daily'",
            "objective_type": "ALTER TABLE quests ADD COLUMN objective_type VARCHAR",
            "target_value": "ALTER TABLE quests ADD COLUMN target_value INTEGER",
            "expires_at": "ALTER TABLE quests ADD COLUMN expires_at DATETIME",
            "challenge_id": "ALTER TABLE quests ADD COLUMN challenge_id INTEGER",
            "goal_id": "ALTER TABLE quests ADD COLUMN goal_id VARCHAR",
            "template_key": "ALTER TABLE quests ADD COLUMN template_key VARCHAR",
            "difficulty_level": "ALTER TABLE quests ADD COLUMN difficulty_level VARCHAR DEFAULT 'easy'",
            "goal_progress_percent": "ALTER TABLE quests ADD COLUMN goal_progress_percent INTEGER DEFAULT 0",
            "quest_bucket": "ALTER TABLE quests ADD COLUMN quest_bucket VARCHAR DEFAULT 'daily'",
            "is_universal": "ALTER TABLE quests ADD COLUMN is_universal BOOLEAN DEFAULT 0",
            "is_accepted": "ALTER TABLE quests ADD COLUMN is_accepted BOOLEAN DEFAULT 1",
            "is_archived": "ALTER TABLE quests ADD COLUMN is_archived BOOLEAN DEFAULT 0",
        }
        for column_name, ddl in quest_required_columns.items():
            if column_name not in quest_columns:
                connection.execute(text(ddl))

        challenge_columns = {column["name"] for column in inspector.get_columns("challenges")}
        challenge_required_columns = {
            "opponent_id": "ALTER TABLE challenges ADD COLUMN opponent_id INTEGER",
            "accepted_at": "ALTER TABLE challenges ADD COLUMN accepted_at DATETIME",
            "responded_at": "ALTER TABLE challenges ADD COLUMN responded_at DATETIME",
        }
        for column_name, ddl in challenge_required_columns.items():
            if column_name not in challenge_columns:
                connection.execute(text(ddl))

        friendship_columns = {column["name"] for column in inspector.get_columns("friends")}
        friendship_required_columns = {
            "status": "ALTER TABLE friends ADD COLUMN status VARCHAR DEFAULT 'accepted'",
        }
        for column_name, ddl in friendship_required_columns.items():
            if column_name not in friendship_columns:
                connection.execute(text(ddl))

        index_ddls = [
            "CREATE INDEX IF NOT EXISTS ix_user_class_progress_user_class ON user_class_progress (user_id, class_name)",
            "CREATE INDEX IF NOT EXISTS ix_quests_user_class_status ON quests (user_id, class_progress_id, is_completed)",
            "CREATE INDEX IF NOT EXISTS ix_quests_type_expires ON quests (quest_type, expires_at)",
            "CREATE INDEX IF NOT EXISTS ix_user_inventory_user_item ON user_inventory (user_id, item_id)",
            "CREATE INDEX IF NOT EXISTS ix_user_inventory_user_acquired ON user_inventory (user_id, acquired_at)",
            "CREATE INDEX IF NOT EXISTS ix_character_equipment_user_class ON character_equipment (user_id, class_progress_id)",
            "CREATE INDEX IF NOT EXISTS ix_completed_quests_user_completed_at ON completed_quests (user_id, completed_at)",
            "CREATE INDEX IF NOT EXISTS ix_daily_bonuses_user_claimed_at ON daily_bonuses (user_id, claimed_at)",
            "CREATE INDEX IF NOT EXISTS ix_challenges_status_end_at ON challenges (status, end_at)",
            "CREATE INDEX IF NOT EXISTS ix_challenges_creator_opponent ON challenges (creator_id, opponent_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_challenge_participants_challenge_user ON challenge_participants (challenge_id, user_id)",
            "CREATE INDEX IF NOT EXISTS ix_friend_requests_receiver_status ON friend_requests (receiver_id, status)",
            "CREATE INDEX IF NOT EXISTS ix_friend_requests_requester_status ON friend_requests (requester_id, status)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_friends_pair ON friends (user_id, friend_id)",
            "CREATE INDEX IF NOT EXISTS ix_coop_quests_status_end_at ON coop_quests (status, end_at)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_coop_quest_participant_pair ON coop_quest_participants (coop_quest_id, user_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_events_status_window ON game_events (status, start_at, end_at)",
            "CREATE INDEX IF NOT EXISTS ix_items_beta_rarity_slot ON items (is_beta_item, rarity, slot)",
            "CREATE INDEX IF NOT EXISTS ix_friends_status ON friends (status)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_bosses_user_boss ON user_bosses (user_id, boss_id)",
            "CREATE INDEX IF NOT EXISTS ix_push_devices_user_active ON push_devices (user_id, is_active)",
            "CREATE INDEX IF NOT EXISTS ix_notification_events_user_created ON notification_events (user_id, created_at)",
            "CREATE INDEX IF NOT EXISTS ix_notification_queue_status_schedule ON notification_queue (status, scheduled_at)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_queue_event_device ON notification_queue (event_id, device_id)",
            "CREATE INDEX IF NOT EXISTS ix_users_selected_goal_type ON users (selected_goal_type)",
            "CREATE INDEX IF NOT EXISTS ix_quests_goal_id ON quests (goal_id)",
            "CREATE INDEX IF NOT EXISTS ix_quests_template_key ON quests (template_key)",
            "CREATE INDEX IF NOT EXISTS ix_quests_bucket_accepted ON quests (quest_bucket, is_accepted)",
            "CREATE INDEX IF NOT EXISTS ix_users_last_goal_change_at ON users (last_goal_change_at)",
            "CREATE INDEX IF NOT EXISTS ix_quests_user_archived_created ON quests (user_id, is_archived, created_at)",
        ]
        for ddl in index_ddls:
            connection.execute(text(ddl))


def normalize_existing_strings():
    from app.models import Achievement, Item, User, UserClassProgress
    from app.text_utils import normalize_item_model, repair_mojibake

    db = SessionLocal()
    try:
        changed = False
        for user in db.query(User).all():
            for field in ("name", "gender"):
                value = getattr(user, field, None)
                fixed = repair_mojibake(value)
                if fixed != value:
                    setattr(user, field, fixed)
                    changed = True
        for progress in db.query(UserClassProgress).all():
            fixed = repair_mojibake(progress.display_name)
            if fixed != progress.display_name:
                progress.display_name = fixed
                changed = True
        for item in db.query(Item).all():
            before = (
                item.name,
                item.description,
                item.icon,
                item.rarity,
                item.type,
                item.subclass,
                item.slot,
            )
            normalize_item_model(item)
            after = (
                item.name,
                item.description,
                item.icon,
                item.rarity,
                item.type,
                item.subclass,
                item.slot,
            )
            changed = changed or before != after
        for achievement in db.query(Achievement).all():
            before = (achievement.name, achievement.description, achievement.icon)
            achievement.name = repair_mojibake(achievement.name)
            achievement.description = repair_mojibake(achievement.description)
            achievement.icon = repair_mojibake(achievement.icon)
            changed = changed or before != (achievement.name, achievement.description, achievement.icon)
        if changed:
            db.commit()
    finally:
        db.close()


def init_db():
    import app.models  # noqa: F401

    if AUTO_CREATE_TABLES:
        Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema()
