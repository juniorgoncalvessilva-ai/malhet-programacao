"""Engine síncrono. ponytail: cada chamada abre uma sessão; sem transação entre repositórios.
Upgrade: uma unit-of-work compartilhada se um cadastro pela metade virar problema."""
from __future__ import annotations
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


def make_session_factory(url: str) -> sessionmaker[Session]:
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
    engine = create_engine(url, **kwargs)
    return sessionmaker(bind=engine, expire_on_commit=False)


class Db:
    def __init__(self, factory: sessionmaker[Session]):
        self.factory = factory

    def run(self, fn):
        session = self.factory()
        try:
            out = fn(session)
            session.commit()
            return out
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
