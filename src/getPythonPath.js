const vscode = require('vscode');

// get path to the python interpreter to be used for installing bionetgen
function getPythonPath() {
    // let user select a python?


    // PYTHON EXTENSION

    // references:
    // https://code.visualstudio.com/docs/python/environments#_work-with-python-interpreters
    // https://code.visualstudio.com/docs/python/settings-reference
    // https://github.com/microsoft/vscode-python/wiki/AB-Experiments
    // https://github.com/microsoft/vscode-python/issues/12596
    // https://code.visualstudio.com/api/references/vscode-api#extensions

    // if we use the python extension
    // (in which case it should probably be packaged with this extension):
    // the python extension looks for and uses the first python
    // interpreter it finds in the system path by default,
    // or a user can use the Select Interpreter command to specify

    // then, how to programatically get the path of the active interpreter?
    // not immediately clear how to do this through vscode/settings.json (?)
    // in addition, the setting python.pythonPath is deprecated
    // and the setting python.defaultInterpreterPath
    // is not updated if user selects a different interpreter
    
    // path to active interpreter is supposedly kept in some internal storage
    // path can maybe be accessed through extension API? not sure how

    const pythonPath = vscode.workspace.getConfiguration("python").get("pythonPath");
    const defaultInterpreterPath = vscode.workspace.getConfiguration("python").get("defaultInterpreterPath");

    if (typeof defaultInterpreterPath !== 'undefined' && defaultInterpreterPath) {
        return defaultInterpreterPath;
    }
    else if (typeof pythonPath !== 'undefined' && pythonPath) {
        return pythonPath;
    }

    // ALTERNATIVE METHODS

    // can use something like <where.exe python> or <which python> instead?
}

module.exports = {
    getPythonPath
}