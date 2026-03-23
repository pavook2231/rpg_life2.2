from datetime import timedelta

from app.core.dates import utc_now
from app.models import ApiAuditEvent
from app.services import audit_service


def test_list_audit_events_filters_by_path_and_severity(db_session) -> None:
    db_session.add_all(
        [
            ApiAuditEvent(
                user_id=1,
                user_email="hero@example.com",
                method="POST",
                path="/api/v1/items/buy",
                status_code=400,
                severity="warning",
                reason="sensitive_write_rejected",
                details_json='{"k":"v"}',
                created_at=utc_now(),
            ),
            ApiAuditEvent(
                user_id=2,
                user_email="other@example.com",
                method="POST",
                path="/api/v1/profile",
                status_code=200,
                severity="info",
                details_json="{}",
                created_at=utc_now() - timedelta(minutes=1),
            ),
        ]
    )
    db_session.commit()

    payload = audit_service.list_audit_events(
        db_session,
        path="/items/",
        severity="warning",
        page=1,
        page_size=20,
    )

    assert payload["pagination"]["total_items"] == 1
    assert payload["items"][0]["path"] == "/api/v1/items/buy"
    assert payload["items"][0]["severity"] == "warning"


def test_list_audit_events_paginates_desc_by_created_at(db_session) -> None:
    now = utc_now()
    for idx in range(3):
        db_session.add(
            ApiAuditEvent(
                user_id=idx + 1,
                user_email=f"user{idx}@example.com",
                method="POST",
                path=f"/api/v1/test/{idx}",
                status_code=200,
                severity="info",
                details_json="{}",
                created_at=now - timedelta(seconds=idx),
            )
        )
    db_session.commit()

    first_page = audit_service.list_audit_events(db_session, page=1, page_size=2)
    second_page = audit_service.list_audit_events(db_session, page=2, page_size=2)

    assert first_page["pagination"]["total_items"] == 3
    assert [item["path"] for item in first_page["items"]] == ["/api/v1/test/0", "/api/v1/test/1"]
    assert [item["path"] for item in second_page["items"]] == ["/api/v1/test/2"]


def test_export_audit_events_csv_contains_header_and_rows(db_session) -> None:
    db_session.add(
        ApiAuditEvent(
            user_id=9,
            user_email="csv@example.com",
            method="POST",
            path="/api/v1/items/buy",
            status_code=200,
            severity="info",
            details_json="{}",
            created_at=utc_now(),
        )
    )
    db_session.commit()

    csv_payload = audit_service.export_audit_events_csv(db_session, limit=100)
    lines = [line for line in csv_payload.splitlines() if line.strip()]

    assert lines[0].startswith("id,created_at,severity")
    assert any("/api/v1/items/buy" in line for line in lines[1:])


def test_purge_audit_events_deletes_older_rows(db_session) -> None:
    old_row = ApiAuditEvent(
        user_id=1,
        user_email="old@example.com",
        method="POST",
        path="/api/v1/old",
        status_code=400,
        severity="warning",
        details_json="{}",
        created_at=utc_now() - timedelta(days=10),
    )
    fresh_row = ApiAuditEvent(
        user_id=2,
        user_email="fresh@example.com",
        method="POST",
        path="/api/v1/fresh",
        status_code=200,
        severity="info",
        details_json="{}",
        created_at=utc_now(),
    )
    db_session.add_all([old_row, fresh_row])
    db_session.commit()

    result = audit_service.purge_audit_events(db_session, older_than=utc_now() - timedelta(days=5))

    assert result["deleted"] == 1
    remaining_paths = {row.path for row in db_session.query(ApiAuditEvent).all()}
    assert remaining_paths == {"/api/v1/fresh"}
