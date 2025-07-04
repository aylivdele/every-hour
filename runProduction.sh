#!/usr/bin/env bash

npm run build
SCRIPT_DIR=$(dirname $0)
touch "$SCRIPT_DIR/.env"
cp "$SCRIPT_DIR/.env" "$SCRIPT_DIR/dist/.env"
pm2 start 