import setuptools
import os
import codecs
from glob import glob


def read(rel_path):
    here = os.path.abspath(os.path.dirname(__file__))
    with codecs.open(os.path.join(here, rel_path), "r") as fp:
        return fp.read()


def get_version(rel_path):
    for line in read(rel_path).splitlines():
        if line.startswith("__version__"):
            delim = '"' if '"' in line else "'"
            return line.split(delim)[1]
    else:
        raise RuntimeError("Unable to find version string.")


with open("./README.rst") as f:
    readme = f.read()

setuptools.setup(
    name="jupyter_tabnine",
    version=get_version("src/jupyter_tabnine/_version.py"),
    url="https://github.com/wenmin-wu/jupyter-tabnine",
    author="Wenmin Wu",
    long_description=readme,
    long_description_content_type="text/x-rst",
    author_email="wuwenmin1991@gmail.com",
    license="MIT",
    description="Jupyter notebook extension which support coding auto-completion based on Deep Learning",
    packages=setuptools.find_packages("src"),
    package_dir={"": "src"},
    data_files=[("static", glob("src/jupyter_tabnine/static/*"))],
    install_requires=[
        "ipython",
        "jupyter_core",
        "nbconvert",
        "notebook >=4.2",
    ],
    python_requires=">=3.5",
    classifiers=[
        "Framework :: Jupyter",
    ],
    include_package_data=True,
    zip_safe=False,
)
