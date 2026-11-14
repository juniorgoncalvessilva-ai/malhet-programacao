"""Fotos do campo no armazenamento de arquivos (spec 082): conteúdo no disco + nuvem da obra, a ficha diz a que a foto
se liga (programação, frente, área) para o acervo Zettelkasten. Também migra as fotos antigas que estavam no banco."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from app.modules.arquivos.application import servico as arquivos
from app.modules.arquivos.application.registro import Usuario, registrar
from app.modules.arquivos.domain.zettel import TIPOS
from app.modules.campo.domain.foto import tipo_da_imagem
from app.modules.campo.infra.models import FotoCampoModel


def _tipo(alvo: str) -> str:
    t = f"foto-{alvo}"
    return t if t in TIPOS else "foto-linha"


def ligacoes(s: Session, obra_id: int, alvo: str, alvo_id: int, data: date | None) -> dict:
    lig = {"alvo": alvo, "alvo_id": alvo_id, "data": data.isoformat() if data else None}
    if alvo == "linha":
        from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
        from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel

        ln = s.get(LinhaProgramacaoModel, alvo_id)
        if ln is not None:
            p, a = s.get(ProgramacaoModel, ln.programacao_id), s.get(AreaFrenteModel, ln.area_id)
            loc = s.get(LocalFrenteModel, a.local_id) if a else None
            lig |= {"programacao": p.titulo if p else None, "programacao_id": ln.programacao_id,
                    "area": f"{a.codigo} {a.descricao}" if a else None, "frente": f"{loc.codigo} {loc.descricao}" if loc else None,
                    "item_pq": ln.item_pq, "etapa": ln.etapa_nome, "id_crono": ln.id_crono}
    return lig


def nova_foto(s: Session, obra_id: int, alvo: str, alvo_id: int, data: date | None, legenda: str | None,
              conteudo: bytes, enviado_por: str) -> FotoCampoModel:
    mime = tipo_da_imagem(conteudo)
    f = FotoCampoModel(obra_id=obra_id, alvo=alvo, alvo_id=alvo_id, data=data, legenda=legenda, content_type=mime,
                       tamanho=len(conteudo), conteudo=None, enviado_por=enviado_por)
    s.add(f)
    s.flush()
    a = arquivos.guardar(s, obra_id, conteudo, mime, _tipo(alvo), titulo=legenda or alvo,
                         ligacoes=ligacoes(s, obra_id, alvo, alvo_id, data), origem=f"foto_campo:{f.id}")
    f.arquivo_id = a.id
    return f


def conteudo(s: Session, f: FotoCampoModel, mini: bool = False) -> bytes:
    from app.modules.arquivos.infra.models import ArquivoModel

    if f.arquivo_id:
        return arquivos.abrir(s, s.get(ArquivoModel, f.arquivo_id), mini=mini)
    dados = s.scalar(select(FotoCampoModel.conteudo).where(FotoCampoModel.id == f.id)) or b""
    if mini:
        return arquivos.miniatura(dados) or dados
    return dados


def _migrar(s: Session, limite: int) -> int:
    fotos = list(s.scalars(select(FotoCampoModel).options(undefer(FotoCampoModel.conteudo))
                           .where(FotoCampoModel.arquivo_id.is_(None), FotoCampoModel.conteudo.is_not(None)).limit(limite)))
    for f in fotos:
        a = arquivos.guardar(s, f.obra_id, f.conteudo, f.content_type, _tipo(f.alvo), titulo=f.legenda or f.alvo,
                             ligacoes=ligacoes(s, f.obra_id, f.alvo, f.alvo_id, f.data), origem=f"foto_campo:{f.id}",
                             quando=f.enviado_em)
        f.arquivo_id, f.conteudo = a.id, None
    s.flush()
    return len(fotos)


def _em_uso():
    return select(FotoCampoModel.arquivo_id).where(FotoCampoModel.arquivo_id.is_not(None))


registrar(Usuario("fotos do campo", tuple(t for t in TIPOS if t.startswith("foto-")), _migrar, _em_uso))
