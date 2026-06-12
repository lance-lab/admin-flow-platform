from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://admin_flow:admin_flow@localhost:5432/admin_flow"
    ai_provider: str = "ollama"
    ai_base_url: str = "http://host.docker.internal:11434"
    ai_api_key: str = ""
    ai_model: str = "gemma3:4b"
    ai_timeout_seconds: float = 120


settings = Settings()
