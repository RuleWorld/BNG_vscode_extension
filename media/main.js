// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState();
    const network = document.getElementById('network');

    const page_title = document.getElementById('page_title').innerText;
    const page_folder = document.getElementById('folder').innerText;

    const def_colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", 
                        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
    const clr_cnt = def_colors.length;

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'plot':
                // message.data will contain the data
                // message.names will contain the names of time series
                let colors = []
                let plot_data = [];
                for (let i = 0; i < message.names.length; i++) {
                    if (i == 0) {
                        continue;
                    }
                    if (i > message.max_series) {
                        break;
                    }
                    let this_data = {
                        x: message.data[0],
                        y: message.data[i],
                        name: message.names[i]
                    }
                    plot_data.push(this_data);
                    colors.push(def_colors[(i-1)%clr_cnt]);
                }
                let legend_status = message.legend;
                let legend_buttons = [{
                        method: 'relayout',
                        args: ['showlegend', true],
                        label: 'legend on'
                    },
                    {
                        method: 'relayout',
                        args: ['showlegend', false],
                        label: 'legend off'
                    }
                ]
                if (!legend_status) {
                    legend_buttons.reverse()
                }
                let updatemenus_list = [];
                if (message.menus) {
                    updatemenus_list = [{
                        pad: { 'r': 10, 't': 10 },
                        showactive: true,
                        yanchor: 'top',
                        xanchor: "left",
                        y: 1.18,
                        x: 0.1,
                        buttons: legend_buttons
                    },
                    {
                        pad: { 'r': 10, 't': 10 },
                        showactive: true,
                        yanchor: 'top',
                        xanchor: "left",
                        y: 1.18,
                        x: -0.1,
                        buttons: [{
                            method: 'restyle',
                            args: ['mode', 'lines'],
                            label: 'lines'
                        },
                        {
                            method: 'restyle',
                            args: ['mode', 'markers'],
                            label: 'markers'
                        },
                        {
                            method: 'restyle',
                            args: ['mode', 'lines+markers'],
                            label: 'lines+markers'
                        }]
                    },
                    {
                        pad: { 'r': 10, 't': 10 },
                        showactive: true,
                        yanchor: 'top',
                        xanchor: "left",
                        y: 1.18,
                        x: 0.265,
                        buttons: [{
                            method: 'relayout',
                            args: ['xaxis.type', 'linear'],
                            label: 'linear x'
                        },
                        {
                            method: 'relayout',
                            args: ['xaxis.type', 'log'],
                            label: 'logx'
                        }]
                    },
                    {
                        pad: { 'r': 10, 't': 10 },
                        showactive: true,
                        yanchor: 'top',
                        xanchor: "left",
                        y: 1.18,
                        x: 0.41,
                        buttons: [{
                            method: 'relayout',
                            args: ['yaxis.type', 'linear'],
                            label: 'linear y'
                        },
                        {
                            method: 'relayout',
                            args: ['yaxis.type', 'log'],
                            label: 'logy'
                        }]
                    }]
                }
                let plot_options = {
                    showlegend: legend_status,
                    hovermode: 'closest',
                    margin: { t: 0 },
                    autosize: true,
                    xaxis: { title: message.names[0] },
                    yaxis: { title: 'concentration' },
                    legend: {
                        y: 0.1,
                        font: {
                            size: 12
                        }
                    },
                    updatemenus: updatemenus_list,
                };
                let config = {
                    modeBarButtonsToAdd: [
                        {
                            name: 'save png',
                            icon: Plotly.Icons.camera,
                            click: function (gd) {
                                let img = Plotly.toImage(gd, {
                                    format: 'png',
                                    width: gd._fullLayout.width,
                                    height: gd._fullLayout.height
                                }).then(
                                    function (url) {
                                        vscode.postMessage({
                                            command: 'image',
                                            type: 'png',
                                            title: page_title,
                                            folder: page_folder,
                                            text: url
                                        })
                                    }
                                );
                            }
                        },
                        {
                            name: 'save svg',
                            icon: Plotly.Icons.camera,
                            click: function (gd) {
                                let img = Plotly.toImage(gd, {
                                    format: 'svg',
                                    width: gd._fullLayout.width,
                                    height: gd._fullLayout.height
                                }).then(
                                    function (url) {
                                        vscode.postMessage({
                                            command: 'image',
                                            type: 'svg',
                                            title: page_title,
                                            folder: page_folder,
                                            text: url
                                        })
                                    }
                                );
                            }
                        }
                    ],
                    modeBarButtonsToRemove: ['toImage']
                };
                var plot = document.getElementById('plot');
                Plotly.newPlot(plot, plot_data, plot_options, config)
                plot.on('plotly_selected', function (eventData) {
                    var curve_set = new Set();
                    eventData.points.forEach(function (pt) {
                        curve_set.add(pt.curveNumber);
                    });
                    if (curve_set.size > 0) {
                        Plotly.restyle(plot, {
                            visible: false
                        });
                        // gotta recolor 
                        let new_colors = []
                        for (let i = 0; i < curve_set.size; i++) {
                            new_colors.push(colors[curve_set[i]])
                        }
                        Plotly.restyle(plot, {
                            visible: true,
                            'line.color': new_colors,
                            'marker.color': new_colors
                        }, Array.from(curve_set));
                    } else if (curve_set.size == 0) {
                        Plotly.restyle(plot, {
                            visible: true,
                            'line.color': colors,
                            'marker.color': colors
                        });
                    }
                });
            case 'network':
                // parse GraphML & render with cytoscape.js

                // --- assumptions about structure of GraphML ---
                //
                // features of nodes:
                // - each node has XML-attribute "id"
                // - each node contains a <data> element, which contains the following elements:
                // -- <y:Fill> w/ XML-attribute "color"
                // -- <y:BorderStyle> w/ XML-attributes "width", "color"
                // -- <y:Shape> (not currently used)
                // -- <y:NodeLabel> w/ text content & XML-attributes "textColor", "fontStyle"
                // - when retrieving features of group nodes, note that they contain multiple
                //   instances of these elements (corresponding to each of the nested nodes
                //   in the group); assume that the elements describing the group node occur first
                //
                // hierarchy of nodes:
                // - group nodes are denoted by XML-attribute yfiles.foldertype="group"
                // - group nodes can contain regular nodes & graphs
                // - graphs can contain group nodes & regular nodes
                // - graphs are used in conjunction with group nodes;
                //   a graph is either at the top level or is the child of a group node
                //
                // features of edges:
                // - each edge has XML-attributes "id", "source", "target"
                // - each edge contains a <data> element, which contains the following elements:
                // -- <y:LineStyle> w/ XML-attributes "width", "color"
                // -- <y:Arrows> w/ XML-attribute "target"
                // -- <y:BendStyle> (not currently used)

                // get XML document corresponding to GraphML text
                const graphmlText = message.data;
                const xmlParser = new DOMParser();
                const xmlDoc = xmlParser.parseFromString(graphmlText, 'text/xml');
                
                // initialize collection of elements to be used for cytoscape rendering
                let cytoElements = {
                    nodes: [],
                    edges: []
                };

                // --- add nodes from the XML document to the cytoscape collection ---

                // function to add a node (w/ features) to the cytoscape collection
                // node: element (with tag "node") from XML document
                // parentId: id of parent of node, null if none (ie. node is at top level)
                function addNode (node, parentId) {
                    // --- get features of the node, use defaults if needed ---
                    // get background color, set default color if it isn't found
                    let backgroundColor = node.getElementsByTagName("y:Fill").item(0);
                    backgroundColor = (backgroundColor) ? backgroundColor.getAttribute("color") : null;
                    backgroundColor = (backgroundColor) ? backgroundColor : "#999999";
                    // get border
                    let border = node.getElementsByTagName("y:BorderStyle").item(0);
                    // make sure border is not null before trying to get its attributes
                    let borderWidth = (border) ? border.getAttribute("width") : null;
                    let borderColor = (border) ? border.getAttribute("color") : null;
                    // set default border width and/or color if these attributes aren't found
                    borderWidth = (borderWidth) ? borderWidth : "1";
                    borderColor = (borderColor) ? borderColor : "#000000";
                    // get label
                    let label = node.getElementsByTagName("y:NodeLabel").item(0);
                    // make sure label is not null before trying to get its content & attributes
                    let labelText = (label) ? label.textContent : "";
                    let labelColor = (label) ? label.getAttribute("textColor") : null;
                    let labelWeight = (label) ? label.getAttribute("fontStyle") : null;
                    // set default label color and/or weight if these attributes aren't found
                    labelColor = (labelColor) ? labelColor : "#000000";
                    labelWeight = (labelWeight && (labelWeight == "bold")) ? "bold" : "normal"
                    
                    // add the node to the collection
                    cytoElements["nodes"].push(
                        {data: {id: node.id,
                                parent: parentId,
                                backgroundColor: backgroundColor,
                                borderWidth: borderWidth,
                                borderColor: borderColor,
                                labelText: labelText,
                                labelColor: labelColor,
                                labelWeight: labelWeight}}
                    );
                }

                // TEMPORARY, for testing purposes:
                //
                // choose grouped or flat node hierarchy
                let mode = "grouped";
                // let mode = "flat";
                //
                // for grouped mode, choose method of obtaining hierarchy information
                let method = "recursive";
                // let method = "property";

                if (mode == "grouped" && method == "recursive") {
                    let parentStack = []; // empty at top level
                    let graphmlRoot = xmlDoc.getElementsByTagName("graphml").item(0);

                    // recursive function to add child nodes of root to the
                    // cytoscape collection, preserving grouping/hierarchy
                    // root: element from XML document
                    function addChildNodes (root) {
                        let children = root.children;
                        for (const element of children) {
                            if (element.tagName == "graph") {
                                addChildNodes(element);
                            }
                            else if (element.tagName == "node") {
                                let parentId = null;
                                // if parentStack is not empty, use the last parentId added
                                if (parentStack.length != 0) {
                                    parentId = parentStack[parentStack.length - 1];
                                }

                                // if element is a group node,
                                // add it to the cytoscape collection and also add its children
                                if (element.getAttribute("yfiles.foldertype") == "group") {
                                    addNode(element, parentId);

                                    parentStack.push(element.id); // this group node is now the last on stack
                                    addChildNodes(element);
                                    parentStack.pop(); // after adding all nodes in the group, remove it from stack
                                }

                                // if element is a regular node,
                                // simply add it to the cytoscape collection
                                else {
                                    addNode(element, parentId);
                                }
                            }
                        }
                    }

                    addChildNodes(graphmlRoot);
                }

                if (mode == "grouped" && method == "property") {
                    let graphmlNodes = xmlDoc.getElementsByTagName("node");
                    for (const node of graphmlNodes) {
                        let parent = node.parentElement.parentElement; // node is inside graph is inside group node
                        let parentId = parent.id;
                        // check if node is at top level
                        if (parent.tagName == "graphml") {
                            parentId = null;
                        }
                        addNode(node, parentId);
                    }
                }

                if (mode == "flat") {
                    let graphmlNodes = xmlDoc.getElementsByTagName("node");
                    for (const node of graphmlNodes) {
                        addNode(node, null);
                    }
                }

                // --- add edges from the XML document to the cytoscape collection ---

                // function to add an edge (w/ features) to the cytoscape collection
                // edge: element (with tag "edge") from XML document
                function addEdge (edge) {
                    // --- get features of the edge, use defaults if needed ---
                    let source = edge.getAttribute("source");
                    let target = edge.getAttribute("target");
                    // get line
                    let line = edge.getElementsByTagName("y:LineStyle").item(0);
                    // make sure line is not null before trying to get its attributes
                    let lineWidth = (line) ? line.getAttribute("width") : null;
                    let lineColor = (line) ? line.getAttribute("color") : null;
                    // set default line width and/or color if these attributes aren't found
                    lineWidth = (lineWidth) ? lineWidth : "1";
                    lineColor = (lineColor) ? lineColor : "#000000";
                    // get arrow, set default if it isn't found
                    let arrow = edge.getElementsByTagName("y:Arrows").item(0);
                    arrow = (arrow) ? arrow.getAttribute("target") : null;
                    // this will recognize only the "standard" arrow type as indicating a directed edge,
                    // and set "none" (indicating an undirected edge) otherwise; adjust this if needed
                    arrow = (arrow && (arrow == "standard")) ? "triangle" : "none";
                    
                    // add the edge to the collection
                    cytoElements["edges"].push(
                        {data: {id: edge.id,
                                source: source,
                                target: target,
                                lineWidth: lineWidth,
                                lineColor: lineColor,
                                arrow: arrow}}
                    );
                }

                let graphmlEdges = xmlDoc.getElementsByTagName("edge");
                for (const edge of graphmlEdges) {
                    addEdge(edge);
                }

                // --- set up graph ---

                let style = [ // the stylesheet for the graph
                    {
                        selector: 'node',
                        style: {
                            'background-color': 'data(backgroundColor)',
                            'border-width': 'data(borderWidth)',
                            'border-color': 'data(borderColor)',
                            'label': 'data(labelText)',
                            'color': 'data(labelColor)',
                            'font-weight': 'data(labelWeight)',
                            'text-valign': 'top',
                            'text-halign': 'center',
                            'min-zoomed-font-size': '12'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 'data(lineWidth)',
                            'line-color': 'data(lineColor)',
                            'target-arrow-color': 'data(lineColor)',
                            'target-arrow-shape': 'data(arrow)',
                            'curve-style': 'bezier'
                        }
                    }
                ];
                let layout_opts = {
                    name: 'breadthfirst',
                    fit: true,
                    animate: "end"
                };
                var cy = cytoscape({
                    container: network,
                    elements: cytoElements,
                    style: style,
                    layout: layout_opts
                });
                var layout = cy.layout(layout_opts);
                layout.run();
                $("#layout_button").click(function () {
                    layout.run();
                });
                cy.mount(network);
                break;
        }
    });
    
    vscode.postMessage({
        command: 'ready',
    })
}());