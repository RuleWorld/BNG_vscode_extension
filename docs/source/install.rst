.. _install:

############
Installation
############

Installing from the VS Code Marketplace
----------------------------------------

1. Install `VS Code <https://code.visualstudio.com/>`_ 1.82 or newer.
2. Open the Extensions tab (``Ctrl/Cmd+Shift+X``), search for **BioNetGen**, and click Install.
   (`Marketplace link <https://marketplace.visualstudio.com/items?itemName=BioNetGen-ext.biontegen-vscode-extension>`_)

The extension will automatically check for PyBioNetGen on activation and offer to install it.
When the extension installs or upgrades PyBioNetGen, it also keeps ``setuptools<82``
pinned for compatibility with current PyBioNetGen releases that still import
``pkg_resources``.

Prerequisites for running models
---------------------------------

To run simulations and visualizations you need:

* `Python 3 <https://www.python.org/>`_ (we recommend `Anaconda <https://www.anaconda.com/products/individual>`_)
* `PyBioNetGen <https://pypi.org/project/bionetgen/>`_ (``pip install bionetgen``)
* Perl (Windows users: ``conda install -c conda-forge perl``)

Verify the installation by opening a VS Code terminal (``Ctrl/Cmd+``` ``) and running::

    bionetgen -h

Additional setup
================

You may need to tell VS Code which Python interpreter to use. Open the command palette
(``Ctrl/Cmd+Shift+P``) and run **Python: Select Interpreter**.

Installing from a VSIX file
============================

Download a ``.vsix`` release from `GitHub <https://github.com/RuleWorld/BNG_vscode_extension/releases>`_,
then install it with::

    code --install-extension bngl-x.y.z.vsix
