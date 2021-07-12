// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState();
    const network = document.getElementById('network');

    const page_title = document.getElementById('page_title').innerText;
    const page_folder = document.getElementById('folder').innerText;

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'plot':
                // message.data will contain the data
                // message.names will contain the names of time series
                let plot_data = [];
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
                let legend_status = false;
                if ( plot_data.length < 21) {
                    legend_status = true
                }
                let plot_options = { 
                    showlegend: legend_status,
                    hovermode: 'closest',
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
                        yanchor: 'top',
                        xanchor: "left",
                        y: 1.18,
                        x: 0,
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
                        yanchor: 'top',
                        xanchor: "left",
                        y: 1.18,
                        x: 0.2,
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
                        yanchor: 'top',
                        xanchor: "left",
                        y: 1.18,
                        x: 0.37,
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
                let config = {
                    modeBarButtonsToAdd: [
                        {
                            name: 'png',
                            icon: Plotly.Icons.camera,
                            click: function (gd) {
                              let img = Plotly.toImage(gd, {
                                format:'png',
                                width: gd._fullLayout.width,
                                height: gd._fullLayout.height
                              }).then(
                                  function(url) {
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
                            name: 'svg',
                            icon: Plotly.Icons.camera,
                            click: function (gd) {
                                let img = Plotly.toImage(gd, {
                                    format:'svg',
                                    width: gd._fullLayout.width,
                                    height: gd._fullLayout.height
                                  }).then(
                                      function(url) {
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
                Plotly.newPlot(plot, plot_data, plot_options, config);
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
                // $(document).ready(function(){
                //     vscode.postMessage({
                //         command: 'refresh',
                //         context: 'view'
                //     })
                // });
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