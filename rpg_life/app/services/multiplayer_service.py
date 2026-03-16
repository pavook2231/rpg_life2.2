from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import crud


def create_challenge(db: Session, user_id: int, challenge_data):
    try:
        challenge = crud.create_challenge(db, user_id, challenge_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True, "challenge_id": challenge.id}


def join_challenge(db: Session, challenge_id: int, user_id: int):
    try:
        crud.join_challenge(db, challenge_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}
