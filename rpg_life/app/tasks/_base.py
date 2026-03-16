from app.core.database import SessionLocal


def run_db_task(task_fn):
    db = SessionLocal()
    try:
        return task_fn(db)
    finally:
        db.close()
