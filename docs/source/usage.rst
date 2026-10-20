.. _usage:

#####
Usage
#####

BioNetGen modelling language is a language for writing rule-based models of biochemical systems,
including signal transduction, metabolic, and genetic regulatory networks, see
`here <http://bionetgen.org/>`_ for more information.

This VS Code extension is designed to help write BNGL models by adding syntax highlighting and
snippet support, do rapid tests of the model as you write with the help of a built-in run button
and basic plotting features.

Syntax highlighting and snippets
================================

Once the extension is installed you can create a new file with ``.bngl``. This file extension
will be automatically detected and you should see the BioNetGen icon in the editor title bar
if the extension is running correctly. This extension will also do syntax highlighting on
files with ``.net`` extension.

Next you can start writing your model. This VS Code extension supports a large list of snippets
that can help you write your model. For a full list, see
`here <https://github.com/RuleWorld/BNG_vscode_extension/blob/main/snippets/bngl-snippets.json>`_.

Using the correct theme
=======================

If you notice that there is no highlighting on certain parts of the model or if the colors don't
match, make sure you have one of the bundled BNGL themes activated (see
`here <https://code.visualstudio.com/docs/getstarted/themes#_selecting-the-color-theme>`_ to learn
how to select color themes). Available themes: ``dark-bngl``, ``light-bngl``, ``hc-dark-bngl``,
``hc-light-bngl``.

Running a model
===============

Important note: for the extension to know where to write the results, you MUST open a folder
with VS Code. The extension will use the folder selected as the place to put the results.

Click the BioNetGen icon in the editor title bar and select "Run Simulation" from the dropdown
menu (or use the shortcut ``CTRL/CMD+SHIFT+F1``). The extension will create a new folder with the
same name as the model, copy the model there, and run it using the
`PyBioNetGen library <https://pypi.org/project/bionetgen/>`_. Once the run completes, if the run
created a ``.gdat`` file, it should open automatically.

Plotting results
================

Once you have some ``gdat/cdat/scan`` files to look at, open one and click the BioNetGen icon
to open the interactive plot viewer. The sidebar provides controls for selecting which variables
to display, toggling axis scales, changing line styles, and exporting images.

Visualization
=============

Click the BioNetGen icon and select ``Contact Map`` or ``Regulatory Graph`` to generate only that
GraphML output, or ``All Graphs`` to generate the full set of visualizations (contact maps, rule
visualizations, regulatory graphs). These files are designed to be used with
`yEd <https://www.yworks.com/products/yed>`_.
In the built-in viewer, contact maps also support direct layout selection, layout locking,
scale-to-fit, save actions for PNG and GraphML-with-current-layout, and show/hide toggles for
components and internal states.
