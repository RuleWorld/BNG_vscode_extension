TODO: Add the fourth way by adding vsix bundles into releases on GH. 

Download and install VS Code from https://code.visualstudio.com. Once 
VS Code is installed, there are three ways to use this VS Code extension

* Using the [marketplace](https://marketplace.visualstudio.com/items?itemName=als251.bngl)
* Cloning the [repository](https://github.com/RuleWorld/BNG_vscode_extension) and placing it under [your VSCode extensions folder](https://code.visualstudio.com/docs/editor/extension-gallery#_where-are-extensions-installed)
* Cloning the [repository](https://github.com/RuleWorld/BNG_vscode_extension) and using the extension in debug mode

To use the extension in debug mode:

1.	Open VS Code and open a new terminal
	* __Terminal__ -> __New Terminal__, or
    * ```CTRL/CMD + ~```
2.	In the terminal, run this line:
```git clone https://github.com/RuleWorld/BNG_vscode_extension.git```
	to clone the repository in the desired directory
3.	__File__ -> __Open__ to open the repository folder (BNG_vscode_extension)
4.	To run the extension,
    * __Run__ -> __Start Debugging__, or
    * ```F5```
which will open up a new window running the extension
5.	Open an existing ```.bngl``` file or create a new file with ```.bngl``` extension