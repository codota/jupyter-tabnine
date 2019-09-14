import setuptools
from glob import glob

setuptools.setup(
    name="jupyter_tabnine",
    version='1.0.0',
    url="https://github.com/wenmin-wu/jupyter-tabnine",
    author="Wenmin Wu",
    author_email="wuwenmin1991@gmail.com",
    license="GPL-3.0",
    description="Jupyter notebook extension which support coding auto-completion based on Deep Learning",
    packages=setuptools.find_packages('src'),
    package_dir={'': 'src'},
    install_requires=['ipython', 'jupyter_core', 'nbconvert', 'notebook >=4.2',],
    python_requires='>=3.5',
    classifiers=[
        'Framework :: Jupyter',
    ],
    data_files=[('share/jupyter/nbextensions/jupyter_tabnine',
                 glob('src/jupyter_tabnine/static/*'))],
    include_package_data=True,
    zip_safe=False
)
