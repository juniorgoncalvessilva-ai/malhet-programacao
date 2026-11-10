from datetime import date

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import UsuarioAtual, usuario_admin, usuario_atual
from app.core.db import get_session
from app.modules.integracao_simova.application.exportar import gerar_ft_xlsx, gerar_oper_pendentes_xlsx
from app.modules.integracao_simova.application.importar_cadastros import (
    RelatorioImportacao,
    importar_frentes,
    importar_oper,
)
from app.modules.integracao_simova.application.importar_ft import importar_ft
from app.modules.programacao.domain.item_programacao import Status
from app.modules.programacao.infra.repository import SqlProgramacaoRepository
from app.modules.referencias.application.versoes import ativar_versao, nova_versao

router = APIRouter(prefix="/simova", tags=["integração Simova"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/importar/cadastros")
def importar_cadastros(oper: UploadFile | None = File(None), frente: UploadFile | None = File(None),
                       rotulo: str = "Cadastros Simova", s: Session = Depends(get_session),
                       u: UsuarioAtual = Depends(usuario_admin)):
    """OPER.xlsx (OPER_GRUPO, OPER, TAREFA, MATERIAL, EFETIVO_FUNCAO) e/ou FRENTE.xlsx. Gera versão SIMOVA vigente."""
    rel = RelatorioImportacao()
    if oper:
        importar_oper(s, oper.file, rel)
    if frente:
        importar_frentes(s, frente.file, rel)
    arquivos = ", ".join(f.filename or "" for f in (oper, frente) if f)
    v = nova_versao(s, "SIMOVA", rotulo, u.id, date.today(), arquivos, None)
    v.qtd_itens = sum(rel.contagem.values())
    ativar_versao(s, v.id)
    return {"versao_id": v.id, "contagem": rel.contagem, "avisos": rel.avisos}


@router.post("/importar/ft")
def importar_programacao(arquivo: UploadFile = File(...), s: Session = Depends(get_session),
                         u: UsuarioAtual = Depends(usuario_admin)):
    r = importar_ft(s, arquivo.file, u.id)
    return {"importados": r.importados, "erros": r.erros}


@router.get("/exportar/ft")
def exportar_ft(inicio: date, fim: date, marcar_exportado: bool = True, s: Session = Depends(get_session),
                _: UsuarioAtual = Depends(usuario_admin)):
    """FT_IMPORT_INTERMEDIARIA com os itens APROVADOS do período (layout exato do Simova)."""
    repo = SqlProgramacaoRepository(s)
    itens = repo.do_periodo(inicio, fim, Status.APROVADO.value)
    conteudo = gerar_ft_xlsx(itens)
    if marcar_exportado:
        for i in itens:
            repo.atualizar_status(i.marcar_exportado())
    nome = f"FT_IMPORT_INTERMEDIARIA_{inicio:%Y%m%d}_{fim:%Y%m%d}.xlsx"
    return Response(conteudo, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{nome}"',
                                                         "X-Itens": str(len(itens))})


@router.get("/exportar/opers-pendentes")
def exportar_opers(s: Session = Depends(get_session), _: UsuarioAtual = Depends(usuario_admin)):
    """OPERs criadas/alteradas na aplicação para retroalimentar o Simova (aba OPER)."""
    conteudo, n = gerar_oper_pendentes_xlsx(s)
    return Response(conteudo, media_type=XLSX, headers={"Content-Disposition": 'attachment; filename="OPER_pendentes.xlsx"',
                                                         "X-Itens": str(n)})
