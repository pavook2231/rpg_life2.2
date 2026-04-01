from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.text_utils import normalize_nested_strings, repair_mojibake


def success_response(data=None, message: str = "", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "success",
            "data": normalize_nested_strings(jsonable_encoder(data if data is not None else {})),
            "message": repair_mojibake(message) or "",
        },
    )


def error_payload(message: str, data=None) -> dict:
    return {
        "status": "error",
        "data": normalize_nested_strings(data if data is not None else {}),
        "message": repair_mojibake(message) or "",
    }
