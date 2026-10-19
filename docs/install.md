## Installation

Download and install [VS Code](https://code.visualstudio.com) 1.82 or newer. There are three ways to install this extension:

### 1. From the VS Code Marketplace

Open the Extensions tab (`Ctrl/Cmd+Shift+X`), search for **BioNetGen**, and click Install. ([Marketplace link](https://marketplace.visualstudio.com/items?itemName=BioNetGen-ext.biontegen-vscode-extension))

If you previously installed the older **BioNetGen Language** extension (`als251.bngl`), uninstall it first: that listing is no longer updated, and the two extensions conflict if both are installed.

### 2. From a VSIX package (for evaluators / pre-release testing)

This is the recommended method when testing a version that hasn't been published to the marketplace yet.

1. **Build the VSIX** (or obtain one from the developer):
   ```
   git clone https://github.com/RuleWorld/BNG_vscode_extension.git
   cd BNG_vscode_extension
   npm install
   npx vsce package
   ```
   This produces a file like `biontegen-vscode-extension-0.8.4.vsix`.

2. **Install the VSIX** in VS Code:
   - From the command line:
     ```
     code --install-extension biontegen-vscode-extension-0.8.4.vsix
     ```
   - Or from VS Code: open the Extensions tab, click the `...` menu at the top, select **Install from VSIX...**, and choose the file.

3. Reload VS Code when prompted.

### 3. Running from source (development mode)

Use this when actively developing the extension.

1. Clone and build:
   ```
   git clone https://github.com/RuleWorld/BNG_vscode_extension.git
   cd BNG_vscode_extension
   npm install
   ```

2. Open the folder in VS Code:
   ```
   code .
   ```

3. Press `F5` to launch the Extension Development Host. A new VS Code window will open with the extension loaded from source.

4. Open or create a `.bngl` file in the new window.

### Prerequisites for running simulations

The extension's editing features (syntax highlighting, diagnostics, autocomplete, etc.) work without any additional software. To **run simulations** and **visualize networks**, you need:

- [Python 3](https://www.python.org/) (we recommend [Anaconda](https://www.anaconda.com/products/individual))
- [PyBioNetGen](https://pypi.org/project/bionetgen/) (`pip install bionetgen`)
- Perl (Windows users: `conda install -c conda-forge perl`)

The extension will automatically check for PyBioNetGen on activation and offer to install it. You can verify manually by running `bionetgen -h` in a terminal.

When the extension installs or upgrades PyBioNetGen, it also keeps `setuptools<82` pinned for compatibility with current PyBioNetGen releases that still import `pkg_resources`.

### Additional setup

You may need to tell VS Code which Python interpreter to use. Open the command palette (`Ctrl/Cmd+Shift+P`) and run **Python: Select Interpreter**.
