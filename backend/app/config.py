from pathlib import Path

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="WIRO_",
        case_sensitive=False,
        extra="ignore",
        env_file=BACKEND_ENV_FILE,
        env_file_encoding="utf-8",
    )

    app_name: str = "Mom Test Wiro Backend"
    wiro_provider_name: str = "wiro"
    api_base_url: str = "https://api.wiro.ai/v1"
    realtime_websocket_url: str = "wss://socket.wiro.ai/v1"
    auth_mode: str = "none"
    api_key: str | None = None
    api_secret: str | None = None
    realtime_owner_slug: str = "openai"
    realtime_model_slug: str = "gpt-realtime"
    report_owner_slug: str = "Qwen"
    report_model_slug: str = "Qwen3.6-27B"
    voice_profile: str = "marin"
    elevenlabs_voice_id: str | None = None
    elevenlabs_tts_model_id: str | None = None
    input_audio_format: str = "audio/pcm"
    output_audio_format: str = "audio/pcm"
    input_audio_rate: str = "24000"
    output_audio_rate: str = "24000"
    transcription_model: str = "gpt-4o-transcribe"
    turn_detection_threshold: str = "0.5"
    turn_detection_silence_ms: str = "500"
    realtime_payload_json: str | None = None


settings = Settings()
