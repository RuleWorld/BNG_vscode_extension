// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState();
    const network = document.getElementById('network');

    function dropdown_show() {
        document.getElementById("axis_dropdown").classList.toggle("show");
    }

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'plot':
                // message.data will contain the data
                // message.names will contain the names of time series
                let plot_data = [];
                let plot_options = { 
                    showlegend: false,
                    margin: { t:0 },
                    autosize: true,
                    xaxis: { title: message.names[0] },
                    yaxis: { title: 'concentration' },
                    legend: {
                        y: 0.1,
                        font: {
                          size: 12
                        }
                    },
                    updatemenus: [{
                        pad: {'r': 10, 't': 10},
                        showactive: true,
                        y: 0.9,
                        yanchor: 'top',
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
                        pad: {'r': 10, 't': 10},
                        showactive: true,
                        y: 0.8,
                        yanchor: 'top',
                        buttons: [{
                            method: 'relayout',
                            args: ['showlegend', false],
                            label: 'legend off'
                        },
                        {
                            method: 'relayout',
                            args: ['showlegend', true],
                            label: 'legend on'
                        }] 
                    },
                    {
                        pad: {'r': 10, 't': 10},
                        showactive: true,
                        y: 0.7,
                        yanchor: 'top',
                        buttons: [{
                            method: 'relayout',
                            args: ['xaxis.type', 'linear'],
                            label: 'linear x'
                        },
                            {
                            method: 'relayout',
                            args: ['xaxis.type', 'log'],
                            label: 'logx'
                        },
                        {
                            method: 'relayout',
                            args: ['yaxis.type', 'linear'],
                            label: 'linear y'
                        },
                        {
                            method: 'relayout',
                            args: ['yaxis.type', 'log'],
                            label: 'logy'
                        }] 
                    }],
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
                var plot = document.getElementById('plot');
                Plotly.newPlot(plot, plot_data, plot_options);
                plot.on('plotly_selected', function(eventData) {
                    var curve_set = new Set();
                    eventData.points.forEach(function(pt) {
                        curve_set.add(pt.curveNumber);
                    });
                    if (curve_set.size > 0) {
                        Plotly.restyle(plot, {
                            visible: false
                        });
                        Plotly.restyle(plot, {
                            visible: true
                        }, Array.from(curve_set));
                    } else if (curve_set.size == 0) {
                        Plotly.restyle(plot, {
                            visible: true
                        });
                    }
                });
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
                    name: 'cose',
                    fit: true,
                    animate: "end"
                };
                var cy = cytoscape({
                    container: network,
                    elements: message.data["elements"],
                    style: style,
                    layout: layout_opts
                });
                var layout = cy.layout( layout_opts );
                layout.run();
                $("#layout_button").click(function(){
                    layout.run();
                });
                cy.mount(network);
                break;
        }
    });
}());