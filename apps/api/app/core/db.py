from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_cfg = get_settings()
# Espera curta por conexão: com o pool cheio, melhor um erro rápido (a tela tenta de novo) que 30 s de fila.
engine = create_engine(_cfg.database_url, pool_pre_ping=True, pool_size=_cfg.db_pool_size,
                       max_overflow=_cfg.db_pool_overflow, pool_timeout=_cfg.db_pool_timeout)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
