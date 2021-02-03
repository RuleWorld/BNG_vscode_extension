// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState();
    const network = document.getElementById('network');

    // add functions to buttons
    // const ref_button = document.getElementById("refresh_button");
    // ref_button.onclick = function () {
            // const vscode = acquireVsCodeApi();
    //     // send refresh signal
    //     vscode.postMessage({
    //         command: 'alert',
    //         context: 'plot',
    //         text: "what"
    //     })
    // }
    // $("#refresh_button").click(function () {
    //     // send refresh signal
    //     vscode.postMessage({
    //         command: 'alert',
    //         context: 'plot',
    //         text: "what"
    //     })
    // });
    
    $("#refresh_button").click(function(){
        vscode.postMessage({
            command: "refresh",
            context: "plot"
        })
    });
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'plot':
                // message.data will contain the data
                // message.names will contain the names of time series
                let plot_data = [];
                let plot_options = { 
                    margin: { t:0 },
                    autosize: true,
                    xaxis: { title: message.names[0] },
                    yaxis: { title: 'concentration' },
                    legend: {
                        y: 0.1,
                        font: {
                          size: 12
                        }
                    }
                };
                for (let i=0;i<message.names.length;i++) {
                    if (i == 0) {
                        continue;
                    }
                    let this_data = {
                        x: message.data[0],
                        y: message.data[i],
                        name: message.names[i]
                    }
                    plot_data.push(this_data);
                }
                Plotly.newPlot("plot", plot_data, plot_options);
                break;
            case 'network':
                // render a network in plot
                let elements = {
                    nodes: [
                        { data: { id: 'a' }, position: { x: 100, y: 100 } },
                        { data: { id: 'b' } },
                        { data: { id: 'c' } },
                        { data: { id: 'd' } },
                        { data: { id: 'e' } },
                        { data: { id: 'f' } },
                        { data: { id: 'g' } }
                    ],
                    edges: [
                        { data: { id: 'ab', source: 'a', target: 'b' }},
                        { data: { id: 'eb', source: 'e', target: 'b' }},
                        { data: { id: 'ag', source: 'a', target: 'g' }},
                        { data: { id: 'fd', source: 'f', target: 'd' }},
                        { data: { id: 'fe', source: 'f', target: 'e' }},
                        { data: { id: 'bc', source: 'b', target: 'c' }},
                        { data: { id: 'ce', source: 'c', target: 'e' }}
                    ]
                };
                let style = [ // the stylesheet for the graph
                    { selector: 'node',
                        style: {
                        'background-color': '#999',
                        'label': 'data(id)',
                        'color': '#999',
                        'min-zoomed-font-size': '12'
                        }
                    },
                    { selector: 'edge',
                        style: {
                        'width': 3,
                        'line-color': '#ccc',
                        'target-arrow-color': '#ccc',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                        }
                    }
                ];  
                let layout_opts = {
                    name: 'breadthfirst',
                    fit: true,
                    animate: true
                };
                var cy = cytoscape({
                    container: network,
                    elements: message.data["elements"],
                    style: style,
                    layout: layout_opts
                });
                var layout = cy.layout( layout_opts );
                layout.run();
                cy.mount(network);
                break;
        }
    });
}());