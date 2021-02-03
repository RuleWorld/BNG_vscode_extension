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