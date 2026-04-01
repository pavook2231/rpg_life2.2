import hashlib
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import (
    ACCESS_COOKIE_NAME,
    ACCESS_TOKEN_EXPIRE_DELTA,
    ALGORITHM,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    CSRF_COOKIE_NAME,
    REFRESH_TOKEN_EXPIRE_DAYS,
    SECRET_KEY,
)
from app.core.dates import utc_now
from app.core.database import get_db
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
REFRESH_TOKEN_EXPIRE_DELTA = timedelta(days=max(1, REFRESH_TOKEN_EXPIRE_DAYS))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = utc_now() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "token_type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    token_id: str | None = None,
    return_payload: bool = False,
) -> str | tuple[str, dict]:
    to_encode = data.copy()
    expire = utc_now() + (expires_delta or REFRESH_TOKEN_EXPIRE_DELTA)
    to_encode.update({"exp": expire, "token_type": "refresh", "jti": token_id or secrets.token_urlsafe(24)})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    if return_payload:
        return token, to_encode
    return token


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def validate_token_type(payload: dict | None, expected_type: str) -> bool:
    return bool(payload and payload.get("token_type") == expected_type)


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if not payload or not validate_token_type(payload, "access"):
        raise credentials_exception

    email = payload.get("sub")
    if not email:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if not user or user.is_active != True:
        raise credentials_exception
    return user


async def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


async def get_current_user_from_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_token(token)
    if not payload or not validate_token_type(payload, "access"):
        raise credentials_exception
    email = payload.get("sub")
    if not email:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if not user or user.is_active != True:
        raise credentials_exception
    return user


def set_token_cookie(response, token: str, csrf_token: str | None = None) -> str:
    csrf_token = csrf_token or create_csrf_token()
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=int(ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
        samesite=COOKIE_SAMESITE,
        path="/",
        secure=COOKIE_SECURE,
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        max_age=int(ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
        samesite=COOKIE_SAMESITE,
        path="/",
        secure=COOKIE_SECURE,
    )
    return csrf_token


def clear_token_cookie(response):
    response.delete_cookie(
        key=ACCESS_COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        httponly=True,
        samesite=COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=CSRF_COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        httponly=False,
        samesite=COOKIE_SAMESITE,
    )


def validate_token(token: str) -> bool:
    return decode_token(token) is not None


def get_token_from_request(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get(ACCESS_COOKIE_NAME)


def hash_token_id(token_id: str) -> str:
    return hashlib.sha256(token_id.encode("utf-8")).hexdigest()
