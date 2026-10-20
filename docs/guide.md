## Starter guide

BioNetGen modelling language is a language for writing rule-based models of biochemical systems, including signal transduction, metabolic, and genetic regulatory networks, see [here](http://bionetgen.org/) for more information. 

This VS Code extension is designed to help write BNGL models by adding syntax highlighting and snippet support, do rapid tests of the model as you write with the help of a built-in run button and basic plotting features.

### Syntax highlighting and snippets

Once the extension is installed you can create a new file with ```.bngl```. This file extension will be automatically detected and you should see the BioNetGen icon in the editor title bar if the extension is running correctly. This extension will also do syntax highlighing on files with ```.net``` extension. 

Next you can start writing your model. This VS Code extension supports a large list of snippets that can help you write your model. For a full list, see [here](https://github.com/RuleWorld/BNG_vscode_extension/blob/main/snippets/bngl-snippets.json), we will update this with a snippet guide in the future. 

### Using the correct theme

If you notice that there is no highlighting on certain parts of the model or if the colors don't match, please make sure you have one of the bundled BNGL themes activated (see [here](https://code.visualstudio.com/docs/getstarted/themes#_selecting-the-color-theme) to learn how to select color themes). Available themes: `dark-bngl`, `light-bngl`, `hc-dark-bngl`, `hc-light-bngl`.

### Running a model

Important note: for the extension to know where to write the results, you MUST open a folder with VS Code. The extension will use the folder selected as the place to put the results.

Once you finished writing the model, you can try running it. Click the BioNetGen icon in the editor title bar and select "Run Simulation" from the dropdown menu (or use the shortcut ```CTRL/CMD+SHIFT+F1```). The extension will create a new folder with the same name as the model, copy the model there, and run it using the [PyBioNetGen library](https://pypi.org/project/bionetgen/). Once the run completes, if the run created a ```.gdat``` file, it should open automatically.

### Plotting results

Once you have some ```gdat/cdat/scan``` files to look at, you can open one and click the BioNetGen icon to open the interactive plot viewer. The sidebar provides controls for selecting which variables to display, toggling axis scales, changing line styles, and exporting images. PNG export is scaled up so it comes out noticeably sharper, while SVG export remains available for vector output.

### Visualization

Click the BioNetGen icon and select **Contact Map** or **Regulatory Graph** to generate only that GraphML output, or **All Graphs** to generate the full set of visualizations (contact maps, rule visualizations, regulatory graphs). Open a generated `.graphml` file and choose **Open Plot / Viewer** to inspect it in the built-in GraphML viewer.

The GraphML viewer toolbar lets you:

- switch between multiple layout modes
- lock or unlock the current layout
- scale the graph to fit the viewport
- toggle between day and night viewer themes
- show or hide components and internal states in contact maps
- save the graph as PNG
- save a GraphML copy with the current node layout directly from the viewer

The generated GraphML files also remain compatible with [yEd](https://www.yworks.com/products/yed) if you prefer to continue working with them there.
