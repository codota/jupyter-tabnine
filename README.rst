TabNine for Jupyter Notebook
==============================================
This extension for Jupyter Notebook enables the use of 
coding auto-completion based on Deep Learning.

Other client plugins of TabNine require starting a child process for TabNine binary
and using Pipe for communication. This can't be done with Jupyter Notebook, since child process 
can't be created with JQuery and Jupyter Notebook doesn't provide any way for adding third-part js libs to plugins.

In this repository, it is achived by developing a client plugin and a server plugin for Jupyter Notebook.
The client plugin generate request info and send http request to the server plugin. 
The server plugin pass the request info to it's client process (TabNine) and return the request to client plugin.

Installation
------------
The extension consists of a pypi package that includes a javascript
notebook extension, along with a python jupyter server extension.
Since Jupyter 4.2, pypi is the recommended way to distribute nbextensions.
The extension can be installed

- from the master version on the github repo (this will be always the most recent version)
- via pip for the version hosted on pypi

From the github repo or from Pypi,

1. install the package

   -  ``pip3 install https://github.com/wenmin-wu/jupyter-tabnine/archive/master.zip [--user][--upgrade]``
   -  or ``pip3 install jupyter-tabnine [--user][--upgrade]``
   -  or clone the repo and install
      ``git clone https://github.com/wenmin-wu/jupyter-tabnine.git``
      
      ``python3 setup.py install``

2. install the notebook extension

   ::

       jupyter nbextension install --py jupyter_tabnine [--user|--sys-prefix|--system]

3. and enable notebook extension and server extension

   ::

       jupyter nbextension enable --py jupyter_tabnine [--user|--sys-prefix|--system]
       jupyter serverextension enable --py jupyter_tabnine [--user|--sys-prefix|--system]

------------

For Jupyter versions before 4.2, the situation after step 1 is more
tricky, since the ``--py`` option isn't available, so you will have to
find the location of the source files manually as follows (instructions
adapted from [@jcb91](https://github.com/jcb91)'s
`jupyter\_highlight\_selected\_word <https://github.com/jcb91/jupyter_highlight_selected_word>`__).
Execute

::

    python -c "import os.path as p; from jupyter_tabnine import __file__ as f, _jupyter_nbextension_paths as n; print(p.normpath(p.join(p.dirname(f), n()[0]['src'])))"

Then, issue

::

    jupyter nbextension install <output source directory>
    jupyter nbextension enable jupyter_tabnine/jupyter_tabnine

where ``<output source directory>`` is the output of the first python
command.

Tips
------------
- A shortcut is added to let you switch between Jupyter raw completion and TabNine auto-competion. Just enter ``shift`` + ``space`` when you want raw completion of Jupyter :)
- Remote auto-completion server is also supported. You may want this to speed up the completion request handing. Or maybe your company want to deploy a compeltion server cluster that services everyone. Refer https://github.com/wenmin-wu/jupyter-tabnine to learn how to deploy remote server.
