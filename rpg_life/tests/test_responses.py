from app.core.responses import error_payload, success_response


def test_error_payload_repairs_mojibake_message() -> None:
    payload = error_payload("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚")

    assert payload["message"] == "Пользователь уже существует"


def test_success_response_repairs_mojibake_message() -> None:
    response = success_response({"ok": True}, "Р РµРіРёСЃС‚СЂР°С†РёСЏ РІС‹РїРѕР»РЅРµРЅР°")

    assert "Регистрация выполнена" in response.body.decode("utf-8")
