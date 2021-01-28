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
                plot.textContent = `${message.names[0]} = ${message.data[0]}`
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