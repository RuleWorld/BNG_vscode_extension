// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState();

    const plot = document.getElementById('plot');

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
                    width: 800,
                    height: 400,
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
                Plotly.newPlot(plot, plot_data, plot_options);
                break;
            case 'network':
                vscode.postMessage({
                    command: 'alert',
                    text: `we got sent data, context: ${message.context}`
                });
                plot.textContent = `${message.data}`
                break;
        }
    });
}());