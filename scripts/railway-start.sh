#!/bin/sh
# Arranque en Railway: los datos persistentes (SQLite + uploads) viven en el
# volumen montado en /data. Los archivos se sirven SOLO vía la ruta
# autenticada app/uploads/[...path] — nunca como estáticos de public/.
set -e

mkdir -p /data/uploads storage
rm -rf public/uploads storage/uploads
ln -sfn /data/uploads storage/uploads

npx prisma@5.22.0 migrate deploy
exec npx next start -p "${PORT:-3000}"
