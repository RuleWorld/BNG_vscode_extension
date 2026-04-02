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

    let plot_initialized = false;
    let current_plot_data = [];
    let current_plot_names = [];
    let current_colors = [];

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'plot':
                current_plot_names = message.names;
                current_colors = [];
                current_plot_data = [];

                const varList = document.getElementById('var-list');
                varList.innerHTML = '';

                for (let i = 1; i < message.names.length; i++) {
                    let color = def_colors[(i - 1) % clr_cnt];
                    current_colors.push(color);

                    let is_visible = i <= message.max_series;

                    let this_data = {
                        x: message.data[0],
                        y: message.data[i],
                        name: message.names[i],
                        visible: is_visible,
                        line: { color: color }
                    };
                    current_plot_data.push(this_data);

                    // Add to sidebar
                    const item = document.createElement('div');
                    item.className = 'var-item';
                    item.innerHTML = `
                        <input type="checkbox" id="var-${i}" ${is_visible ? 'checked' : ''}>
                        <span style="color: ${color}; font-weight: bold;">—</span>
                        <label for="var-${i}">${message.names[i]}</label>
                    `;
                    item.onclick = (e) => {
                        if (e.target.tagName !== 'INPUT') {
                            const cb = item.querySelector('input');
                            cb.checked = !cb.checked;
                            updateVisibility(i - 1, cb.checked);
                        }
                    };
                    item.querySelector('input').onchange = (e) => {
                        updateVisibility(i - 1, e.target.checked);
                    };
                    varList.appendChild(item);
                }

                function updateVisibility(index, visible) {
                    current_plot_data[index].visible = visible;
                    Plotly.restyle('plot', { visible: visible }, [index]);
                }

                // Sidebar Filter
                document.getElementById('var-filter').oninput = (e) => {
                    const filter = e.target.value.toLowerCase();
                    document.querySelectorAll('.var-item').forEach(item => {
                        const label = item.querySelector('label').innerText.toLowerCase();
                        item.style.display = label.includes(filter) ? 'flex' : 'none';
                    });
                };

                // Show All / None
                document.getElementById('show-all').onclick = () => {
                    const updates = current_plot_data.map(() => true);
                    const indices = current_plot_data.map((_, i) => i);
                    Plotly.restyle('plot', { visible: true }, indices);
                    document.querySelectorAll('.var-item input').forEach(cb => cb.checked = true);
                };
                document.getElementById('show-none').onclick = () => {
                    const indices = current_plot_data.map((_, i) => i);
                    Plotly.restyle('plot', { visible: false }, indices);
                    document.querySelectorAll('.var-item input').forEach(cb => cb.checked = false);
                };

                // Export buttons
                document.getElementById('export-png').onclick = () => exportImage('png');
                document.getElementById('export-svg').onclick = () => exportImage('svg');

                function exportImage(format) {
                    const gd = document.getElementById('plot');
                    Plotly.toImage(gd, {
                        format: format,
                        width: gd._fullLayout.width,
                        height: gd._fullLayout.height
                    }).then(url => {
                        vscode.postMessage({
                            command: 'image',
                            type: format,
                            title: page_title,
                            folder: page_folder,
                            text: url
                        });
                    });
                }

                let plot_options = {
                    showlegend: message.legend,
                    hovermode: 'closest',
                    margin: { t: 30, r: 30, b: 50, l: 60 },
                    autosize: true,
                    xaxis: { title: message.names[0] },
                    yaxis: { title: 'Concentration' },
                    legend: {
                        orientation: 'h',
                        y: -0.2
                    }
                };

                let config = {
                    responsive: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ['toImage']
                };

                Plotly.newPlot('plot', current_plot_data, plot_options, config);
                plot_initialized = true;
                break;
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
                // -- <y:Geometry> w/ XML-attributes "x", "y"
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
                    // --- get features of the node, check that they exist, use defaults if not found ---
                    // background color
                    let backgroundColor = node.getElementsByTagName("y:Fill").item(0);
                    backgroundColor = (backgroundColor) ? backgroundColor.getAttribute("color") : null;
                    backgroundColor = (backgroundColor) ? backgroundColor : "#999999";
                    // border
                    let border = node.getElementsByTagName("y:BorderStyle").item(0);
                    let borderWidth = (border) ? border.getAttribute("width") : null;
                    let borderColor = (border) ? border.getAttribute("color") : null;
                    borderWidth = (borderWidth) ? borderWidth : "1";
                    borderColor = (borderColor) ? borderColor : "#000000";
                    // label
                    let label = node.getElementsByTagName("y:NodeLabel").item(0);
                    let labelText = (label) ? label.textContent : "";
                    let labelColor = (label) ? label.getAttribute("textColor") : null;
                    let labelWeight = (label) ? label.getAttribute("fontStyle") : null;
                    labelColor = (labelColor) ? labelColor : "#000000";
                    labelWeight = (labelWeight && (labelWeight == "bold")) ? "bold" : "normal";
                    // layout
                    let layout = node.getElementsByTagName("y:Geometry").item(0);
                    // - specifiedPosition object stores node position specified by graphml (undefined if not specified)
                    let specifiedPosition = undefined;
                    if (layout) {
                        specifiedPosition = {
                            x: parseInt(layout.getAttribute("x")),
                            y: parseInt(layout.getAttribute("y"))
                        };
                    }
                    // - graph will be rendered with preset positions upon initialization
                    // - if node position is specified by graphml, use that, otherwise default to (0,0)
                    // - note: after initialization, a layout will be applied to nodes which do not have specified positions
                    // - position object stores current model position of node;
                    //   this is used for rendering and is updated by cytoscape to reflect current layout
                    let position = {
                        x: (specifiedPosition) ? specifiedPosition["x"] : 0,
                        y: (specifiedPosition) ? specifiedPosition["y"] : 0
                    };

                    // add the node to the collection
                    cytoElements["nodes"].push(
                        {data: {id: node.id,
                                parent: parentId,
                                backgroundColor: backgroundColor,
                                borderWidth: borderWidth,
                                borderColor: borderColor,
                                labelText: labelText,
                                labelColor: labelColor,
                                labelWeight: labelWeight,
                                specifiedPosition: specifiedPosition},
                        position: position}
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
                    // --- get features of the edge, check that they exist, use defaults if not found ---
                    let source = edge.getAttribute("source");
                    let target = edge.getAttribute("target");
                    // line
                    let line = edge.getElementsByTagName("y:LineStyle").item(0);
                    let lineWidth = (line) ? line.getAttribute("width") : null;
                    let lineColor = (line) ? line.getAttribute("color") : null;
                    lineWidth = (lineWidth) ? lineWidth : "1";
                    lineColor = (lineColor) ? lineColor : "#000000";
                    // arrow
                    // - this will recognize only the "standard" arrow type as indicating a directed edge,
                    //   and set "none" (indicating an undirected edge) otherwise; adjust this if needed
                    let arrow = edge.getElementsByTagName("y:Arrows").item(0);
                    arrow = (arrow) ? arrow.getAttribute("target") : null;
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

                // stylesheet
                let style = [
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

                // layout specifications
                let preset_layout_opts = {
                    name: 'preset',
                    fit: true
                };
                let basic_layout_opts = {
                    name: 'breadthfirst',
                    fit: true
                }

                // initialize graph
                var cy = cytoscape({
                    container: network,
                    elements: cytoElements,
                    style: style,
                    layout: preset_layout_opts
                });

                // get collection of elements (nodes for now) that do not have specified positions
                let eles_to_layout = cy.nodes().filter(
                    function(ele) {
                        return (typeof ele.data('specifiedPosition') === 'undefined');
                    }
                );

                // apply basic layout to this collection
                var eles_basic_layout = eles_to_layout.layout(basic_layout_opts);
                eles_basic_layout.run();

                // create reference to basic layout associated with entire graph
                var graph_basic_layout = cy.layout(basic_layout_opts);

                // todo: why do the results of rendering eles_basic_layout & graph_basic_layout not match?
                // - is this because we haven't included edges in eles?

                // todo: consider testing on graph with some node positions specified & some not
                
                // --- buttons ---

                // button: redo layout
                $("#layout_button").click(function () {
                    // apply basic layout to entire graph
                    graph_basic_layout.run();
                });

                // button: save as png
                $("#png_button").click(function () {
                    // cytoscape will export current view of graph
                    let uri = cy.png({
                        output: 'base64uri',
                        bg: '#FFFFFF', // should bg be white or transparent?
                        full: false, // false = current view, true = entire graph
                        scale: 10 // what scale to use?
                    });
                    // extension will decode output and save the file
                    vscode.postMessage({
                        command: 'image',
                        type: 'png',
                        title: page_title,
                        folder: page_folder,
                        text: uri
                    });
                });

                break;
        }
    });
    
    vscode.postMessage({
        command: 'ready',
    });
}());