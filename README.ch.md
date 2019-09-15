# Jupyter Notebook的TabNine自动补全插件
![jupyter-tabnine](https://github.com/wenmin-wu/jupyter-tabnine/blob/master/screenshots/demo.gif)

*Read this in other languages: [English](README.md), [中文](README.ch.md)*

Jupyter Notebook上基于TabNine的自动补全插件，实现基于深度学习的代码自动补全功能。

其他TabNine插件的实现版本通过在client端启动一个TabNine子进程，并通过管道读写来和TabNine子进程通信。这在Jupyter Notebook上是没法直接实现的，
因为Jupyter Notebook客户端插件不支持安装第三方库，原有的库又不支持启动子进程。

本项目通过分别实现一个Jupyter Notebook插件和一个Jupyter Server插件来解决这个问题。客户端和服务器通过HTTP来通信。
基于`JavaScript`的客户端插件根据文件内容构造请求数据，并向Server插件发送请求。基于`Python`的server插件在初始化时启动一个子进程来执行`TabNine`二进制文件，
在收到客户端请求后，将请求通过管道发送给`TabNine`并将TabNine的返回结果发送给客户端。

## 安装
整个安装步骤分为：安装python包、安装客户端插件和`enable`客户端、服务器插件，所有安装步骤都可以通过`pip`和`jupyter`命令完成。

### 1. 安装python包（以下任选其一）

* 从github repo 安装： `pip3 install https://github.com/wenmin-wu/jupyter-tabnine/archive/master.zip [--user][--upgrade]`
* 或者 从`pypi` 安装： `pip3 install jupyter-tabnine [--user][--upgrade]`
* 或者 从源码安装：
  ```Bash
  git clone https://github.com/wenmin-wu/jupyter-tabnine.git
  python3 setup.py install
  ```
  
### 2. 安装Notebook插件
`jupyter nbextension install --py jupyter_tabnine [--user|--sys-prefix|--system]`

### 3. enable Notebook 和 Server 插件
```Bash
jupyter nbextension enable --py jupyter_tabnine [--user|--sys-prefix|--system]
jupyter serverextension enable --py jupyter_tabnine [--user|--sys-prefix|--system]
```

---
如果你的Jupyter版本在4.2以前，因为`--py`在4.2版本以前的jupyter上没法用，所以步骤1以后操作比较tricky。你需要先找到`jupyter_tabnine`的安装路径，
然后手动安装。安装路径可以通过下面的命令找到：
```Python
python -c "import os.path as p; from jupyter_tabnine import __file__ as f, _jupyter_nbextension_paths as n; print(p.normpath(p.join(p.dirname(f), n()[0]['src'])))"
```
然后执行：
```Bash
jupyter nbextension install <output source directory>
jupyter nbextension enable jupyter_tabnine/main
jupyter serverextension enable <output source directory>
```
`<output source directory>` 是第一个`python`命令的输出结果。

## Tips
* 如果你想临时显示Jupyter Notebook原始的补全结果，可以按 `Shift` + `空格`。
* 如果你想关掉TabNine自动补全，既可以在Notebook nbextension 的页面 disable Jupyter TabNine。也可以点击 `Help` 在弹框中找到 Jupyter TabNine把它点掉。
* 远程补全服务器也是支持的。如果你想部署个Server来处理客户端插件请求，或者你们公司在`Kubernetes`上部署一个Server Cluter请看下面章节了解如何部署自动补全Server。

## 部署自动补全Server (可选)
