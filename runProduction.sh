#!/usr/bin/env bash
cd $(dirname $0)
npm run build
touch .env
cp .env dist/.env
pm2 start dist/index.js --restart-delay 60000 