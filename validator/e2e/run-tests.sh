#!/bin/bash

set -ex

docker-compose up -d --build --force-recreate
docker-compose run e2e npm run deploy
docker-compose run -d bridge-erc npm run watcher:signature-request
docker-compose run -d bridge-erc npm run watcher:collected-signatures
docker-compose run -d bridge-erc npm run watcher:affirmation-request
docker-compose run -d bridge-erc npm run sender:home
docker-compose run -d bridge-erc npm run sender:foreign
docker-compose run e2e npm start
rc=$?
[ "$1" == "-s" ] && docker-compose down
exit $rc
