# Jupyter TabNine

## Overview
![jupyter-tabnine](https://github.com/wenmin-wu/jupyter-tabnine/blob/master/screenshots/demo.gif)

This project provides coding autocompletion based on [TabNine](https://github.com/zxqfl/TabNine) for Jupyter.

Other client plugins of TabNine require starting a child process for TabNine binary and using Pipe for communication.
This can't be done with Jupyter Notebook, since child process can't be created with JQuery and Jupyter Notebook doesn't provide any way for adding third-part js libs to plugins.

In this repository, it is achieved through ching the plugin to a HTTP client and starting a server wirtten in Golang to wrap the TabNine binray and handle the clients requests.

## Install

### Prerequirements
* docker
* jupyter >= 4.1 (you can check with `jupyter --version`)
* git clone this project by running `git clone git@github.com:wenmin-wu/jupyter-tabnine.git`

### For Linux or Mac

Just run `bash bootstrap.sh` you can also install it manually as following.

### For Windows (or Manually)

#### 1. Build docker image

* `docker build -t="tabnine-server:latest"`
#### 2. Run server

```Bash
docker run --rm --name jupyter-tabnine-server \
    -p 9999:8080 -d tabnine-server:latest
```

#### 3. Install plugin for Jupyter
```Bash
jupyter nbextension install plugin/tabnine --user
jupyter nbextension enable tabnine/main --user

mkdir -p ${HOME}/.jupyter/custom/ #For windows: mkdir -p %HOMEPATH%\.jupyter\custom
cp plugin/custom/custom.css ${HOME}/.jupyter/custom/ #For windows: cp plugin/custom/custom.css %HOMEPATH%\.jupyter\custom\
```

## TODO
- [ ] Package this extension to a pypi package.
- [ ] Develop an extension for JupyterLab.
