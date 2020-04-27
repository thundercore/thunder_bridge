#!/bin/bash

set -ex

docker-compose down
docker-compose up --build deploy-contract
docker-compose up -d --build
sleep 5
docker-compose run e2e npm start
rc=$?
[ "$1" == "-s" ] && docker-compose down
exit $rc