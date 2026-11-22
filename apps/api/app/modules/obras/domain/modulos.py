"""Módulos contratados por obra (spec 125): o que se vende separado liga e desliga por obra, sem virar "app" no menu.

Desligar um módulo esconde as telas dele no computador e no celular (e do editor de menus por perfil); os dados ficam
guardados e religar devolve tudo. O núcleo (programação, cronograma, WBS, campo, equipes, efetivo, cadastros e
administração) não desliga. Quem liga e desliga é o super admin, em Obras e usuários.
"""
from dataclasses import dataclass

from app.shared.errors import DomainError


@dataclass(frozen=True)
class Modulo:
    chave: str
    nome: str
    descricao: str
    web: tuple[str, ...]
    celular: tuple[str, ...] = ()


MODULOS: dict[str, Modulo] = {m.chave: m for m in (
    Modulo("documentos", "Documentos e take-off do projeto", "LDO, revisões, GRD, projetos no campo e quantidades do desenho",
           ("/app/documentos",), ("/m/documentos",)),
    Modulo("plano", "Plano de 90 dias e restrições (6WLA)", "Plano de médio prazo, pull planning e restrições",
           ("/app/plano", "/app/restricoes"), ("/m/restricoes",)),
    Modulo("auditorias", "Auditorias e plano de ação 5W2H", "Auditorias por modelo, ver e agir e ações com evidência",
           ("/app/auditorias", "/app/acoes"), ("/m/auditorias", "/m/acoes")),
    Modulo("ssma", "Segurança (SSMA)", "ASOs e treinamentos, SSMA da programação, etilômetro e LGPD",
           ("/app/ssma", "/app/ssma/cadastros", "/app/preventivos", "/app/lgpd"), ("/m/preventivos", "/m/lgpd")),
    Modulo("presenca", "Presença por crachá e rosto", "Apropriação de presença por NFC, QR e rosto",
           ("/app/presenca", "/app/efetivo/identificacao"), ("/m/presenca",)),
    Modulo("mobilizacao", "Mobilização e vagas", "Vagas, funil de mobilização e métricas", ("/app/efetivo/mobilizacao",)),
    Modulo("aderencia", "Aderência financeira", "Aderência semanal em R$ e apresentação da semana", ("/app/aderencia",)),
)}


def validar(chaves: list[str] | None) -> list[str]:
    out: list[str] = []
    for c in chaves or []:
        if c not in MODULOS:
            raise DomainError(f"módulo desconhecido: {c}", "modulos_desligados")
        if c not in out:
            out.append(c)
    return out


def telas_desligadas(chaves: list[str] | None) -> list[str]:
    return [u for c in chaves or [] if c in MODULOS for u in (*MODULOS[c].web, *MODULOS[c].celular)]
