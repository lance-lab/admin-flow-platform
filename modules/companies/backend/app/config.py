from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://admin_flow:admin_flow@postgres:5432/admin_flow"


settings = Settings()
