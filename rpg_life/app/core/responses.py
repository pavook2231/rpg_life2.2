from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder


def success_response(data=None, message: str = "", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "success",
            "data": jsonable_encoder(data if data is not None else {}),
            "message": message,
        },
    )


def error_payload(message: str, data=None) -> dict:
    return {
        "status": "error",
        "data": data if data is not None else {},
        "message": message,
    }
