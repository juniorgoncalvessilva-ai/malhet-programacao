"""Operações no Coolify pela API (roda no GitHub Actions, que alcança a VPS).

Uso: python coolify.py diagnostico | criar | deploy <app_uuid>
Env: COOLIFY_URL, COOLIFY_TOKEN, (criar) APP_URL, SUPERADMIN_EMAIL.
Nunca imprime segredos: só campos de uma lista permitida.
"""
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request

URL = os.environ["COOLIFY_URL"].rstrip("/") + "/api/v1"
TOKEN = os.environ["COOLIFY_TOKEN"]
REPO = os.environ.get("REPO", "juniorgoncalvessilva-ai/malhet-programacao")


def api(metodo: str, caminho: str, corpo: dict | None = None):
    req = urllib.request.Request(URL + caminho, method=metodo,
                                 data=json.dumps(corpo).encode() if corpo is not None else None,
                                 headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/json",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            try:
                return r.status, (json.loads(txt) if txt else None)
            except ValueError:
                return r.status, txt[:200]
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt[:500]


def so(d, chaves):
    return {k: d.get(k) for k in chaves if isinstance(d, dict) and k in d}


def diagnostico() -> None:
    for c in ("/version",):
        print(c, api("GET", c))
    st, servers = api("GET", "/servers")
    print("SERVERS", st, [so(s, ("uuid", "name", "ip", "is_reachable", "is_usable")) for s in (servers or [])]
          if isinstance(servers, list) else servers)
    st, projs = api("GET", "/projects")
    print("PROJECTS", st, [so(p, ("uuid", "name")) for p in projs] if isinstance(projs, list) else projs)
    for c in ("/github-apps", "/sources"):
        st, d = api("GET", c)
        print(c.upper(), st, [so(x, ("uuid", "id", "name", "organization", "is_public", "installation_id")) for x in d]
              if isinstance(d, list) else str(d)[:200])
    st, apps = api("GET", "/applications")
    if isinstance(apps, list):
        for a in apps:
            print("APP", so(a, ("uuid", "name", "git_repository", "git_branch", "build_pack", "docker_compose_location",
                                "status", "fqdn", "ports_exposes", "source_type", "source_id", "environment_id")))
    else:
        print("APPS", st, apps)
    st, keys = api("GET", "/security/keys")
    print("KEYS", st, [so(k, ("uuid", "name", "is_git_related")) for k in keys] if isinstance(keys, list) else keys)


def _gerar_env() -> dict[str, str]:
    import base64
    return {
        "POSTGRES_PASSWORD": secrets.token_urlsafe(24),
        "JWT_SECRET": secrets.token_urlsafe(48),
        "MFA_CIPHER_KEY": base64.urlsafe_b64encode(os.urandom(32)).decode(),
        "MFA_BACKUP_PEPPER": secrets.token_urlsafe(32),
        "SUPERADMIN_EMAIL": os.environ.get("SUPERADMIN_EMAIL") or "superadmin@malhet.local",
        "SUPERADMIN_PASSWORD": "Malhet" + secrets.token_urlsafe(12) + "9",
        "APP_URL": os.environ.get("APP_URL", "http://179.199.156.129:3000"),
        "WEB_PORT": "3000",
        "COOKIE_SECURE": "0",
        "HSTS": "0",
        "MAIL_PROVIDER": "console",
    }


def criar() -> None:
    st, servers = api("GET", "/servers")
    server = next((s for s in servers if s.get("is_usable", True)), servers[0])
    st, gh = api("GET", "/github-apps")
    gh = gh if isinstance(gh, list) else []
    gh_app = next((g for g in gh if not g.get("is_public")), None)
    st, proj = api("POST", "/projects", {"name": "Malhet Programação", "description": "Programação de obra × Simova"})
    print("PROJETO", st, so(proj, ("uuid",)) if isinstance(proj, dict) else proj)
    if st >= 300:
        sys.exit(1)
    base = {"project_uuid": proj["uuid"], "server_uuid": server["uuid"], "environment_name": "production",
            "git_repository": REPO, "git_branch": "main", "build_pack": "dockercompose",
            "docker_compose_location": "/docker-compose.coolify.yml", "ports_exposes": "3000",
            "name": "malhet", "description": "Malhet · Programação × Simova", "instant_deploy": False}
    if gh_app:
        st, app = api("POST", "/applications/private-github-app", {**base, "github_app_uuid": gh_app["uuid"]})
        print("APP (github app)", st, app if st >= 300 else so(app, ("uuid", "domains")))
    else:
        print("::error::Nenhum GitHub App privado no Coolify; não há como ler o repositório privado.")
        sys.exit(1)
    if st >= 300:
        sys.exit(1)
    uuid = app["uuid"]
    envs = [{"key": k, "value": v, "is_preview": False} for k, v in _gerar_env().items()]
    st, r = api("PATCH", f"/applications/{uuid}/envs/bulk", {"data": envs})
    print("ENVS", st, "ok" if st < 300 else r)
    with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as f:
        f.write(f"app_uuid={uuid}\n")
    print(f"APP_UUID={uuid}")
    deploy(uuid)


def deploy(uuid: str) -> None:
    st, r = api("POST", f"/deploy?uuid={uuid}&force=true")
    print("DEPLOY", st, r)
    if st >= 300:
        sys.exit(1)
    dep = r["deployments"][0]["deployment_uuid"]
    with open(os.environ.get("GITHUB_ENV", "/dev/null"), "a") as f:
        f.write(f"DEPLOY_UUID={dep}\n")


def detalhe(uuid: str) -> None:
    st, a = api("GET", f"/applications/{uuid}")
    if not isinstance(a, dict):
        print("APP", st, a); return
    print("APP", st, so(a, ("uuid", "name", "private_key_id", "repository_project_id", "source_type", "source_id",
                         "destination_type", "destination_id", "environment_id", "git_full_url")))
    dest = a.get("destination") or {}
    print("DEST", so(dest, ("uuid", "name", "network", "server_id")), so(dest.get("server") or {}, ("uuid", "name", "ip")))
    st, envs = api("GET", f"/projects")
    for p in envs if isinstance(envs, list) else []:
        st2, pd = api("GET", f"/projects/{p['uuid']}")
        print("PROJ", p["name"], [so(e, ("id", "name", "uuid")) for e in (pd or {}).get("environments", [])] if isinstance(pd, dict) else pd)


if __name__ == "__main__":
    if sys.argv[1] == "detalhe":
        detalhe(sys.argv[2]); sys.exit(0)
    acao = sys.argv[1]
    {"diagnostico": diagnostico, "criar": criar}.get(acao, lambda: deploy(sys.argv[2]))()
    time.sleep(0)
