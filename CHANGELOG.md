# Change Log

All notable changes to the "bngl-grammar-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- 0.2.6
Currently we have ```.bngl``` run button, a ```.gdat/.cdat/.scan``` file plotting buttons as well as highlighting and various snippets. This version added ```.scan``` file plotting button and updated ```parameter_scan``` snippet.

- 0.2.8
Added plotly plotting to ```gdat/cdat/scan``` files

- 0.2.9
Major behavior changes, every click on the built-in plotting now pops open a new tab. Plots retain context (warning: memory intensive) and autosize depending on the window it's opened in. Added a refresh button to do the resizing after opening. Included jQuery. Working nonce for scripts. GML viewer still under development.

- 0.3.0
Plots appear in active window to give it more size. Plots now have some options on the left of the plot. Lasso selecting plots allow you to sub select time series, this is subject to heavy modification in the future. 

- 0.3.1
Quote protecting paths so paths that contain spaces will work. Added seconds to timestamps.

- 0.3.2
Plotly hovermode default changed to closest, legends are on by default if there's <= 5 series

- 0.3.3
Included net files to the list of file extensions this extension supports and added the syntax for it. Various small behavior changes, couple bug fixes and a couple snippet changes.

- 0.3.4
Moved plotly dropdown menus to the top. Fixed download image issue.

- 0.3.5
Fixed highlighing issue with line labels, wasn't highlighting without indent. Added README gifs to assets. 

- 0.3.6
The gdat file that shares a name with the model is now automatically opened after running a model.

- 0.3.6
Any gdat file that's found under the folder after running is automatically opened. Plotly plots are now assigned to ctrl/cmd+shift+f1 for easier plotting, CLI plotting is now on f2. Heavily updated readme and guide.

- 0.3.8
Bugfixes to syntax highlighting in species block, mods are not recognized correctly and spaces after species amount doesn't break amount highlighting

- 0.3.9
Further bugfixes to syntax highlighting. Separated "species" and "pattern" objects, they should work as expected now. "matchOnce" modifier was corrected to "MatchOnce". Multiple patterns in observable block also highlights correctly now. 

- 0.4.0
Fixed some incorrect snippets

- 0.4.1
Adding documentation and small syntax highlighting issue where a comment after begin/end block would break highlighting. 

- 0.4.2
More highlighting fixes where "_" should be allowed in line labels and parameter names. ")" would break comment highlighting in molecule type block.

- 0.4.3
Added highlighing for population maps block

- 0.4.4
Added highlighing for energy patterns block

- 0.4.5
Fixed a small highlighting issue, snippets for population maps and energy patterns.

- 0.4.6
Small snippet bugfix

- 0.4.7
Action argument highlighting now expects curly braces and breaks if they are missing

- 0.4.8
Action argument highlighting that doesn't require curly braces correctly identified

- 0.4.9
Improved plotting stability by removing dependencies to older packages. 

- 0.5.0
Interactive plotting stability improvement by adding show command. 

- 0.5.1
Further plotting stability improvements by delaying the show call

- 0.5.2 
Much improved plotting stability by using plotly promises

- 0.5.3
Net file reaction block highlighing fixes

- 0.5.4
Making sure plot stays consistent when tabs are switched while sending plotting message after a timeout to ensure plotting happens. 

- 0.5.5
Changed plotting so that webview sends a message to VS Code when ready and VS Code sends the data into the webview once the ready call is made. This should vastly improve interactive plotting stability.

- 0.5.6
LICENSE added, minor plotly plot changes and minor snippet changes.

- 0.5.7
Minor changes to how bionetgen runs, by default it saves a log file under the run now. 

- 0.5.8
Adding configuration options to BNGL plotting

- 0.5.9
Additional plotting settings for configurations. Plot line series selection now preserves color ordering. 

- 0.6.0
Updating bionetgen commands with the -req keyword to keep the user informed on their bionetgen version. 

- 0.6.1
Added a visualize button that runs `bionetgen visualize -i file.bngl -t all` on the file. BioNetGen requirement bumped up to 0.4.9. Updated documentation to showcase how to use yEd in conjunction with the extension for graph visualization. 

- 0.6.2
Added two new configuration options 1) turn on and off automated gdat opening (bngl.general.auto_open) 2) selection of a folder for model run results, to be used as a fallback in case workspace is not set (bngl.general.result_folder)

- 0.6.3
Added two new commands, bng.setup and bng.upgrade. Upon activation of the extension, the extension will use the current default python and run `python -m pip show bionetgen` to ensure PyBioNetGen is installed. If it's not installed, the extension will attempt to run `python -m pip install bionetgen --upgrade` to install PyBioNetGen. bng.upgrade can be used to force run `python -m pip install --upgrade` manually. 

- 0.6.4
Added setting option to stop bng.setup checking upon activation. Piping all setup stdout/stderr an output channel named `BNGL` to make debugging easier.

- 0.6.5
The extension now checks for the existence of perl upon activation and warns the user if Perl cannot be called. 

- 0.6.6
The extension can now visualize `.graphml` files generated by BioNetGen using [Cytoscape.js](https://js.cytoscape.org/). There is a simple button that runs a basic layouting algorithm as well as a save button that saves the graph as a png.

- 0.6.7
Run and plotting operations moved out of terminal calls and now spawns processes to do the same thing. The output is moved to the BNGL output channel. 

- 0.6.8
Old terminal runner is now an extra option under extension settings. 

- 0.6.9
Plotting and graph visualizing now correctly respects the terminal runner option. Changed result placement behavior and all results will now be placed in the same folder as the bngl file that's open. 