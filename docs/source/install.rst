.. _install:

############
Installation
############

Installing under VS Code
-------------------------

You will need two things for this extension (three for Windows users):

1. `VS Code <https://code.visualstudio.com/>`_
2. `Anaconda python <https://www.anaconda.com/products/individual>`_
3. Perl, for Windows users

First, `download and install VS Code <https://code.visualstudio.com>`_. The suggested way to install this VS Code extension is
from the VS Code marketplace. Simply open the Extensions tab (or press ``CTRL/CMD + SHIFT + X``) after openinng VS Code and search 
for BioNetGen. `This package <https://marketplace.visualstudio.com/items?itemName=als251.bngl>`_ will show up, click install. If 
this step doesn't work, please make sure you have the `latest version <https://vscode-docs.readthedocs.io/en/stable/supporting/howtoupdate/>`_.

Windows users should also install Perl at this point if not already installed. You can use ``conda install -c conda-forge perl`` to do this.

Next, you will need Python installed, and you need to have your terminal environment set correctly. We recommend 
`anaconda python <https://www.anaconda.com/products/individual>`_. `Download and install anaconda python <https://docs.anaconda.com/anaconda/install/index.html>`_. In VS Code, 
open a new terminal (``CTRL/CMD + ``` or under ``Terminal -> New Terminal``) and test if you have access to Python package manager `pip`. 
If you don't, you need to setup your environment so that the terminal has access to ``pip``; this is OS dependent and there are various 
guides you can find online.

The extension should automatically run ``pip install bionetgen`` to get PyBioNetGen. Once complete, make sure it's installed correctly by
running ``bionetgen -h``. If this doesn't work, try reloading VS Code and opening a .bngl file. Alternatively, you can open the command line in VS Code (``CTRL/CMD + Shift + P`` or under ``Help -> Show All Commands``) and select the "BNG setup" command.
You can find more information on installation `here <https://pybionetgen.readthedocs.io/en/latest/>`_.
