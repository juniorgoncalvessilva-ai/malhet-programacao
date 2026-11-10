#!/usr/bin/env bash
# Acompanha um deploy do Coolify até terminar e testa a aplicação publicada.
# Uso: acompanhar-deploy.sh <deployment_uuid>   (env: COOLIFY_URL, COOLIFY_TOKEN, APP_URL)
set -uo pipefail
dep="$1"; fim=$((SECONDS + 1500)); ultimo=""; status=""
while [ $SECONDS -lt $fim ]; do
  corpo=$(curl -sS -m 30 -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_URL/api/v1/deployments/$dep" || true)
  status=$(printf '%s' "$corpo" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("status",""))
except Exception: print("")')
  if [ "$status" != "$ultimo" ]; then echo "$(date +%H:%M:%S) status: ${status:-?}"; ultimo="$status"; fi
  case "$status" in
    finished) break ;;
    failed|cancelled*|error)
      echo "::error::Deploy $dep terminou como $status. Últimas linhas do log:"
      printf '%s' "$corpo" | python3 -c 'import sys,json
d=json.load(sys.stdin); logs=d.get("logs") or "[]"
try: logs=json.loads(logs)
except Exception: logs=[{"output":str(logs)}]
for l in logs[-80:]: print((l.get("output") or "").rstrip()[:400])'
      exit 1 ;;
  esac
  sleep 20
done
[ "$status" = "finished" ] || { echo "::error::Deploy não terminou em 25 min (status: $status)"; exit 1; }
echo "Deploy concluído. Testando $APP_URL ..."
web=""; api=""
for i in $(seq 1 18); do
  web=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$APP_URL/pt-BR/auth/entrar" || true)
  api=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$APP_URL/backend/health" || true)
  echo "tentativa $i: web=$web api=$api"
  if [ "$web" = "200" ] && [ "$api" = "200" ]; then echo "Aplicação no ar: $APP_URL"; exit 0; fi
  sleep 10
done
echo "::error::Deploy concluído no Coolify, mas $APP_URL não respondeu 200 (web=$web api=$api). Confira a porta/domínio do serviço web."
exit 1
