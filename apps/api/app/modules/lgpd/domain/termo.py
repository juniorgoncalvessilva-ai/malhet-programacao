"""LGPD (spec 074): termo de ciência e consentimento do colaborador e evidência das assinaturas. Só regras, sem banco.

Pontos da lei que guiam o desenho (Lei 13.709/2018):
- Biometria é dado pessoal sensível (art. 5º, II); o consentimento para dado sensível é específico e destacado, para
  finalidades específicas (art. 11, I) — por isso cada finalidade tem o seu "sim/não", nada vem marcado.
- No trabalho o consentimento precisa ser livre: quem não aceita usa crachá ou assinatura na tela, sem prejuízo.
- O titular pode revogar a qualquer momento (art. 8º, §5º) e tem os direitos do art. 18 (acesso, correção, eliminação…).
- Registro das operações e segurança (arts. 37 e 46): cada evidência tem hash SHA-256 e cada vez que alguém abre uma
  foto fica registrado quem e quando.
"""
import hashlib
import json
from dataclasses import dataclass

from app.shared.errors import DomainError

FINALIDADES = (
    {"chave": "biometria", "rotulo": "Reconhecimento facial",
     "descricao": "Usar o meu rosto (um código numérico gerado a partir da imagem, não a foto) para registrar presença e assinar "
                  "controles de segurança, como o teste do etilômetro."},
    {"chave": "foto_assinatura", "rotulo": "Foto no momento da assinatura",
     "descricao": "Guardar a foto tirada na hora em que eu assino com o rosto, como prova da assinatura em caso de auditoria ou "
                  "fiscalização."},
    {"chave": "localizacao", "rotulo": "Localização no momento do registro",
     "descricao": "Registrar as coordenadas (GPS) do aparelho no momento da assinatura, para comprovar onde ela foi feita."},
)
CHAVES = tuple(f["chave"] for f in FINALIDADES)


def texto_padrao(controlador: str, obra: str, contato: str | None, retencao: str | None) -> str:
    contato = contato or "o Departamento Pessoal / RH da obra"
    retencao = retencao or ("enquanto durar o meu contrato nesta obra e, depois, pelo prazo em que a empresa precisa guardar "
                            "provas para se defender em processos (até 5 anos)")
    return (
        f"TERMO DE CIÊNCIA E CONSENTIMENTO — DADOS PESSOAIS (LGPD)\n\n"
        f"Eu, colaborador(a) identificado(a) abaixo, declaro que fui informado(a) por {controlador} (controladora dos dados) "
        f"de que, na obra {obra}, os meus dados serão tratados assim:\n\n"
        "1. Dados usados: nome, matrícula, função, equipe, crachá, registros de presença e dos controles de segurança "
        "(como o resultado do etilômetro) e, somente se eu autorizar abaixo, o meu rosto, a foto do momento da assinatura e "
        "a localização do aparelho.\n"
        "2. Para que: controlar a presença no trabalho, aplicar e comprovar controles de segurança e saúde do trabalho e "
        "provar, em auditoria ou fiscalização, que fui eu quem assinou cada registro.\n"
        "3. Biometria é dado sensível: só é usada com o meu consentimento, que dou de forma livre, para cada item "
        "separadamente. Se eu não aceitar, registro presença e assino pelo crachá ou na tela, sem nenhum prejuízo.\n"
        "4. Quem acessa: a equipe de segurança, o DP/RH e a gestão da obra; a contratante ou a fiscalização só em auditoria. "
        "Cada acesso às fotos fica registrado.\n"
        f"5. Por quanto tempo: {retencao}.\n"
        "6. Meus direitos (art. 18 da LGPD): saber quais dados existem, corrigir, pedir a eliminação do que depende do meu "
        "consentimento e revogar este consentimento a qualquer momento — a revogação vale dali para frente.\n"
        f"7. Para exercer os direitos ou tirar dúvidas: {contato}.\n"
    )


def hash_texto(texto: str, finalidades: list[dict]) -> str:
    return hashlib.sha256(json.dumps({"t": texto, "f": finalidades}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def validar_termo(titulo: str, texto: str, finalidades: list[dict] | None) -> tuple[str, str, list[dict]]:
    titulo = " ".join((titulo or "").split())
    if len(titulo) < 5:
        raise DomainError("título do termo muito curto", "titulo")
    texto = (texto or "").strip()
    if len(texto) < 200:
        raise DomainError("o termo precisa explicar finalidades, direitos e contato (texto muito curto)", "texto")
    fins = []
    for f in finalidades or list(FINALIDADES):
        if f.get("chave") not in CHAVES:
            raise DomainError(f"finalidade desconhecida: {f.get('chave')}", "finalidades")
        rot = " ".join(str(f.get("rotulo") or "").split())
        desc = " ".join(str(f.get("descricao") or "").split())
        if not rot or len(desc) < 20:
            raise DomainError(f"finalidade {f['chave']}: explique em linguagem simples", "finalidades")
        fins.append({"chave": f["chave"], "rotulo": rot, "descricao": desc})
    if len({f["chave"] for f in fins}) != len(fins):
        raise DomainError("finalidade repetida", "finalidades")
    return titulo, texto, fins


def normalizar_escolhas(escolhas: dict | None, finalidades: list[dict]) -> dict[str, bool]:
    """Uma resposta (sim/não) para cada finalidade do termo — nada fica subentendido."""
    escolhas = escolhas or {}
    faltam = [f["rotulo"] for f in finalidades if not isinstance(escolhas.get(f["chave"]), bool)]
    if faltam:
        raise DomainError("responda sim ou não para: " + ", ".join(faltam), "escolhas")
    e = {f["chave"]: bool(escolhas[f["chave"]]) for f in finalidades}
    if e.get("foto_assinatura") and not e.get("biometria"):
        raise DomainError("a foto da assinatura depende do reconhecimento facial", "escolhas")
    return e


@dataclass(frozen=True)
class Consentimento:
    """O que vale hoje para a pessoa (último aceite não revogado)."""
    biometria: bool = False
    foto_assinatura: bool = False
    localizacao: bool = False
    versao: int | None = None
    situacao: str = "pendente"  # pendente | aceito | recusado | revogado | desatualizado

    def como_dict(self) -> dict:
        return {"biometria": self.biometria, "foto_assinatura": self.foto_assinatura, "localizacao": self.localizacao,
                "versao": self.versao, "situacao": self.situacao}


def consentimento(aceites: list[dict], versao_vigente: int | None) -> Consentimento:
    """aceites: dicts com versao, escolhas, revogado (bool), em ordem de registro."""
    if not aceites:
        return Consentimento()
    ult = aceites[-1]
    if ult["revogado"]:
        return Consentimento(versao=ult["versao"], situacao="revogado")
    e = ult["escolhas"] or {}
    algum = any(e.get(k) for k in CHAVES)
    sit = "aceito" if algum else "recusado"
    if algum and versao_vigente and ult["versao"] < versao_vigente:
        sit = "desatualizado"  # vale o que aceitou, mas há termo novo para apresentar
    return Consentimento(bool(e.get("biometria")), bool(e.get("foto_assinatura")), bool(e.get("localizacao")), ult["versao"], sit)


def hash_evidencia(meta: dict, foto: bytes | None) -> str:
    """SHA-256 dos metadados (ordenados) + bytes da foto: qualquer alteração posterior aparece na conferência."""
    h = hashlib.sha256(json.dumps(meta, ensure_ascii=False, sort_keys=True, default=str).encode())
    if foto:
        h.update(foto)
    return h.hexdigest()


def validar_geo(lat, lng, precisao) -> tuple[float | None, float | None, float | None]:
    if lat is None or lng is None:
        return None, None, None
    try:
        la, ln = float(lat), float(lng)
        pr = float(precisao) if precisao is not None else None
    except (TypeError, ValueError):
        raise DomainError("coordenadas inválidas", "geo") from None
    if not (-90 <= la <= 90 and -180 <= ln <= 180):
        raise DomainError("coordenadas inválidas", "geo")
    return round(la, 7), round(ln, 7), (round(pr, 1) if pr is not None else None)
