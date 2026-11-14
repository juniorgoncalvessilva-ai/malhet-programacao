"""Anexos de SSMA no armazenamento de arquivos (spec 082): pasta 50-ssma-anexos do acervo; migra os que estavam no banco."""
from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from app.modules.arquivos.application import servico as arquivos
from app.modules.arquivos.application.registro import Usuario, registrar
from app.modules.ssma.infra.models import AnexoSsmaModel, CadastroSsmaModel


def _lig(s: Session, cadastro_id: int) -> dict:
    m = s.get(CadastroSsmaModel, cadastro_id)
    return {"documento": m.tipo if m else None, "numero": m.codigo if m else None, "cobre": m.descricao if m else None,
            "cadastro_id": cadastro_id}


def novo_anexo(s: Session, obra_id: int, cadastro_id: int, nome: str, mime: str, conteudo: bytes, enviado_por: str) -> AnexoSsmaModel:
    a = AnexoSsmaModel(obra_id=obra_id, cadastro_id=cadastro_id, nome=nome, content_type=mime, tamanho=len(conteudo),
                       conteudo=None, enviado_por=enviado_por)
    s.add(a)
    s.flush()
    arq = arquivos.guardar(s, obra_id, conteudo, mime, "anexo-ssma", titulo=nome, nome_original=nome,
                           ligacoes=_lig(s, cadastro_id), origem=f"anexo_ssma:{a.id}")
    a.arquivo_id = arq.id
    return a


def conteudo(s: Session, a: AnexoSsmaModel) -> bytes:
    from app.modules.arquivos.infra.models import ArquivoModel

    if a.arquivo_id:
        return arquivos.abrir(s, s.get(ArquivoModel, a.arquivo_id))
    return s.scalar(select(AnexoSsmaModel.conteudo).where(AnexoSsmaModel.id == a.id)) or b""


def _migrar(s: Session, limite: int) -> int:
    anexos = list(s.scalars(select(AnexoSsmaModel).options(undefer(AnexoSsmaModel.conteudo))
                            .where(AnexoSsmaModel.arquivo_id.is_(None), AnexoSsmaModel.conteudo.is_not(None)).limit(limite)))
    for a in anexos:
        arq = arquivos.guardar(s, a.obra_id, a.conteudo, a.content_type, "anexo-ssma", titulo=a.nome, nome_original=a.nome,
                               ligacoes=_lig(s, a.cadastro_id), origem=f"anexo_ssma:{a.id}", quando=a.enviado_em)
        a.arquivo_id, a.conteudo = arq.id, None
    s.flush()
    return len(anexos)


def _em_uso():
    return select(AnexoSsmaModel.arquivo_id).where(AnexoSsmaModel.arquivo_id.is_not(None))


registrar(Usuario("anexos de SSMA", ("anexo-ssma",), _migrar, _em_uso))
