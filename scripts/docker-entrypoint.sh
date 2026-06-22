#!/bin/sh
set -eu

APP_USER="${APP_USER:-node}"
APP_GROUP="${APP_GROUP:-node}"
APP_DATA_DIR="${APP_DATA_DIR:-${DATA_ROOT:-/app/data}}"
APP_CHOWN_PATHS="${APP_CHOWN_PATHS:-$APP_DATA_DIR}"

for path in $APP_CHOWN_PATHS; do
    if [ -n "$path" ]; then
        mkdir -p "$path"
        chown -R "$APP_USER:$APP_GROUP" "$path"
    fi
done

exec gosu "$APP_USER:$APP_GROUP" "$@"

