#!/usr/bin/env bash
cd $(dirname $0)
npm run build
pm2 start dist/index.js --restart-delay 60000 --watch