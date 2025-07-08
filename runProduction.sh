#!/usr/bin/env bash
cd $(dirname $0)
npm run build
touch .env
cp .env dist/.env
cd dist
pm2 start index.js --restart-delay 60000 --watch --name every-hour