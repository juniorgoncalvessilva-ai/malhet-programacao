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
    # Arquivos (spec 082, fase 4): disco da VPS como cache quente + Google Drive / OneDrive / Dropbox por obra.
    arquivos_dir: str = "data/arquivos"  # no Docker: /data/arquivos (volume)
    arquivos_fila: bool = True  # tarefa que sobe à nuvem, migra os arquivos do banco e libera o disco
    arquivos_limite_gb: float = 25.0  # acima disso, originais já na nuvem saem do disco antes do prazo
    app_url: str = "http://localhost:3000"  # endereço público (volta do login OAuth dos provedores)
    armazenamento_chave: str = ""  # cifra os tokens dos provedores; vazio = derivada do JWT_SECRET
    google_client_id: str = ""
    google_client_secret: str = ""
    ms_client_id: str = ""
    ms_client_secret: str = ""
    dropbox_app_key: str = ""
    dropbox_app_secret: str = ""
    # Dev/testes: pula a autenticação do auth-kit. Nunca em produção.
    auth_disabled: bool = False

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
