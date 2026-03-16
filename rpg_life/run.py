import traceback

import uvicorn


if __name__ == "__main__":
    try:
        print("Запуск сервера...")
        from app.main import app

        print("Приложение загружено успешно")
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except Exception:
        print("Ошибка при запуске:")
        print(traceback.format_exc())
        input("Нажми Enter, чтобы выйти...")
