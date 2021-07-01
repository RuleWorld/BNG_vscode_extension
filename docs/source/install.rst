.. _install:

############
Installation
############

Installing under VS Code
-------------------------

You will need three things for this extension

1. `VS Code <https://code.visualstudio.com/>`_
2. `Anaconda python <https://www.anaconda.com/products/individual>`_
3. `PyBioNetGen <https://pybionetgen.readthedocs.io/en/latest/>`_

First, `download and install VS Code <https://code.visualstudio.com>`_. The suggested way to install this VS Code extension is
from the VS Code marketplace. Simply open the Extensions tab (or press ``CTRL/CMD + SHIFT + X``) after openinng VS Code and search 
for Bionetgen. `This package <https://marketplace.visualstudio.com/items?itemName=als251.bngl>`_ will show up, click install. 

Next you will need an anaconda python installation and you need to have your terminal environment set correctly. 
`Download and install anaconda python <https://docs.anaconda.com/anaconda/install/index.html>`_. In VS Code, open a new terminal
(``CTRL/CMD + ``` or under ``Terminal -> New Terminal``) and test if you have access to Python package manager `pip`. If you don't, 
you need to setup your environment so that the terminal has access to ``pip``, this is OS dependent and there are various guides 
you can find online.

Finally once you have access to ``pip``, run ``pip install bionetgen``. Once complete, make sure it's installed correctly by
running ``bionetgen -h``. You can find more information on installation `here <https://pybionetgen.readthedocs.io/en/latest/>`_.

Debug mode
----------

There are two other ways to install this VS Code extension

* Cloning the `repository <https://github.com/RuleWorld/BNG_vscode_extension>`_ and placing it under `your VSCode extensions folder <https://code.visualstudio.com/docs/editor/extension-gallery#_where-are-extensions-installed>`_
* Cloning the `repository <https://github.com/RuleWorld/BNG_vscode_extension>`_ and using the extension in debug mode

To use the extension in debug mode:

1. Download and install VS Code from https://code.visualstudio.com 
2. Open VS Code and open a new terminal
   
   * Terminal -> New Terminal, or
   * ``CTRL/CMD + ```

3. In the terminal, run this line: ``git clone https://github.com/RuleWorld/BNG_vscode_extension.git`` to clone the repository in the desired directory
4. File -> Open to open the repository folder (BNG_vscode_extension)
5. To open up a new window running the extension

   * Run -> Start Debugging, or
   * ``F5`` 

6. Open an existing ``.bngl`` file or create a new file with ``.bngl`` extension
