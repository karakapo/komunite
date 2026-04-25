from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Mom Test Wiro Backend"
    wiro_provider_name: str = "wiro-mock"
    realtime_websocket_url: str = "wss://realtime.wiro.example/session"
    voice_profile: str = "wiro-realtime-balanced"


settings = Settings()
