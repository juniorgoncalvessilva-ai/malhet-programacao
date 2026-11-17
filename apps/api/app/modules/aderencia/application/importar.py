"""Importar a apresentação anterior (spec 104): o .pptx vira o modelo das apresentações da obra (fundos, capa, rodapé da
contratada) e os valores das semanas que ele traz entram no histórico, tomados como reais."""
import zipfile
from io import BytesIO

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.aderencia.domain.aderencia import Registro, Texto, chave_nome, ler_historico
from app.modules.aderencia.infra.models import AderenciaHistoricoModel, ModeloApresentacaoModel
from app.modules.arquivos.application import servico as arquivos
from app.modules.arquivos.application.registro import Usuario, registrar
from app.shared.errors import DomainError

PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
MAX = 40 * 1024 * 1024


def _abrir(dados: bytes):
    from pptx import Presentation

    if len(dados) > MAX:
        raise DomainError("apresentação maior que 40 MB", "arquivo")
    try:
        with zipfile.ZipFile(BytesIO(dados)) as z:
            if "ppt/presentation.xml" not in z.namelist():
                raise DomainError("envie uma apresentação do PowerPoint (.pptx)", "arquivo")
        return Presentation(BytesIO(dados))
    except (zipfile.BadZipFile, KeyError, ValueError):
        raise DomainError("envie uma apresentação do PowerPoint (.pptx)", "arquivo") from None


def textos_dos_slides(prs) -> list[list[Texto]]:
    from pptx.util import Emu

    def andar(shapes, out):
        for sh in shapes:
            if sh.shape_type == 6:
                andar(sh.shapes, out)
            elif sh.has_text_frame and sh.text_frame.text.strip() and sh.left is not None:
                out.append(Texto(Emu(sh.left).cm, Emu(sh.top).cm, sh.text_frame.text))
    res = []
    for sl in prs.slides:
        out: list[Texto] = []
        andar(sl.shapes, out)
        res.append(out)
    return res


def contratada(s: Session, obra_id: int) -> str | None:
    from app.modules.obras.infra.models import MarcaObraModel

    m = s.get(MarcaObraModel, obra_id)
    return (m.nome_contratada or "").strip() or None if m else None


def importar(s: Session, obra_id: int, nome: str, dados: bytes, usuario: str, modelo: bool = True, historico: bool = True) -> dict:
    prs = _abrir(dados)
    regs: list[Registro] = ler_historico(textos_dos_slides(prs)) if historico else []
    gravados = 0
    for r in regs:
        k = chave_nome(r.responsavel)
        h = s.scalar(select(AderenciaHistoricoModel).where(AderenciaHistoricoModel.obra_id == obra_id,
                                                           AderenciaHistoricoModel.semana == r.semana,
                                                           AderenciaHistoricoModel.responsavel_chave == k))
        if h is None:
            h = AderenciaHistoricoModel(obra_id=obra_id, semana=r.semana, responsavel_chave=k)
            s.add(h)
        h.responsavel, h.programado, h.realizado = r.responsavel, r.programado, r.realizado
        h.origem, h.arquivo, h.criado_por = "apresentacao", nome[:200], usuario
        gravados += 1
    if modelo:
        arq = arquivos.guardar(s, obra_id, dados, PPTX, "modelo-apresentacao", titulo=f"Modelo de apresentação — {nome}",
                               nome_original=nome, origem="apresentacao_modelo")
        m = s.scalar(select(ModeloApresentacaoModel).where(ModeloApresentacaoModel.obra_id == obra_id))
        if m is None:
            m = ModeloApresentacaoModel(obra_id=obra_id)
            s.add(m)
        m.arquivo_id, m.nome, m.contratada, m.enviado_por = arq.id, nome[:200], contratada(s, obra_id), usuario
        m.enviado_em = func.now()
    s.flush()
    semanas = sorted({r.semana for r in regs})
    return {"modelo": modelo, "slides": len(prs.slides), "registros": gravados, "semanas": semanas,
            "lidos": [{"semana": r.semana, "responsavel": r.responsavel, "programado": r.programado, "realizado": r.realizado} for r in regs]}


def modelo_da_obra(s: Session, obra_id: int) -> tuple[ModeloApresentacaoModel | None, bool]:
    """O modelo da obra; sem ele, o de outra obra da mesma contratada (padrão da empresa). (modelo, herdado)."""
    m = s.scalar(select(ModeloApresentacaoModel).where(ModeloApresentacaoModel.obra_id == obra_id))
    if m is not None and m.arquivo_id:
        return m, False
    nome = contratada(s, obra_id)
    if not nome:
        return None, False
    outro = s.scalar(select(ModeloApresentacaoModel).where(func.upper(ModeloApresentacaoModel.contratada) == nome.upper(),
                                                           ModeloApresentacaoModel.arquivo_id.is_not(None))
                     .order_by(ModeloApresentacaoModel.enviado_em.desc()).limit(1))
    return outro, outro is not None


def bytes_do_modelo(s: Session, m: ModeloApresentacaoModel) -> bytes:
    from app.modules.arquivos.infra.models import ArquivoModel

    a = s.get(ArquivoModel, m.arquivo_id)
    if a is None:
        raise DomainError("o arquivo do modelo de apresentação não está mais guardado — envie de novo")
    return arquivos.abrir(s, a)


registrar(Usuario("modelos de apresentação", ("modelo-apresentacao",), lambda s, limite: 0,
                  lambda: select(ModeloApresentacaoModel.arquivo_id).where(ModeloApresentacaoModel.arquivo_id.is_not(None))))
