#!/usr/bin/env bash
cd $(dirname $0)
npm run build
cd dist
pm2 start index.js --restart-delay 60000 --watch