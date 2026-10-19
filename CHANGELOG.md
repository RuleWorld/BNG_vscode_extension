# Change Log

All notable changes to the "bngl-grammar-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.8.4] - 2026-10-19

### Fixed
- Process manager refresh timer is now stopped and disposed on extension teardown; previously a self-rescheduling 500 ms poll kept firing for the life of the extension host, even after `deactivate()`
- `deactivate()` now awaits process cleanup, so the extension host no longer tears down before `killAllProcesses()` finishes and orphans perl/NFsim/run_network children
- Webview-driven file writes (`_save_image`, `_save_graphml_export`) now reject path-traversal: a crafted save title could previously escape the results folder via `..` and write anywhere
- `parseDat` transpose is now aligned to the header instead of the first data row, so ragged rows no longer drop or misalign series; short rows pad with empty cells and extra unnamed columns are dropped
- Unused-parameter detection now counts observable patterns and the pattern half of energy patterns as references, fixing false "never referenced" warnings for parameters used only in those patterns (e.g. a multi-token energy expression like `Gbond * 0.5`)
- `onReferences` is now comment-aware using the parser's string-aware comment stripping, so a `#` inside a quoted string no longer hides a real reference

### Changed
- Marketplace identity is now `BioNetGen-ext.biontegen-vscode-extension` (display name **BioNetGen**), so releases update the maintained BioNetGen-ext listing instead of the retired `als251.bngl` listing; README and docs Marketplace links updated to match
- The plot sidebar variable list is now built with `textContent` instead of `innerHTML` for observable names taken from the (untrusted) data-file header — defense-in-depth, since CSP already blocked inline script execution

### Removed
- Dead operation-only RuleViz scaffolding (`bng.run_ruleviz_operation` and its `ruleviz_operation` command path), superseded by the unified RuleViz browser; the live `ruleviz_operation` visualize-action and GraphML-classification usages are unchanged

## [0.8.3] - 2026-05-29

### Added
- Standalone RuleViz browser (`BNG: Visualize RuleViz`) with a pattern/operation toggle that renders rule visualizations in a built-in viewer instead of relying on external GraphML output
- `BNG: Visualize Regulatory Graph` command alongside `Contact Map` and `All Graphs` for generating only the regulatory GraphML output
- `BNG: Close Generated Tabs` command (`bng.close_generated_artifacts`) to close generated result, plot, and graph tabs in one action
- `BNG: Manage Active Jobs` command (`bng.manage_processes`) for inspecting and stopping running BioNetGen jobs
- `bngl.general.results_retention` setting with folder-based cleanup policies for timestamped `results_<model>/` run folders (`keep_all`, `purge_existing`, `delete_older_than_1w/1d/1h`); cleanup applies before future runs and skips active jobs

### Changed
- Plot viewer and job management UX improvements across the sidebar and process tools
- Simulation logs now stream to the BNGL output channel during runs instead of only appearing after completion
- Standalone RuleViz now defaults to the pattern view, uses unified panel titles, and has refined styling (wildcard bond modifiers, layout parity with the other viewers)
- Standalone regulatory-graph views now use their own custom day/night palette instead of reusing the contact-map colors
- Regulatory graph process nodes now recover compact rule labels from the sibling BNGL model when BioNetGen emits blank oval labels
- Standalone Contact Map exports in light mode now render against a white canvas so the tan molecule boxes separate more clearly
- GraphML saves from the built-in viewer now preserve the current node layout, and the toolbar buttons use clearer `Save ...` wording to match their behavior
- Graph-view toolbar buttons now use a unified palette in each viewer mode, with light blue buttons in Day View and tan buttons in Night View

### Fixed
- `BNG: Close Generated Tabs` now reliably closes the generated tabs it targets
- Plot summary series label now reflects the correct series

## [0.8.2] - 2026-05-19

### Changed
- The standalone Contact Map viewer palette keeps its extension-side override, but now uses higher-contrast Scientific Miro day/night palettes with framed nested boxes and stronger border and label contrast
- GraphML viewer nodes now respect GraphML width/height metadata, and regulatory graph labels are centered inside their nodes to reduce arrow collisions
- Contact-map and regulatory graphs without preset coordinates now default to a more spacious `cose` layout, while the other layout presets use more overlap-aware spacing
- Contact maps now expose direct layout selection, a layout lock, `Scale to Fit`, and show/hide toggles for components and internal states in the built-in viewer

### Fixed
- GraphML label colors now auto-correct for poor contrast against node fills, addressing hard-to-read light-gray labels in dark mode
- Contact-map labels now stay visible in `cose` layouts instead of disappearing at the initial fit zoom, and their font sizing better tracks the node boxes
- `bng.setup` and `bng.upgrade` now pin `setuptools<82` and repair existing environments when `pkg_resources` is missing from newer setuptools releases

## [0.8.1] - 2026-05-18

### Changed
- GraphML viewer tabs now use graph-specific titles instead of the generic `GraphML Viewer` label
- GraphML viewer chrome now follows VS Code theme colors for the surrounding shell and toolbar
- GraphML viewer now offers multiple layout modes (`preset`, `breadthfirst`, `grid`, `circle`, `concentric`, `cose`) plus a dedicated fit action
- GraphML viewer toolbar now supports full-graph PNG export and GraphML export from inside the viewer
- Contact-map GraphML now gets a cleaner extension-side viewer palette instead of the raw BioNetGen gray/white/yellow fills
- Added a dedicated contact-map visualization command, while keeping a separate all-graphs command for the full GraphML set
- Plot and GraphML viewers now include a day/night mode toggle with theme-aware colors
- Plot traces now use a color-blind-friendly default series palette
- Plot PNG export now renders at a higher scale for sharper text and lines

## [0.8.0] - 2026-04-02

### Added
- TypeScript migration and esbuild bundling for faster load times and type safety
- Single-button QuickPick dropdown menu replacing multiple toolbar buttons
- Sidebar plot viewer with variable toggles, search/filter, axis scale (linear/log), line style, and legend toggle
- Lasso/box selection on plots to filter visible time series
- PNG and SVG export from the sidebar
- Light theme (`light-bngl`) for light VS Code themes
- High-contrast dark (`hc-dark-bngl`) and high-contrast light (`hc-light-bngl`) themes for accessibility
- GitHub Actions CI pipeline for type-checking and building on push/PR
- `onCommand:bng.menu` activation event so the menu button works before a `.bngl` file is opened
- `extensionDependencies` for `ms-python.python` now correctly at top level of `package.json`

### Fixed
- Folding provider: `splice(j)` was removing too many stack entries, breaking nested block folding
- `bng.setup` auto-install now runs after all commands are registered (was silently failing)
- `getPythonPath` no longer crashes when the Python extension's `featureFlags` property is missing
- Python commands now preserve interpreter arguments returned by the Python extension instead of flattening them into a single string
- `parse_dat` no longer crashes on empty or header-only data files
- `_send_figure_data` now uses async `vscode.workspace.fs.readFile` instead of blocking `fs.readFileSync`
- `_getProcessList` buffers all stdout before parsing, fixing data loss from split chunks
- `checkGdat` watcher race condition: now checks for existing files before waiting
- `_save_image` validates data URI format and handles write errors
- HTML injection in webview template: `fname` and `folder` are now escaped
- `spawnAsync` now treats launch failures and missing exit codes as errors instead of reporting false success
- VS Code extension tests now run in an isolated temporary workspace with auto-install disabled
- Run and visualize commands now use the selected Python interpreter to invoke the PyBioNetGen CLI, fixing `ENOENT`, wrong-binary issues, and current PyBioNetGen installations that do not support `python -m bionetgen` (RuleWorld/PyBioNetGen#62)

### Removed
- Duplicate `bng.plot_dat` command (was identical to `bng.webview`)
- Unused `bngl.plotting.menus` configuration setting
- `.graphml` from BNGL language registration (was hijacking all GraphML files)
- `dist/` removed from git tracking (built at publish time via `vscode:prepublish`)
- Broken `npm run lint` expectation and stale ESLint config
- Unused variables in `media/main.js` (`oldState`, `plot_initialized`, `current_plot_names`, `current_colors`, `updates`)
- jQuery no longer loaded for plot views (only needed for GraphML)
- TODO comment removed from `docs/install.md`

## [0.7.2]
Minor bugfixes and documentation updates. Auto-opening of files is now on by default, fixed the `writeMexFile` snippet.

## [0.7.1]
A process manager is added for bionetgen and all related processes. Now when you open a BNGL file you should see a BNGL process tree tab and can right click processes to send a kill signal.

## [0.7.0]
When there is an error with the spawn runner, output channel will automatically pop up. Calling BNG upgrade will automatically activate the extension.

## [0.6.9]
Plotting and graph visualizing now correctly respects the terminal runner option. Changed result placement behavior and all results will now be placed in the same folder as the bngl file that's open.

## [0.6.8]
Old terminal runner is now an extra option under extension settings.

## [0.6.7]
Run and plotting operations moved out of terminal calls and now spawns processes to do the same thing. The output is moved to the BNGL output channel.

## [0.6.6]
The extension can now visualize `.graphml` files generated by BioNetGen using [Cytoscape.js](https://js.cytoscape.org/).

## [0.6.5]
The extension now checks for the existence of perl upon activation and warns the user if Perl cannot be called.

## [0.6.4]
Added setting option to stop bng.setup checking upon activation. Piping all setup stdout/stderr to an output channel named `BNGL`.

## [0.6.3]
Added bng.setup and bng.upgrade commands. Upon activation, the extension checks for PyBioNetGen and installs it if missing.

## [0.6.2]
Added `bngl.general.auto_open` and `bngl.general.result_folder` configuration options.

## [0.6.1]
Added a visualize button that runs `bionetgen visualize` on the file. BioNetGen requirement bumped to 0.4.9.

## [0.6.0]
Updating bionetgen commands with the -req keyword to keep the user informed on their bionetgen version.

## [0.5.9]
Additional plotting settings for configurations. Plot line series selection now preserves color ordering.

## [0.5.8]
Adding configuration options to BNGL plotting.

## [0.5.7]
Minor changes to how bionetgen runs, by default it saves a log file under the run now.

## [0.5.6]
LICENSE added, minor plotly plot changes and minor snippet changes.

## [0.5.5]
Changed plotting so that webview sends a message to VS Code when ready and VS Code sends the data into the webview once the ready call is made.

## [0.5.2]
Much improved plotting stability by using plotly promises.

## [0.5.0]
Interactive plotting stability improvement by adding show command.

## [0.4.9]
Improved plotting stability by removing dependencies to older packages.

## [0.4.8]
Action argument highlighting that doesn't require curly braces correctly identified.

## [0.4.7]
Action argument highlighting now expects curly braces and breaks if they are missing.

## [0.4.5]
Fixed a small highlighting issue, snippets for population maps and energy patterns.

## [0.4.4]
Added highlighting for energy patterns block.

## [0.4.3]
Added highlighting for population maps block.

## [0.4.2]
More highlighting fixes where "_" should be allowed in line labels and parameter names.

## [0.4.1]
Adding documentation and small syntax highlighting fix.

## [0.4.0]
Fixed some incorrect snippets.

## [0.3.9]
Further bugfixes to syntax highlighting. Separated "species" and "pattern" objects.

## [0.3.8]
Bugfixes to syntax highlighting in species block.

## [0.3.6]
Any gdat file found after running is automatically opened. Plotly plots assigned to keyboard shortcuts.

## [0.3.5]
Fixed highlighting issue with line labels. Added README gifs to assets.

## [0.3.4]
Moved plotly dropdown menus to the top. Fixed download image issue.

## [0.3.3]
Included net files to the list of file extensions and added the syntax for it.

## [0.3.2]
Plotly hovermode default changed to closest, legends are on by default if there's <= 5 series.

## [0.3.1]
Quote protecting paths so paths that contain spaces will work. Added seconds to timestamps.

## [0.3.0]
Plots appear in active window. Lasso selecting plots allow you to sub select time series.

## [0.2.9]
Major behavior changes, every click on the built-in plotting now pops open a new tab. Added jQuery, working nonce for scripts.

## [0.2.8]
Added plotly plotting to `gdat/cdat/scan` files.

## [0.2.6]
Run button, plotting buttons, highlighting and various snippets. Added `.scan` file plotting button.
