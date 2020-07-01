#!/bin/bash

set -ex

docker-compose down
docker-compose build
docker-compose up -d
sleep 18
docker-compose run e2e npm start
rc=$?
[ "$1" == "-s" ] && docker-compose down
exit $rc
