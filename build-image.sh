#!/usr/bin/env bash
set -e
if ! type "docker" > /dev/null; then
    echo "Please install docker first!"
fi

wd=$(pwd)
container_wd=${wd#${HOME}}
echo "container working directory: ${container_wd}"
docker run --rm -v ${HOME}/go:/go golang:1.14-alpine3.11 \
    go build -o ${container_wd}/go/cmd/server ${container_wd}/go/cmd/server.go

docker build -t tabnine-server:latest .
