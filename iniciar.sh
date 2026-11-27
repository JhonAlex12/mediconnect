#!/bin/sh
# Mediconnect: abre el sistema en este equipo (Mac o Linux). Solo necesita Node.js.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró Node.js. Instale la versión LTS desde https://nodejs.org y vuelva a intentarlo."
  exit 1
fi
exec node iniciar/iniciar.js
