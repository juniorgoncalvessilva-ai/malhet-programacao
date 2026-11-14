from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://app:app@localhost:5432/programacao"
    cors_origins: str = "http://localhost:3000"
    # Pool do banco (spec 082): 1 processo da API na KVM1; o Postgres aceita 100 conexões.
    db_pool_size: int = 10
    db_pool_overflow: int = 10
    db_pool_timeout: int = 10
    # Dev/testes: pula a autenticação do auth-kit. Nunca em produção.
    auth_disabled: bool = False

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
