"""Fila dos arquivos (spec 082), numa tarefa da própria API (1 processo):
1. migra o que ainda está no banco (LargeBinary) para o disco, aos poucos;
2. sobe à nuvem da obra (original + `.md` com os metadados) com novas tentativas e espera crescente;
3. atualiza os `00-indice.md` (no máximo 1 vez por hora por obra);
4. libera o disco: original já na nuvem há mais de N dias (ou disco acima do limite) sai; a miniatura fica;
5. tira do servidor os arquivos que nada mais usa (depois de 1 dia).
"""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.arquivos.application.conexao import credencial, salvar_credencial
from app.modules.arquivos.application.registro import USUARIOS
from app.modules.arquivos.application.servico import apagar
from app.modules.arquivos.domain import zettel
from app.modules.arquivos.domain.provedor import ErroProvedor
from app.modules.arquivos.infra import disco
from app.modules.arquivos.infra.models import ArmazenamentoObraModel, ArquivoModel
from app.modules.arquivos.infra.provedores import provedor
from app.modules.obras.infra.models import ObraModel
from app.shared.errors import DomainError

log = logging.getLogger("malhet.arquivos")
ESPERA_MAX = timedelta(hours=6)
_ultimo_orfaos = 0.0


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def espera(tentativas: int) -> timedelta:
    """1, 2, 4, 8… minutos, no máximo 6 h."""
    return min(timedelta(minutes=2 ** max(tentativas - 1, 0)), ESPERA_MAX)


def caminho_obra(o: ObraModel) -> list[str]:
    return [zettel.RAIZ, "obras", zettel.codigo_pasta_obra(o.codigo, o.nome)]


def migrar_legado(s: Session, limite: int = 20) -> int:
    feitos = 0
    for u in USUARIOS.values():
        if feitos >= limite:
            break
        feitos += u.migrar(s, limite - feitos)
    return feitos


def _conexoes(s: Session) -> dict[int, ArmazenamentoObraModel]:
    return {c.obra_id: c for c in s.scalars(select(ArmazenamentoObraModel).where(
        ArmazenamentoObraModel.ativo.is_(True), ArmazenamentoObraModel.situacao != "reconectar"))}


def enviar_pendentes(s: Session, limite: int = 10) -> int:
    cfgs = _conexoes(s)
    if not cfgs:
        return 0
    agora = _agora()
    arqs = list(s.scalars(select(ArquivoModel).where(
        ArquivoModel.obra_id.in_(cfgs), ArquivoModel.situacao.in_(("local", "erro")), ArquivoModel.sensivel.is_(False),
        or_(ArquivoModel.proxima_tentativa.is_(None), ArquivoModel.proxima_tentativa <= agora)).order_by(ArquivoModel.id).limit(limite)))
    enviados = 0
    for obra_id in dict.fromkeys(a.obra_id for a in arqs):
        cfg, obra = cfgs[obra_id], s.get(ObraModel, obra_id)
        try:
            cred, prov = credencial(cfg), provedor(cfg.provedor)
        except DomainError as e:
            cfg.situacao, cfg.mensagem = "reconectar", str(e)
            continue
        base, falhou = caminho_obra(obra), False
        for a in (x for x in arqs if x.obra_id == obra_id):
            dados = disco.ler(a.obra_id, a.uid)
            if dados is None:
                a.situacao, a.erro = "erro", "o original não está no disco do servidor"
                a.proxima_tentativa = agora + ESPERA_MAX
                continue
            ficha = zettel.ficha_md(zettel.Ficha(id=a.uid, tipo=a.tipo, obra=base[-1], arquivo=a.nome, criado_em=a.criado_em,
                                                 hash_sha256=a.sha256, titulo=a.titulo, origem=a.origem, ligacoes=a.ligacoes or {}))
            try:
                ref = prov.enviar(cred, [*base, a.pasta], a.nome, dados, a.mime)
                prov.enviar(cred, [*base, a.pasta], a.nome.rsplit(".", 1)[0] + ".md", ficha.encode(), "text/markdown")
            except ErroProvedor as e:
                a.tentativas += 1
                a.situacao, a.erro, a.proxima_tentativa = "erro", str(e)[:1000], agora + espera(a.tentativas)
                cfg.situacao, cfg.mensagem = ("reconectar" if e.permanente else "erro"), str(e)[:1000]
                falhou = True
                log.warning("arquivo %s não subiu para %s: %s", a.id, cfg.provedor, e)
                if e.permanente:
                    break
                continue
            a.situacao, a.provedor, a.ref_remota, a.enviado_em = "enviado", cfg.provedor, ref, _agora()
            a.erro, a.tentativas, a.proxima_tentativa = None, 0, None
            enviados += 1
            salvar_credencial(cfg, cred)
            s.commit()  # cada arquivo enviado fica registrado mesmo se o próximo falhar
        salvar_credencial(cfg, cred)
        if not falhou:
            cfg.situacao, cfg.mensagem = "ok", None
    return enviados


def atualizar_indices(s: Session, intervalo: timedelta = timedelta(hours=1)) -> int:
    feitos, agora = 0, _agora()
    cfgs = _conexoes(s)
    for cfg in cfgs.values():
        if cfg.indice_em and agora - cfg.indice_em < intervalo:
            continue
        novo = s.scalar(select(func.count()).select_from(ArquivoModel).where(
            ArquivoModel.obra_id == cfg.obra_id, ArquivoModel.situacao == "enviado",
            ArquivoModel.enviado_em > (cfg.indice_em or datetime(2000, 1, 1, tzinfo=timezone.utc))))
        if not novo:
            continue
        obra = s.get(ObraModel, cfg.obra_id)
        base = caminho_obra(obra)
        contagens = dict(s.execute(select(ArquivoModel.pasta, func.count()).where(
            ArquivoModel.obra_id == cfg.obra_id, ArquivoModel.situacao == "enviado").group_by(ArquivoModel.pasta)).all())
        recentes = [(p, n) for p, n in s.execute(select(ArquivoModel.pasta, ArquivoModel.nome).where(
            ArquivoModel.obra_id == cfg.obra_id, ArquivoModel.situacao == "enviado").order_by(ArquivoModel.enviado_em.desc()).limit(20))]
        mesmas = [(zettel.codigo_pasta_obra(o.codigo, o.nome), o.nome) for o in s.scalars(
            select(ObraModel).join(ArmazenamentoObraModel, ArmazenamentoObraModel.obra_id == ObraModel.id).where(
                ArmazenamentoObraModel.provedor == cfg.provedor, ArmazenamentoObraModel.conta == cfg.conta))]
        try:
            cred, prov = credencial(cfg), provedor(cfg.provedor)
            prov.enviar(cred, base, "00-indice.md", zettel.indice_obra_md(base[-1], obra.nome, contagens, recentes, agora).encode(),
                        "text/markdown", substituir=True)
            prov.enviar(cred, [zettel.RAIZ], "00-INDICE.md", zettel.indice_raiz_md(mesmas, agora).encode(), "text/markdown", substituir=True)
            salvar_credencial(cfg, cred)
        except (ErroProvedor, DomainError) as e:
            log.warning("índice da obra %s não atualizou: %s", cfg.obra_id, e)
            continue
        cfg.indice_em = agora
        feitos += 1
    return feitos


def liberar_disco(s: Session, lote: int = 200) -> int:
    """Originais já na nuvem saem do disco depois do prazo da obra; acima do limite, os mais antigos saem antes."""
    liberados, agora = 0, _agora()
    for cfg in s.scalars(select(ArmazenamentoObraModel)):
        velhos = s.scalars(select(ArquivoModel).where(
            ArquivoModel.obra_id == cfg.obra_id, ArquivoModel.situacao == "enviado", ArquivoModel.no_disco.is_(True),
            ArquivoModel.criado_em < agora - timedelta(days=max(cfg.dias_no_disco, 0))).limit(lote))
        for a in velhos:
            disco.apagar(a.obra_id, a.uid)
            a.no_disco = False
            liberados += 1
    limite = int(get_settings().arquivos_limite_gb * 1024 ** 3)
    usado = s.scalar(select(func.coalesce(func.sum(ArquivoModel.tamanho), 0)).where(ArquivoModel.no_disco.is_(True))) or 0
    if usado > limite:
        for a in s.scalars(select(ArquivoModel).where(ArquivoModel.situacao == "enviado", ArquivoModel.no_disco.is_(True))
                           .order_by(ArquivoModel.criado_em).limit(lote)):
            if usado <= limite:
                break
            disco.apagar(a.obra_id, a.uid)
            a.no_disco, usado, liberados = False, usado - a.tamanho, liberados + 1
    return liberados


def apagar_orfaos(s: Session, idade: timedelta = timedelta(days=1)) -> int:
    """Só olha os tipos de quem se registrou (nunca apaga tipo sem dono conhecido)."""
    apagados = 0
    for u in USUARIOS.values():
        for a in s.scalars(select(ArquivoModel).where(ArquivoModel.tipo.in_(u.tipos), ArquivoModel.criado_em < _agora() - idade,
                                                      ArquivoModel.id.not_in(u.em_uso())).limit(500)):
            apagar(s, a)
            apagados += 1
    return apagados


def ciclo(s: Session) -> dict:
    global _ultimo_orfaos
    r = {"migrados": migrar_legado(s), "enviados": enviar_pendentes(s)}
    s.commit()
    r["indices"] = atualizar_indices(s)
    r["liberados"] = liberar_disco(s)
    if time.time() - _ultimo_orfaos > 3600:
        r["orfaos"] = apagar_orfaos(s)
        _ultimo_orfaos = time.time()
    s.commit()
    return r


_tarefa: threading.Thread | None = None


def iniciar() -> None:
    """Tarefa em segundo plano (thread): a cada 30 s, ou 5 s enquanto houver trabalho."""
    global _tarefa
    if _tarefa is not None or not get_settings().arquivos_fila:
        return

    def laco():
        from app.core.db import SessionLocal

        time.sleep(20)  # deixa a API subir primeiro
        while True:
            trabalho = False
            try:
                with SessionLocal() as s:
                    r = ciclo(s)
                    trabalho = bool(r["migrados"] or r["enviados"])
            except Exception:  # noqa: BLE001
                log.exception("fila de arquivos")
            time.sleep(5 if trabalho else 30)

    _tarefa = threading.Thread(target=laco, name="fila-arquivos", daemon=True)
    _tarefa.start()
