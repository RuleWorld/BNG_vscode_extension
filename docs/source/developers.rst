.. _devs:

##############
For Developers
##############

Architecture
------------

The extension is written in TypeScript and bundled with esbuild. Key directories:

* ``src/extension.ts`` -- thin activation entry point
* ``src/server/`` -- Language Server (parser, diagnostics, completions, hover, go-to-definition)
* ``src/commands/`` -- command handlers (run, visualize, setup, menu)
* ``src/plotting/`` -- PlotPanel webview
* ``src/folding/`` -- code folding provider
* ``src/utils/`` -- getPythonPath, commandSpec, spawnAsync, processManagement
* ``src/test/`` -- unit and integration tests
* ``syntaxes/`` -- TextMate grammar (``bngl.tmLanguage.json``)
* ``snippets/`` -- snippet definitions
* ``themes/`` -- dark, light, and high-contrast themes

Setting up a development environment
--------------------------------------

1. Clone the repository::

       git clone https://github.com/RuleWorld/BNG_vscode_extension.git
       cd BNG_vscode_extension

2. Install dependencies::

       npm install

3. Start the build in watch mode::

       npm run watch

4. Press ``F5`` in VS Code to launch the Extension Development Host.

Available npm scripts
---------------------

.. list-table::
   :header-rows: 1

   * - Command
     - Description
   * - ``npm run build``
     - One-shot esbuild compilation
   * - ``npm run compile``
     - Type-check + esbuild
   * - ``npm run watch``
     - esbuild in watch mode (rebuilds on file changes)
   * - ``npm run package``
     - Production build (minified, no sourcemaps)
   * - ``npm run check-types``
     - TypeScript type checking only (no emit)
   * - ``npm test``
     - Rebuild and run the VS Code extension test harness
   * - ``npm run test:extension``
     - Alias for the VS Code extension test harness used by ``npm test``
   * - ``npm run test:grammar``
     - Run TextMate grammar scope tests
   * - ``npm run test:all``
     - Run the VS Code extension tests and the grammar tests

Testing
-------

The test suite uses ``@vscode/test-electron`` with Mocha. Tests are in ``src/test/suite/``.
Grammar tests use ``vscode-tmgrammar-test`` with fixture files in ``src/test/grammar/``.
The VS Code harness runs in an isolated temporary workspace with ``bngl.general.auto_install`` disabled so it does not try to install PyBioNetGen during test activation.

Run all tests::

    npm run test:all

Building a VSIX package
------------------------

::

    npx vsce package

This runs the ``vscode:prepublish`` script (type-check + production esbuild) and produces a
``.vsix`` file you can install locally or distribute.
