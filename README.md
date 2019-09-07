# Jupyter TabNine

## Overview
![jupyter-tabnine](https://github.com/wenmin-wu/jupyter-tabnine/blob/master/screenshots/jupyter-tabnine.png)

This project provides coding autocompletion based on [TabNine](https://github.com/zxqfl/TabNine) for Jupyter.

Other client plugins of TabNine need start a child process for TabNine binary and use Pipe for communication.
I haven't found any solution to start a child process with `Jquery`. Neither have I found any solution to install third-part
Libs like `child_process` for Jupyter.

I solved this by change the plugin to a HTTP client and start a server written in `Golang` wrapped the TabNine binary and
handle the client's requests.

## Install

### Prerequires
* docker
* jupyter >= 4.1 (you can check with `jupyter --version`)
* git clone this project by running `git clone https://github.com/`

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
