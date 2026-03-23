import importlib
from datetime import datetime

audit_task_module = importlib.import_module("app.tasks.audit_retention_task")


def test_audit_retention_task_enqueues_purge_with_default_window(monkeypatch) -> None:
    fixed_now = datetime(2026, 3, 23, 12, 0, 0)
    captured: dict[str, object] = {}

    def fake_run_db_task(task_fn):
        class DummyDb:
            pass

        return task_fn(DummyDb())

    def fake_purge(db, *, older_than):
        captured["older_than"] = older_than
        return {"deleted": 5, "older_than": older_than.isoformat()}

    monkeypatch.setattr(audit_task_module, "run_db_task", fake_run_db_task)
    monkeypatch.setattr(audit_task_module, "utc_now", lambda: fixed_now)
    monkeypatch.setattr(audit_task_module.audit_service, "purge_audit_events", fake_purge)
    monkeypatch.setattr(audit_task_module, "AUDIT_RETENTION_DAYS_DEFAULT", 90)

    result = audit_task_module.audit_retention_task()

    assert captured["older_than"] == datetime(2025, 12, 23, 12, 0, 0)
    assert result["deleted"] == 5
    assert result["status"] == "audit_retention_purge"
