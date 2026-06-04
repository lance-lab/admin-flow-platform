from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://admin_flow:admin_flow@postgres:5432/admin_flow"
    register_finance_base_url: str = "https://www.finreg.sk"
    register_finance_timeout_seconds: float = 15
    register_orcz_base_url: str = "https://or.justice.cz/ias/ui"
    register_orcz_timeout_seconds: float = 15
    register_orsr_base_url: str = "https://sluzby.orsr.sk"
    register_orsr_timeout_seconds: float = 15
    register_orsr_legacy_base_url: str = "https://www.orsr.sk"
    register_orsr_legacy_timeout_seconds: float = 15
    register_orsr_legacy_pdf_timeout_seconds: float = 30


settings = Settings()
