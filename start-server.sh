#!/usr/bin/env bash
set -e
if ! type "docker" > /dev/null; then
    echo "Please install docker first!"
fi

IMAGE_NAME="tabnine-server:latest"
docker build -t=${IMAGE_NAME} .
docker run --rm --name jupyter-tabnine-server \
    -p 9999:8080 -d ${IMAGE_NAME}
echo "Please start your jupyter notebook and enjoy :)"
