# bngl-grammar-vscode README

This is a [VSCode](https://code.visualstudio.com/) language extension for BioNetGen modelling language. 

## Features

* Syntax highlighting for BioNetGen modelling language
* Various snippets to make writing BNGL simpler
* A run button that automatically generates a timestamped folder and runs the current model
* A plot button that generates a plot of the current .gdat/.cdat/.scan file

## Requirements

To use the run and plot buttons the default terminal you are using needs to have [Perl](https://www.perl.org/) installed as well as [BioNetGen commmand line interface](https://github.com/ASinanSaglam/BNG_cli) installed (you can do so with 'pip install -i https://test.pypi.org/simple/ bionetgen'). Current required version of the CLI is 0.2.2. Please note that both of these tools are in active development and is subject to large changes.

## Known Issues

Various highlighting issues
* Line breaks mostly do not work and where it works, any character after the line break breaks the highlighting of that line
* Need to update theme colors, using too many colors currently
* In the species/seed species block, the expression that determines the starting species counts does not allow spaces. 
* Any rule that has a line label of "0" and also has "0" as it's reactants will break the highlighting (e.g. following rule "0 0 -> A k" won't highlight correctly).

A couple issues with buttons
* Run button finish warning pops up immediate and doesn't wait for the run to finish. This is hard to check for a couple reasons, the main one being that a BNGL file can generate various files and we can't check if the terminal is responsive again from VSCode API directly. 

## Installation

The extension can be found in the marketplace as BNGL-grammar. This is subject to change. 

You can also clone the repo and place it under your VSCode extensions folder or you can use it in debug mode.

To use it in debug mode:

1.	Download VSCode from https://code.visualstudio.com 
2.	Open VSCode and open a new terminal
	* Terminal -> New Terminal, or
    * control + ~
3.	In the terminal, run this line:
git clone https://github.com/ASinanSaglam/bngl-grammar-vscode.git
	to clone the repo in the desired directory
4.	File -> Open to open the repo folder (bngl-grammar-vscode)
5.	To run the extension,
    * Run -> Start Debugging, or
    * F5
which will open up a new window running the extension
6.	Open an existing .bngl file or create a new .bngl file


Notes:
* Make sure the theme is dark-bngl
* To change the theme:
  Control + shift + P  Preferences: Color Theme  dark-bngl
* If suggestions disappear for tab autocomplete when typing in the .bngl file, control + space to show suggestions again
* To inspect elements: 
  Control + shift + P  Developer: Inspect Editor Tokens and Scopes


## Release Notes

No releases yet, current working version is 0.2.7. The extension currently supports mostly functional highlighting, various snippets and a run button that requires BioNetGen command line interface ([you can get it here](https://github.com/ASinanSaglam/BNG_cli)) and very basic plotting support for .gdat/.cdat/.scan files. 

-----------------------------------------------------------------------------------------------------------