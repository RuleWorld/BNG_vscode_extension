# BioNetGen VSCode extension

This is a [VSCode](https://code.visualstudio.com/) language extension for BioNetGen modelling language. Please read the [installation guide](https://github.com/RuleWorld/BNG_vscode_extension#installation) and see [here](docs/guide.md) for a simple starter guide.

## Features

* Syntax highlighting for BioNetGen modelling language
* Various snippets to make writing BNGL simpler
  <img src=https://raw.githubusercontent.com/RuleWorld/BNG_vscode_extension/main/assets/snippets.gif>
* A run button that automatically generates a timestamped folder and runs the current model
  <img src=https://raw.githubusercontent.com/RuleWorld/BNG_vscode_extension/main/assets/runner.gif>
* A plot button that generates a plot of the current .gdat/.cdat/.scan file using the CLI
  <img src=https://raw.githubusercontent.com/RuleWorld/BNG_vscode_extension/main/assets/plotting_cli.gif>
* Another plotting button that uses plotly to generate built-in plots within VSCode
  <img src=https://raw.githubusercontent.com/RuleWorld/BNG_vscode_extension/main/assets/plotting.gif>

## Requirements

To use the run and plot buttons the default terminal you are using needs to have [Perl](https://www.perl.org/) installed as well as [BioNetGen commmand line interface](https://github.com/ASinanSaglam/BNG_cli) installed (you can do so with 'pip install bionetgen'). Current required version of the CLI is 0.2.6. Please note that both of these tools are in active early development and is subject to sweeping changes.

## Installation

The extension can be found in the marketplace as "BioNetGen Language". 

You can also clone the repo and place it under your VSCode extensions folder or you can use it in debug mode: 

1.	Download VSCode from https://code.visualstudio.com 
2.	Open VSCode and open a new terminal
	* Terminal -> New Terminal, or
    * control + ~
3.	In the terminal, run this line:
git clone https://github.com/RuleWorld/BNG_vscode_extension.git
	to clone the repo in the desired directory
4.	File -> Open to open the repo folder (BNG_vscode_extension)
5.	To run the extension,
    * Run -> Start Debugging, or
    * F5
which will open up a new window running the extension
6.	Open an existing .bngl file or create a new .bngl file


Notes and tips:
* Make sure the theme is dark-bngl
* To change the theme:
  Control + shift + P -> Preferences: Color Theme  dark-bngl
* If suggestions disappear for tab autocomplete when typing in the .bngl file, control + space to show suggestions again
* To inspect elements (for checking highlighting issues): 
  Control + shift + P -> Developer: Inspect Editor Tokens and Scopes

## Known Issues

Some highlighting issues
* Line breaks do not work
* Theme colors will be updated

Some plotting issues
* Can't save plots from built-in plotting
* Built-in plotting alignment

Plotly issue
* Sometimes the plot doesn't show up the first time you click the button

Please submit an issue [here](https://github.com/ASinanSaglam/BNG_vscode_extension/issues) if you find one. 

## Release Notes

No releases yet, current working version is 0.3.3. The extension currently supports mostly functional highlighting, various snippets, a run button that requires BioNetGen command line interface ([you can get it here](https://github.com/RuleWorld/PyBioNetGen)) and very basic both via the command line interface as well as built-in plotting that uses [Plotly](https://plotly.com/javascript/) for .gdat/.cdat/.scan files. 

-----------------------------------------------------------------------------------------------------------