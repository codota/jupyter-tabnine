# Jupyter TabNine

## Overview

This project provides coding autocompletion based on [TabNine](https://github.com/zxqfl/TabNine) for Jupyter.

Other client plugins of TabNine need start a child process for TabNine binary and use Pipe for communication.
I haven't found any solution to start a child process with `Jquery`. Neither have I found any solution to install third-part
Libs like `child_process` for Jupyter.

I solved this by change the plugin to a HTTP client and start a server written in `Golang` wrapped the TabNine binary and
handle the client's requests.

## Install
