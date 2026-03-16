from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import User, Friendship
from app.services.social_service import list_friends

engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

session = SessionLocal()

u1 = User(email='a@example.com', hashed_password='h', is_active=True)
u2 = User(email='b@example.com', hashed_password='h', is_active=True)
session.add_all([u1, u2])
session.commit()

session.add(Friendship(user_id=u1.id, friend_id=u2.id))
session.add(Friendship(user_id=u2.id, friend_id=u1.id))
session.commit()

print(list_friends(session, u1, 1, 10))
