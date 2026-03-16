import logging

from sqlalchemy.orm import Session

from app.chest_items import build_chest_grant_payload, grant_chest_to_user

logger = logging.getLogger(__name__)


class LevelChest:
    """Unified chest rewards for progression loops."""

    @classmethod
    def _select_chest_name(cls, level: int, source: str = "level_up") -> str:
        if source == "daily":
            return "COMMON_CHEST"
        if source == "challenge":
            return "RARE_CHEST"
        if level >= 20:
            return "LEGENDARY_CHEST"
        if level >= 12:
            return "EPIC_CHEST"
        if level >= 6:
            return "RARE_CHEST"
        return "COMMON_CHEST"

    @classmethod
    def give_chest_reward(cls, db: Session, user_id: int, level: int, source: str = "level_up"):
        chest_name = cls._select_chest_name(level, source=source)

        try:
            inventory_item = grant_chest_to_user(db, user_id, chest_name)
            db.commit()
            return build_chest_grant_payload(
                inventory_item,
                chest_name,
                level=level,
                source=source,
            )
        except Exception:
            db.rollback()
            logger.exception(
                "Не удалось выдать сундук: user_id=%s level=%s source=%s",
                user_id,
                level,
                source,
            )
            return None
