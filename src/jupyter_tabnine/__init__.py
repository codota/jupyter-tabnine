from notebook.utils import url_path_join as ujoin
from .handler import TabNineHandler
from .tabnine import TabNine

# Jupyter Extension points
def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyter_tabnine',
    }]

def _jupyter_nbextension_paths():
    return [{
        "section": "notebook",
        "dest": "jupyter_tabnine",
        'src': 'static',
        "require": "jupyter_tabnine/main"
    }]

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    host_pattern = '.*$'
    route_pattern = ujoin(web_app.settings['base_url'], '/tabnine')
    tabnine = TabNine()
    web_app.add_handlers(host_pattern, [(route_pattern, TabNineHandler, {'tabnine': tabnine})])
