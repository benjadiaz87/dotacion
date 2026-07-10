#!/bin/sh
# Arranque en Railway: los datos persistentes (SQLite + uploads) viven en el
# volumen montado en /data; public/uploads se enlaza ahí.
set -e

mkdir -p /data/uploads
rm -rf public/uploads
ln -sfn /data/uploads public/uploads

npx prisma@5.22.0 migrate deploy
exec npx next start -p "${PORT:-3000}"
