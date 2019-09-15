#!/usr/bin/env bash
set -e
if ! type "docker" > /dev/null; then
    echo "Please install docker first!"
fi

if ! type "jupyter" > /dev/null; then
    echo "Please install jupyter first!"
fi

IMAGE_NAME="tabnine-server:latest"
docker build -t=${IMAGE_NAME} .
docker run --rm --name jupyter-tabnine-server \
    -p 9999:8080 -d ${IMAGE_NAME}

[ ! -d ${HOME}/.jupyter/custom ] \
    && mkdir -p ${HOME}/.jupyter/custom

jupyter nbextension install plugin/tabnine --user
jupyter nbextension enable tabnine/main --user
cp plugin/custom/custom.css ${HOME}/.jupyter/custom/

echo "Please start your jupyter notebook and enjoy :)"
