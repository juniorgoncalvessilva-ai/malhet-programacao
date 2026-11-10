#!/usr/bin/env bash
# Limpa a VPS para um deploy novo, PRESERVANDO o Coolify (painel na :8000).
# Uso:  bash limpar-vps.sh          -> só mostra o que seria removido (simulação)
#       bash limpar-vps.sh --apagar -> remove de verdade (pede confirmação digitando LIMPAR)
# Remove: containers que não são do Coolify, imagens/redes/cache sem uso e, com --volumes, volumes sem uso.
# Volumes de banco antigos guardam DADOS: só use --volumes se tiver certeza (e backup).
set -euo pipefail
APAGAR=0; VOLUMES=0
for a in "$@"; do case "$a" in --apagar) APAGAR=1 ;; --volumes) VOLUMES=1 ;; esac; done

coolify='^(coolify|coolify-db|coolify-redis|coolify-realtime|coolify-proxy|coolify-sentinel)$'
alvo=$(docker ps -a --format '{{.Names}}' | grep -Ev "$coolify" || true)

echo "== Containers que serão removidos (o Coolify fica):"; echo "${alvo:-  (nenhum)}"
echo "== Espaço em disco agora:"; df -h / | tail -1
if [ "$APAGAR" -ne 1 ]; then echo; echo "Simulação. Para remover: bash $0 --apagar [--volumes]"; exit 0; fi

read -r -p "Digite LIMPAR para confirmar: " ok; [ "$ok" = "LIMPAR" ] || { echo "Cancelado."; exit 1; }
[ -n "$alvo" ] && echo "$alvo" | xargs -r docker rm -f
docker image prune -af
docker network prune -f
docker builder prune -af
[ "$VOLUMES" -eq 1 ] && docker volume prune -af
echo "== Pronto. Espaço em disco:"; df -h / | tail -1
