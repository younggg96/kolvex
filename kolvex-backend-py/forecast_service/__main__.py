import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("forecast_service.app:app", host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "8090")))
