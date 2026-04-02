"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/utils/spawnAsync.ts
var cp = __toESM(require("child_process"));
async function spawnAsync(command, args, channel, processManager) {
  return new Promise((resolve, reject) => {
    const newProcess = cp.spawn(command, args);
    const pid = newProcess.pid;
    if (processManager && pid) {
      processManager.add(pid, command);
    }
    newProcess.on("error", (err) => {
      if (channel) {
        channel.appendLine(err.message);
      }
    });
    newProcess.stdout.on("data", (data) => {
      if (channel) {
        channel.append(data.toString());
      }
    });
    newProcess.stderr.on("data", (data) => {
      if (channel) {
        channel.append(data.toString());
      }
    });
    newProcess.on("close", (code) => {
      if (channel) {
        channel.appendLine(`process exited with code ${code}`);
      }
      if (processManager && pid) {
        processManager.delete(pid);
      }
      resolve(code);
    });
  });
}

// src/utils/getPythonPath.ts
var vscode = __toESM(require("vscode"));
async function getPythonPath(channel) {
  const defaultPath = "python";
  const pythonExt = vscode.extensions.getExtension("ms-python.python");
  if (typeof pythonExt === "undefined") {
    if (channel) {
      channel.appendLine("Python extension undefined.");
    }
    return defaultPath;
  }
  const flagValue = pythonExt.packageJSON.featureFlags.usingNewInterpreterStorage;
  if (flagValue) {
    if (!pythonExt.isActive) {
      try {
        await pythonExt.activate();
      } catch (e) {
        if (channel) {
          channel.appendLine("Python extension could not be activated.");
          channel.appendLine(e);
        }
        return defaultPath;
      }
    }
    let doc = vscode.window.activeTextEditor;
    let resource = void 0;
    if (doc) {
      resource = doc.document.uri;
    }
    let executionDetails;
    if (resource) {
      executionDetails = pythonExt.exports.settings.getExecutionDetails(resource);
    } else {
      executionDetails = pythonExt.exports.settings.getExecutionDetails();
    }
    const execCommand = executionDetails?.["execCommand"];
    if (execCommand && execCommand.length > 0) {
      return execCommand.join(" ");
    } else {
      if (channel) {
        channel.appendLine("pythonPath undefined, attempting to retrieve defaultInterpreterPath.");
      }
      const defaultInterpreterPath = vscode.workspace.getConfiguration("python").get("defaultInterpreterPath");
      if (defaultInterpreterPath) {
        return defaultInterpreterPath;
      } else {
        if (channel) {
          channel.appendLine("defaultInterpreterPath undefined.");
        }
        return defaultPath;
      }
    }
  } else {
    const pythonPath = vscode.workspace.getConfiguration("python").get("pythonPath");
    if (pythonPath) {
      return pythonPath;
    } else {
      if (channel) {
        channel.appendLine("pythonPath undefined.");
      }
      return defaultPath;
    }
  }
}

// src/utils/processManagement.ts
var vscode2 = __toESM(require("vscode"));
var cp2 = __toESM(require("child_process"));
var refreshInterval = 500;
var ProcessManagerProvider = class {
  constructor(processManager) {
    // for refresh
    this._onDidChangeTreeData = new vscode2.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._processManager = processManager;
    this.refresh();
  }
  // return trackedProcessObject[] containing information about open processes at specified level of custom process tree
  getChildren(trackedProcessObject) {
    if (trackedProcessObject) {
      return trackedProcessObject.children || [];
    } else {
      return this._processManager.toplevelProcesses;
    }
  }
  // return TreeItem (to be displayed in VSCode UI) containing information about given process
  getTreeItem(trackedProcessObject) {
    const pid = trackedProcessObject.pid;
    const name = trackedProcessObject.name.split(/[\\\/]/).pop()?.replace(".exe", "") || "unknown";
    let label = `${pid.toString()}: ${name}`;
    return new vscode2.TreeItem(label, vscode2.TreeItemCollapsibleState.Expanded);
  }
  refresh() {
    setTimeout(async () => {
      await this._processManager.refresh();
      this._onDidChangeTreeData.fire();
      this.refresh();
    }, refreshInterval);
  }
};
var ProcessManager = class {
  constructor() {
    this._openProcessesTracked = /* @__PURE__ */ new Map();
    this._openProcessesUntracked = /* @__PURE__ */ new Map();
  }
  // provides roots of custom process trees to be displayed in tree view
  get toplevelProcesses() {
    return Array.from(this._openProcessesTracked.values());
  }
  killAllProcesses() {
    for (const trackedProcessObject of this._openProcessesTracked.values()) {
      this.killProcess(trackedProcessObject);
    }
  }
  // kill process selected from tree view
  killProcess(trackedProcessObject) {
    if (trackedProcessObject) {
      const untrackedProcessObject = this._openProcessesUntracked.get(trackedProcessObject.pid);
      if (untrackedProcessObject) {
        this._treeKill(untrackedProcessObject);
      }
    }
  }
  // kill all open sub-processes of the given process, then kill the given process
  _treeKill(untrackedProcessObject) {
    for (const child of untrackedProcessObject.children) {
      this._treeKill(child);
    }
    try {
      process.kill(untrackedProcessObject.pid);
    } catch (e) {
    }
  }
  // called by spawnAsync when a new process is initiated
  add(pid, command) {
    this._openProcessesTracked.set(pid, {
      pid,
      name: command
    });
  }
  // called by spawnAsync when a tracked process terminates
  delete(pid) {
    this._openProcessesTracked.delete(pid);
  }
  async refresh() {
    await this._buildFullProcessTree();
    for (const trackedProcessObject of this._openProcessesTracked.values()) {
      this._reconstruct(trackedProcessObject);
    }
  }
  // use information from external process utility to build representation of full process tree
  async _buildFullProcessTree() {
    let processList = await this._getProcessList();
    this._openProcessesUntracked.clear();
    for (const untrackedProcessObject of processList) {
      untrackedProcessObject.children = [];
      this._openProcessesUntracked.set(untrackedProcessObject.pid, untrackedProcessObject);
    }
    for (const untrackedProcessObject of this._openProcessesUntracked.values()) {
      let parent = this._openProcessesUntracked.get(untrackedProcessObject.ppid);
      if (parent) {
        parent.children.push(untrackedProcessObject);
      }
    }
  }
  // reconstruct custom process tree rooted at given process by filtering full process tree
  _reconstruct(trackedProcessObject) {
    const untrackedProcessObject = this._openProcessesUntracked.get(trackedProcessObject.pid);
    if (untrackedProcessObject) {
      let filteredChildren = this._getFilteredChildren(untrackedProcessObject);
      trackedProcessObject.children = [];
      for (const untrackedChild of filteredChildren) {
        const trackedChild = {
          pid: untrackedChild.pid,
          name: untrackedChild.name
        };
        trackedProcessObject.children.push(trackedChild);
      }
      for (const trackedChild of trackedProcessObject.children) {
        this._reconstruct(trackedChild);
      }
    }
  }
  // apply custom filter to full process tree rooted at given process and return top layer of children satisfying this filter
  _getFilteredChildren(untrackedProcessObject) {
    let filteredChildren = [];
    const allChildren = untrackedProcessObject.children;
    for (const child of allChildren) {
      if (this._filter(child)) {
        filteredChildren.push(child);
      } else {
        filteredChildren = filteredChildren.concat(this._getFilteredChildren(child));
      }
    }
    return filteredChildren;
  }
  // specify filter which determines whether a process from full process tree will be included in custom process tree
  _filter(untrackedProcessObject) {
    const nameMatch = /perl|NFsim|run_network/;
    return nameMatch.test(untrackedProcessObject.name);
  }
  // invoke external process utility to get list of open processes, return untrackedProcessObject[]
  async _getProcessList() {
    return new Promise((resolve) => {
      let processList = [];
      let util;
      if (process.platform === "win32") {
        util = cp2.spawn("Get-WmiObject", ["Win32_Process", "|", "Select-Object", "ProcessID, ParentProcessId, Name"], { "shell": "powershell.exe" });
      } else {
        util = cp2.spawn("ps", ["ax", "-o", "pid,ppid,command"]);
      }
      util.on("error", () => {
        resolve([]);
      });
      util.stdout?.setEncoding("utf8");
      util.stdout?.on("data", (data) => {
        if (/[0-9]/.test(data)) {
          let lines = data.trim().split(/\n/);
          lines = lines.filter((line) => /[0-9]/.test(line));
          for (const line of lines) {
            const processInfo = line.trim().split(/\s+/);
            processList.push({
              pid: parseInt(processInfo[0]),
              ppid: parseInt(processInfo[1]),
              name: processInfo[2],
              children: []
            });
          }
        }
      });
      util.on("close", () => {
        resolve(processList);
      });
    });
  }
};

// src/extension.ts
function activate(context) {
  const processManager = new ProcessManager();
  const bngl_channel = vscode3.window.createOutputChannel("BNGL");
  const config = vscode3.workspace.getConfiguration("bngl");
  if (config.get("general.auto_install")) {
    bngl_channel.appendLine("Running BNG auto-install ...");
    vscode3.commands.executeCommand("bng.setup");
  }
  const PYBNG_VERSION = "0.5.0";
  async function runCommandHandler() {
    const editor = vscode3.window.activeTextEditor;
    if (!editor) return;
    let fname = path.basename(editor.document.fileName);
    const config2 = vscode3.workspace.getConfiguration("bngl");
    const def_folder = config2.get("general.result_folder");
    let curr_workspace_uri;
    if (def_folder) {
      curr_workspace_uri = vscode3.Uri.file(def_folder);
    } else {
      curr_workspace_uri = vscode3.Uri.file(path.dirname(editor.document.uri.fsPath));
    }
    let fname_noext = fname.replace(".bngl", "");
    const fold_name = get_time_stamped_folder_name();
    let new_fold_uri = vscode3.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
    let copy_path = vscode3.Uri.joinPath(new_fold_uri, fname);
    let curr_doc_uri = editor.document.uri;
    await vscode3.workspace.fs.createDirectory(new_fold_uri);
    await vscode3.workspace.fs.copy(curr_doc_uri, copy_path);
    let term_cmd = `bionetgen -req "${PYBNG_VERSION}" run -i "${copy_path.fsPath}" -o "${new_fold_uri.fsPath}" -l "${new_fold_uri.fsPath}"`;
    vscode3.window.showInformationMessage(`Started running ${fname} in folder ${fname_noext}/${fold_name}`);
    if (config2.get("general.enable_terminal_runner")) {
      let term = vscode3.window.terminals.find((i) => i.name === "bngl_term");
      if (!term) {
        term = vscode3.window.createTerminal("bngl_term");
      }
      term.show();
      term.sendText(term_cmd);
      if (config2.get("general.auto_open")) {
        let timeout_mili = 12e4;
        checkGdat(new_fold_uri.fsPath, timeout_mili).then(() => {
          openGdat(new_fold_uri, fname_noext, context);
        }).catch(() => {
        });
      }
    } else {
      bngl_channel.appendLine(term_cmd);
      const process2 = spawnAsync("bionetgen", ["-req", PYBNG_VERSION, "run", "-i", copy_path.fsPath, "-o", new_fold_uri.fsPath, "-l", new_fold_uri.fsPath], bngl_channel, processManager);
      process2.then((exitCode) => {
        if (exitCode) {
          vscode3.window.showInformationMessage("Something went wrong, see BNGL output channel for details.");
          bngl_channel.show();
        } else {
          vscode3.window.showInformationMessage("Finished running successfully.");
          if (config2.get("general.auto_open")) {
            try {
              openGdat(new_fold_uri, fname_noext, context);
            } catch (err) {
              bngl_channel.appendLine(err);
            }
          }
        }
      }).catch(() => {
      });
    }
  }
  async function vizCommandHandler() {
    const editor = vscode3.window.activeTextEditor;
    if (!editor) return;
    let fname = path.basename(editor.document.fileName);
    const config2 = vscode3.workspace.getConfiguration("bngl");
    const def_folder = config2.get("general.result_folder");
    let curr_workspace_uri;
    if (def_folder) {
      curr_workspace_uri = vscode3.Uri.file(def_folder);
    } else {
      curr_workspace_uri = vscode3.Uri.file(path.dirname(editor.document.uri.fsPath));
    }
    let fname_noext = fname.replace(".bngl", "");
    const fold_name = get_time_stamped_folder_name();
    let new_fold_uri = vscode3.Uri.joinPath(curr_workspace_uri, fname_noext, fold_name);
    let copy_path = vscode3.Uri.joinPath(new_fold_uri, fname);
    let curr_doc_uri = editor.document.uri;
    await vscode3.workspace.fs.createDirectory(new_fold_uri);
    await vscode3.workspace.fs.copy(curr_doc_uri, copy_path);
    let term_cmd = `bionetgen -req "${PYBNG_VERSION}" visualize -i "${copy_path.fsPath}" -o "${new_fold_uri.fsPath}" -t "all"`;
    vscode3.window.showInformationMessage(`Started visualizing ${fname} in folder ${fname_noext}/${fold_name}`);
    if (config2.get("general.enable_terminal_runner")) {
      let term = vscode3.window.terminals.find((i) => i.name === "bngl_term");
      if (!term) {
        term = vscode3.window.createTerminal("bngl_term");
      }
      term.show();
      term.sendText(term_cmd);
    } else {
      bngl_channel.appendLine(term_cmd);
      const exitCode = await spawnAsync("bionetgen", ["-req", PYBNG_VERSION, "visualize", "-i", copy_path.fsPath, "-o", new_fold_uri.fsPath, "-t", "all"], bngl_channel, processManager);
      if (exitCode) {
        vscode3.window.showInformationMessage("Something went wrong, see BNGL output channel for details.");
        bngl_channel.show();
      } else {
        vscode3.window.showInformationMessage("Finished visualizing successfully.");
      }
    }
  }
  async function plotDatCommandHandler() {
    const editor = vscode3.window.activeTextEditor;
    if (!editor) return;
    const config2 = vscode3.workspace.getConfiguration("bngl");
    let fpath = editor.document.fileName;
    let fname = path.basename(fpath);
    let split = fname.split(".");
    let ext = split.pop();
    let fname_noext = split.join(".");
    let outpath = fpath.replace(fname, `${fname_noext}_${ext}.png`);
    vscode3.window.showInformationMessage(`Started plotting ${fpath} to ${outpath}`);
    if (config2.get("general.enable_terminal_runner")) {
      let term = vscode3.window.terminals.find((i) => i.name === "bngl_term");
      if (!term) {
        term = vscode3.window.createTerminal("bngl_term");
      }
      term.show();
      let term_cmd;
      if (ext === "gdat" || ext === "scan") {
        term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}" --legend`;
      } else {
        term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}"`;
      }
      term.sendText(term_cmd);
      let outUri = vscode3.Uri.file(outpath);
      let timeout_mili = 1e4;
      checkImage(outpath, timeout_mili).then(() => {
        vscode3.window.showInformationMessage(`Done plotting ${fpath} to ${outpath}`);
        vscode3.commands.executeCommand("vscode.open", outUri);
      }).catch(() => {
        vscode3.window.showInformationMessage(`Plotting didn't finish within ${timeout_mili} miliseconds.`);
      });
    } else {
      let process2;
      let term_cmd;
      if (ext === "gdat" || ext === "scan") {
        term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}" --legend`;
        process2 = spawnAsync("bionetgen", ["-d", "-req", PYBNG_VERSION, "plot", "-i", fpath, "-o", outpath, "--legend"], bngl_channel, processManager);
      } else {
        term_cmd = `bionetgen -d -req "${PYBNG_VERSION}" plot -i "${fpath}" -o "${outpath}"`;
        process2 = spawnAsync("bionetgen", ["-d", "-req", PYBNG_VERSION, "plot", "-i", fpath, "-o", outpath], bngl_channel, processManager);
      }
      bngl_channel.appendLine(term_cmd);
      process2.then((exitCode) => {
        if (exitCode) {
          vscode3.window.showInformationMessage("Plotting failed, see BNGL output channel for details.");
          bngl_channel.show();
        } else {
          vscode3.window.showInformationMessage("Done plotting.");
          let outUri = vscode3.Uri.file(outpath);
          if (fs.existsSync(outpath)) {
            vscode3.commands.executeCommand("vscode.open", outUri);
          } else {
            vscode3.window.showInformationMessage("Could not open plot image file, see BNGL output channel for details.");
            bngl_channel.show();
          }
        }
      }).catch(() => {
      });
    }
  }
  async function setupCommandHandler() {
    bngl_channel.appendLine("Checking for perl.");
    const perlCheckExitCode = await spawnAsync("perl", ["-v"], bngl_channel, processManager);
    if (perlCheckExitCode) {
      bngl_channel.appendLine("Could not find perl.");
      vscode3.window.showInformationMessage("You must install Perl (https://www.perl.org/get.html). We recommend Strawberry Perl for Windows.");
      bngl_channel.show();
    } else {
      bngl_channel.appendLine("Found perl.");
    }
    bngl_channel.appendLine("Getting python path.");
    const pythonPath = await getPythonPath(bngl_channel);
    bngl_channel.appendLine("Found python path: " + pythonPath);
    bngl_channel.appendLine("Checking for bionetgen.");
    const bngCheckExitCode = await spawnAsync(pythonPath, ["-m", "pip", "show", "bionetgen"], bngl_channel, processManager);
    if (bngCheckExitCode) {
      bngl_channel.appendLine("Installing PyBNG for python: " + pythonPath);
      vscode3.window.showInformationMessage("Setting up BNG for the following Python: " + pythonPath);
      const installExitCode = await spawnAsync(pythonPath, ["-m", "pip", "install", "bionetgen", "--upgrade"], bngl_channel, processManager);
      if (installExitCode) {
        bngl_channel.appendLine("pip install failed for python: " + pythonPath);
        vscode3.window.showInformationMessage("BNG setup failed, see BNGL output channel for details.");
        bngl_channel.show();
      } else {
        bngl_channel.appendLine("pip install succeeded for python: " + pythonPath);
        vscode3.window.showInformationMessage("BNG setup complete.");
      }
    } else {
      bngl_channel.appendLine("Found bionetgen.");
    }
  }
  async function upgradeCommandHandler() {
    bngl_channel.appendLine("Running BNG upgrade ...");
    const pythonPath = await getPythonPath(bngl_channel);
    bngl_channel.appendLine("Found python path: " + pythonPath);
    vscode3.window.showInformationMessage("Upgrading BNG for the following Python: " + pythonPath);
    const upgradeExitCode = await spawnAsync(pythonPath, ["-m", "pip", "install", "bionetgen", "--upgrade"], bngl_channel, processManager);
    if (upgradeExitCode) {
      bngl_channel.appendLine("pip upgrade failed for python: " + pythonPath);
      vscode3.window.showInformationMessage("BNG upgrade failed, see BNGL output channel for details.");
      bngl_channel.show();
    } else {
      bngl_channel.appendLine("pip upgrade successful for python: " + pythonPath);
      vscode3.window.showInformationMessage("BNG upgrade complete.");
    }
  }
  context.subscriptions.push(vscode3.commands.registerCommand("bng.run_bngl", runCommandHandler));
  context.subscriptions.push(vscode3.commands.registerCommand("bng.run_viz", vizCommandHandler));
  context.subscriptions.push(vscode3.commands.registerCommand("bng.plot_dat", plotDatCommandHandler));
  context.subscriptions.push(vscode3.commands.registerCommand("bng.webview", () => {
    PlotPanel.create(context.extensionUri);
  }));
  context.subscriptions.push(vscode3.commands.registerCommand("bng.setup", setupCommandHandler));
  context.subscriptions.push(vscode3.commands.registerCommand("bng.upgrade", upgradeCommandHandler));
  context.subscriptions.push(vscode3.commands.registerCommand("bng.process_cleanup", () => {
    processManager.killAllProcesses();
  }));
  context.subscriptions.push(vscode3.commands.registerCommand("bng.kill_process", (processObject) => {
    processManager.killProcess(processObject);
  }));
  vscode3.window.createTreeView("processManagerTreeView", { treeDataProvider: new ProcessManagerProvider(processManager) });
  vscode3.commands.executeCommand("setContext", "bng.processManagerActive", true);
  context.subscriptions.push(
    vscode3.languages.registerFoldingRangeProvider({ language: "bngl" }, {
      provideFoldingRanges(document) {
        const ranges = [];
        const beginStack = [];
        function normalizeName(name) {
          let n = name.trim().toLowerCase();
          n = n.split("#")[0].trim();
          if (n === "reaction rules" || n === "rules") return "rules";
          if (n === "molecule types" || n === "molecules") return "molecules";
          if (n === "seed species" || n === "species") return "species";
          return n;
        }
        for (let i = 0; i < document.lineCount; i++) {
          const lineText = document.lineAt(i).text;
          const trimmed = lineText.trimStart();
          const beginMatch = trimmed.match(/^begin\s+(.+)/i);
          if (beginMatch) {
            const name = normalizeName(beginMatch[1]);
            beginStack.push({ line: i, name });
            continue;
          }
          const endMatch = trimmed.match(/^end\s+(.+)/i);
          if (endMatch && beginStack.length > 0) {
            const endName = normalizeName(endMatch[1]);
            for (let j = beginStack.length - 1; j >= 0; j--) {
              if (beginStack[j].name === endName) {
                ranges.push(new vscode3.FoldingRange(beginStack[j].line, i, vscode3.FoldingRangeKind.Region));
                beginStack.splice(j);
                break;
              }
            }
            continue;
          }
          const metaMatch = trimmed.match(/^#@\w+/);
          if (metaMatch) {
            let endLine = i;
            for (let j = i + 1; j < document.lineCount; j++) {
              const nextTrimmed = document.lineAt(j).text.trimStart();
              if (nextTrimmed.match(/^#@\w+/) || nextTrimmed === "" || !nextTrimmed.startsWith("#")) {
                break;
              }
              endLine = j;
            }
            if (endLine > i) {
              ranges.push(new vscode3.FoldingRange(i, endLine, vscode3.FoldingRangeKind.Comment));
            }
          }
        }
        return ranges;
      }
    })
  );
}
function openGdat(new_fold_uri, fname_noext, context) {
  var files = fs.readdirSync(new_fold_uri.fsPath);
  var outGdatPath;
  for (var i = 0; i < files.length; i++) {
    let fileInfo = files[i].split(".");
    let ext = fileInfo.pop();
    let name = fileInfo.pop();
    if (name === fname_noext && ext === "gdat") {
      outGdatPath = path.join(new_fold_uri.fsPath, files[i]);
      break;
    }
    if (outGdatPath === void 0 && ext === "gdat") {
      outGdatPath = path.join(new_fold_uri.fsPath, files[i]);
    }
  }
  if (outGdatPath) {
    let outGdatUri = vscode3.Uri.file(outGdatPath);
    vscode3.commands.executeCommand("vscode.open", outGdatUri).then(() => {
      PlotPanel.create(context.extensionUri);
    });
  }
}
function checkImage(outpath, timeout) {
  return new Promise((resolve, reject) => {
    var timer = setTimeout(() => {
      watcher.close();
      reject();
    }, timeout);
    if (fs.existsSync(outpath)) {
      clearTimeout(timer);
      resolve();
      return;
    }
    var dir = path.dirname(outpath);
    var basename2 = path.basename(outpath);
    var watcher = fs.watch(dir, (eventType, filename) => {
      if (eventType === "rename" && filename === basename2) {
        clearTimeout(timer);
        watcher.close();
        resolve();
      }
    });
  });
}
function checkGdat(outpath, timeout) {
  return new Promise((resolve, reject) => {
    var timer = setTimeout(() => {
      watcher.close();
      reject();
    }, timeout);
    var watcher = fs.watch(outpath, (eventType, filename) => {
      if (!filename) return;
      let ext = filename.split(".").pop();
      if (eventType === "rename" && ext === "gdat") {
        clearTimeout(timer);
        watcher.close();
        resolve();
      }
    });
  });
}
var PlotPanel = class _PlotPanel {
  constructor(panel, extensionUri, _fpath) {
    this._fpath = _fpath;
    this._disposables = [];
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._setup();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "alert":
          vscode3.window.showInformationMessage(message.text);
          return;
        case "ready":
          this._send_figure_data();
          return;
        case "image":
          this._save_image(message);
          return;
      }
    }, null, this._disposables);
  }
  static {
    this.currentPanels = /* @__PURE__ */ new Map();
  }
  static {
    this.viewType = "plot";
  }
  static create(extensionUri) {
    const editor = vscode3.window.activeTextEditor;
    if (!editor) return;
    const fpath = editor.document.fileName;
    const column = vscode3.window.activeTextEditor ? vscode3.window.activeTextEditor.viewColumn : void 0;
    if (_PlotPanel.currentPanels.has(fpath)) {
      _PlotPanel.currentPanels.get(fpath)?._panel.reveal(column);
      return;
    }
    const extension = path.extname(fpath).substring(1);
    let title = "Unknown";
    if (extension === "graphml") title = "GraphML Viewer";
    else if (extension === "gdat" || extension === "cdat") title = "Plot viewer";
    else if (extension === "scan") title = "Scan Plot";
    const panel = vscode3.window.createWebviewPanel(
      _PlotPanel.viewType,
      title,
      column || vscode3.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode3.Uri.joinPath(extensionUri, "media")],
        retainContextWhenHidden: true
      }
    );
    _PlotPanel.currentPanels.set(fpath, new _PlotPanel(panel, extensionUri, fpath));
  }
  _setup() {
    const webview = this._panel.webview;
    const nonce = get_nonce();
    const extension = path.extname(this._fpath).substring(1);
    const fname = path.basename(this._fpath, path.extname(this._fpath));
    const scriptUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "main.js"));
    const plotlyUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "plotly-latest.min.js"));
    const cytoUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "cytoscape.min.js"));
    const jqUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "jquery-3.5.1.min.js"));
    const stylesMainUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "main.css"));
    const folder = path.dirname(this._fpath);
    webview.html = this._get_html(webview, nonce, fname, extension, folder, stylesMainUri, jqUri, cytoUri, plotlyUri, scriptUri);
  }
  _get_html(webview, nonce, fname, ext, folder, stylesMainUri, jqUri, cytoUri, plotlyUri, scriptUri) {
    let content = "";
    if (ext === "graphml") {
      content = `
				<div id="network"></div>
				<div id="top_buttons">
				  <button id="layout_button" class="button" type="button">Redo Layout</button>
				  <button id="png_button" class="button" type="button">Save as PNG</button>
				</div>
				<script nonce="${nonce}" src="${jqUri}"></script>
				<script nonce="${nonce}" src="${cytoUri}"></script>
			`;
    } else {
      content = `
				<div id="plot"></div>
				<script nonce="${nonce}" src="${jqUri}"></script>
				<script nonce="${nonce}" src="${plotlyUri}"></script>
			`;
    }
    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesMainUri}" rel="stylesheet">
			</head>
			<body>
				<div id="page_title" style="display: none;">${fname}_${ext}</div>
				<div id="folder" style="display: none;">${folder}</div>
				${content}
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
  _send_figure_data() {
    const ext = path.extname(this._fpath).substring(1);
    const text = fs.readFileSync(this._fpath, "utf8");
    const config = vscode3.workspace.getConfiguration("bngl");
    if (ext === "graphml") {
      this._panel.webview.postMessage({ command: "network", context: "data", data: text });
    } else {
      const data = this.parse_dat(text);
      this._panel.webview.postMessage({
        command: "plot",
        context: "data",
        names: data[0],
        data: data[1],
        legend: config.get("plotting.legend"),
        max_series: config.get("plotting.max_series_count"),
        menus: config.get("plotting.menus")
      });
    }
  }
  parse_dat(text) {
    let lines = text.split(/[\n\r]+/).filter((e) => e.trim().length > 0);
    let splt_lines = lines.map((w) => w.trim().split(/\s+/));
    let names = splt_lines[0].slice(1);
    let data = splt_lines.slice(1);
    let transposed = data[0].map((_, colIndex) => data.map((row) => row[colIndex]));
    return [names, transposed];
  }
  _save_image(message) {
    const folder = vscode3.Uri.file(message.folder);
    const uri = vscode3.Uri.joinPath(folder, `${message.title}.${message.type}`);
    let data;
    if (message.type === "png") {
      data = Buffer.from(message.text.replace("data:image/png;base64,", ""), "base64");
    } else {
      data = Buffer.from(decodeURIComponent(message.text).replace("data:image/svg+xml,", ""));
    }
    vscode3.workspace.fs.writeFile(uri, data).then(() => {
      vscode3.window.showInformationMessage(`Image saved to ${uri.fsPath}`);
    });
  }
  dispose() {
    _PlotPanel.currentPanels.delete(this._fpath);
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
};
function get_nonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
function get_time_stamped_folder_name() {
  const date = /* @__PURE__ */ new Date();
  return `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, "0")}_${date.getDate().toString().padStart(2, "0")}__${date.getHours().toString().padStart(2, "0")}_${date.getMinutes().toString().padStart(2, "0")}_${date.getSeconds().toString().padStart(2, "0")}`;
}
function deactivate() {
  vscode3.commands.executeCommand("bng.process_cleanup");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
