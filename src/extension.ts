// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import assert from "node:assert"
import { DIFF_VIEW_URI_SCHEME } from "@hosts/vscode/VscodeDiffViewProvider"
// import * as vscode from "vscode"

import { sendChatButtonClickedEvent } from "./core/controller/ui/subscribeToChatButtonClicked"
import { sendHistoryButtonClickedEvent } from "./core/controller/ui/subscribeToHistoryButtonClicked"
import { WebviewProvider } from "@core/webview"
import { createClineAPI } from "./exports"
import { Logger } from "./services/logging/Logger"
import { cleanupTestMode, initializeTestMode } from "./services/test/TestMode"
import "./utils/path"; // necessary to have access to String.prototype.toPosix

// import path from "node:path"
import type { ExtensionContext } from "vscode"
import { HostProvider } from "@/hosts/host-provider"
import { vscodeHostBridgeClient } from "@/hosts/vscode/hostbridge/client/host-grpc-client"
import { readTextFromClipboard, writeTextToClipboard } from "@/utils/env"
import { initialize, tearDown } from "./common"
import { addToCline } from "./core/controller/commands/addToCline"
import { explainWithCline } from "./core/controller/commands/explainWithCline"
import { fixWithCline } from "./core/controller/commands/fixWithCline"
import { improveWithCline } from "./core/controller/commands/improveWithCline"
import { clearOnboardingModelsCache } from "./core/controller/models/getClineOnboardingModels"
import { sendAddToInputEvent } from "./core/controller/ui/subscribeToAddToInput"
import { sendShowWebviewEvent } from "./core/controller/ui/subscribeToShowWebview"
import { HookDiscoveryCache } from "./core/hooks/HookDiscoveryCache"
import { HookProcessRegistry } from "./core/hooks/HookProcessRegistry"
import { workspaceResolver } from "./core/workspace"
import { getContextForCommand, showWebview } from "./hosts/vscode/commandUtils"
import { abortCommitGeneration, generateCommitMsg } from "./hosts/vscode/commit-message-generator"
import {
	disposeVscodeCommentReviewController,
	getVscodeCommentReviewController,
} from "./hosts/vscode/review/VscodeCommentReviewController"
import { VscodeTerminalManager } from "./hosts/vscode/terminal/VscodeTerminalManager"
import { VscodeDiffViewProvider } from "./hosts/vscode/VscodeDiffViewProvider"
import { VscodeWebviewProvider } from "./hosts/vscode/VscodeWebviewProvider"
import { ExtensionRegistryInfo } from "./registry"

import { telemetryService } from "./services/telemetry"
import { SharedUriHandler } from "./services/uri/SharedUriHandler"
import { ShowMessageType } from "./shared/proto/host/window"
import { fileExistsAtPath } from "./utils/fs"
/*
Built using https://github.com/microsoft/vscode-webview-ui-toolkit

Inspired by
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra

*/

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
import * as vscode from 'vscode'
import * as path from 'path'
import { WebSocketClient } from './websocket-client'
import { DiffManager } from './diff-manager'
import {
	ServerMessage,
	FileChangeMessage,
	CloseDiffMessage,
	DiagnosticInfo,
} from './protocol'
import * as os from 'os'

const DEFAULT_PORT = 51820;

let wsClient: WebSocketClient;
let diffManager: DiffManager;
let coderStatusBarItem: vscode.StatusBarItem;
let botStatusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let extensionContext: vscode.ExtensionContext;

let terminal: vscode.Terminal | undefined;

// part 4
import { getWebviewContent, saveGGUFMetadata } from "./hosts/vscode/utils"
import { htmlContentLoading } from "./constants"

export async function activate(context: vscode.ExtensionContext) {
// part 4 -Editor
  console.log('gguf-editor is now active!');

  context.subscriptions.push(
    vscode.commands.registerCommand("gguf-editor.open", (uri: vscode.Uri) => {
      const panel = vscode.window.createWebviewPanel(
        "gguf-editor", // Identifies the type of the webview. Used internally
        "gguf-editor", // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Editor column to show the new webview panel in.
        {
          // Webview options.
          enableScripts: true, // Enable scripts in the webview
        }
      );

      panel.webview.html = htmlContentLoading;

      getWebviewContent(uri)
        .then(({ htmlContent, fileName }) => {
          panel.title = `GGUF: ${fileName}`;
          panel.webview.html = htmlContent;
        })
        .catch((error) => {
          console.error("Failed to get webview content:", error);
        });

      panel.webview.onDidReceiveMessage(async (message) => {
        let searchTerm = "";
        switch (message.command) {
          case "search":
            searchTerm = message.text;
            break;
          case "reset":
            break;
          case "save":
            try {
              await saveGGUFMetadata(uri, message.metadata, message.tensorNames, message.deletedTensors);
              vscode.window.showInformationMessage("GGUF metadata and tensor names saved successfully!");
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to save GGUF file: ${error}`);
            }
            break;
          case "delete":
            // For now, we'll just refresh the view. The actual deletion happens during save.
            // In a future enhancement, we could maintain a list of deleted tensors in the webview state.
            break;
        }
        getWebviewContent(uri, searchTerm).then(({ htmlContent }) => {
          panel.webview.html = htmlContent;
        });
      });
    })
  );

// part 3 - OpenClaw
    // console.log('OpenClaw extension is now active');

    // Create status bar item
    botStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    botStatusBarItem.command = 'openclawbot.showMenu';
    botStatusBarItem.text = '$(hubot) Bot';
    botStatusBarItem.tooltip = 'Click to show Bot menu';
    botStatusBarItem.show();
    context.subscriptions.push(botStatusBarItem);

    // Register menu command
    let menuCommand = vscode.commands.registerCommand('openclawbot.showMenu', async () => {
        const selection = await vscode.window.showInformationMessage(
            "Connect to Bot? Make sure your openclaw is ready.",
            "Wake up",
            // "Onboard",
            // "Gateway",
            // "Dashboard",
            "Console",
            "Start",
            "Stop",
            "Restart"
        );

        if (selection) {
            const commandMap: { [key: string]: string } = {
                'Wake up': 'openclaw status',
                // 'Onboard': 'openclaw onboard',
                // 'Gateway': 'openclaw gateway',
                // 'Dashboard': 'openclaw dashboard',
                'Console': 'openclaw tui',
                'Start': 'openclaw gateway start',
                'Stop': 'openclaw gateway stop',
                'Restart': 'openclaw gateway restart'
            };
            const command = commandMap[selection];
            if (command) {
                await runOpenBotCommand(context, command);
            }
        }
    });
    context.subscriptions.push(menuCommand);

    // Check auto-connect setting (disable auto-connect with openclaw module)
    // const config2 = vscode.workspace.getConfiguration('openclaw');
    // const autoConnect = config2.get<boolean>('autoConnect', false);
    // if (autoConnect) {
    //     // Auto-connect on startup (runs status)
    //     setTimeout(() => {
    //         runOpenClawCommand(context, 'openclaw status');
    //     }, 1000); // Small delay to ensure everything is initialized
    // }

    // Listen for terminal close events
    vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (terminal && closedTerminal === terminal) {
            terminal = undefined;
            botStatusBarItem.text = '$(hubot) Bot';
            botStatusBarItem.tooltip = 'Click to show Bot menu';
        }
    });

// part 1
	extensionContext = context;
	outputChannel = vscode.window.createOutputChannel('Coder');
	outputChannel.appendLine('Coder extension activating...');

	// Initialize components
	wsClient = new WebSocketClient(outputChannel);
	diffManager = new DiffManager(context);

	// Create status bar item
	coderStatusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100,
	);
	coderStatusBarItem.command = 'coder.connect';
	updateStatusBar(false);
	coderStatusBarItem.show();

	// Handle messages from CLI
	wsClient.onMessage(message => handleServerMessage(message));

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('coder.connect', connect),
		vscode.commands.registerCommand('coder.disconnect', disconnect),
		vscode.commands.registerCommand('coder.startCli', startCli),
		vscode.commands.registerCommand('coder.openSplitTerminal', openSplitTerminal),
		// Context menu commands
		vscode.commands.registerCommand('coder.askAboutCode', () =>
			sendCodeToCoder('ask'),
		),
		vscode.commands.registerCommand('coder.explainCode', () =>
			sendCodeToCoder('explain'),
		),
		vscode.commands.registerCommand('coder.refactorCode', () =>
			sendCodeToCoder('refactor'),
		),
	);

	// Auto-connect if configured
	const config = vscode.workspace.getConfiguration('coder');
	if (config.get<boolean>('autoConnect', true)) {
		setTimeout(() => connect(), 1000);
	}

	context.subscriptions.push(
		coderStatusBarItem,
		outputChannel,
		{ dispose: () => wsClient.disconnect() },
		{ dispose: () => diffManager.dispose() },
	);

	outputChannel.appendLine('Coder extension activated');

// part 2

	setupHostProvider(context)

	// Initialize hook discovery cache for performance optimization
	HookDiscoveryCache.getInstance().initialize(
		context as any, // Adapt VSCode ExtensionContext to generic interface
		(dir: string) => {
			try {
				const pattern = new vscode.RelativePattern(dir, "*")
				const watcher = vscode.workspace.createFileSystemWatcher(pattern)
				// Adapt VSCode FileSystemWatcher to generic interface
				return {
					onDidCreate: (listener: () => void) => watcher.onDidCreate(listener),
					onDidChange: (listener: () => void) => watcher.onDidChange(listener),
					onDidDelete: (listener: () => void) => watcher.onDidDelete(listener),
					dispose: () => watcher.dispose(),
				}
			} catch {
				return null
			}
		},
		(callback: () => void) => {
			// Adapt VSCode Disposable to generic interface
			return vscode.workspace.onDidChangeWorkspaceFolders(callback)
		},
	)

	const webview = (await initialize(context)) as VscodeWebviewProvider

	Logger.log("Coder extension activated")

	const testModeWatchers = await initializeTestMode(webview)
	// Initialize test mode and add disposables to context
	context.subscriptions.push(...testModeWatchers)

	vscode.commands.executeCommand("setContext", "coder.isDevMode", IS_DEV && IS_DEV === "true")

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VscodeWebviewProvider.SIDEBAR_ID, webview, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	const { commands } = ExtensionRegistryInfo

	context.subscriptions.push(
		vscode.commands.registerCommand(commands.PlusButton, async () => {
			console.log("[DEBUG] plusButtonClicked")

			const sidebarInstance = WebviewProvider.getInstance()
			await sidebarInstance.controller.clearTask()
			await sidebarInstance.controller.postStateToWebview()
			await sendChatButtonClickedEvent()
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(commands.HistoryButton, async () => {
			// Send event to all subscribers using the gRPC streaming method
			await sendHistoryButtonClickedEvent()
		}),
	)

	/*
	We use the text document content provider API to show the left side for diff view by creating a
	virtual document for the original content. This makes it readonly so users know to edit the right
	side if they want to keep their changes.

	- This API allows you to create readonly documents in VSCode from arbitrary sources, and works by
	claiming an uri-scheme for which your provider then returns text contents. The scheme must be
	provided when registering a provider and cannot change afterwards.
	- Note how the provider doesn't create uris for virtual documents - its role is to provide contents
	 given such an uri. In return, content providers are wired into the open document logic so that
	 providers are always considered.
	https://code.visualstudio.com/api/extension-guides/virtual-documents
	*/
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider))

	const handleUri = async (uri: vscode.Uri) => {
		const url = decodeURIComponent(uri.toString())
		const success = await SharedUriHandler.handleUri(url)
		if (!success) {
			console.warn("Extension URI handler: Failed to process URI:", uri.toString())
		}
	}
	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register size testing commands in development mode
	if (IS_DEV && IS_DEV === "true") {
		// Use dynamic import to avoid loading the module in production
		import("./dev/commands/tasks")
			.then((module) => {
				const devTaskCommands = module.registerTaskCommands(webview.controller)
				context.subscriptions.push(...devTaskCommands)
				Logger.log("Coder dev task commands registered")
			})
			.catch((error) => {
				Logger.log("Failed to register dev task commands: " + error)
			})
	}

	context.subscriptions.push(
		vscode.commands.registerCommand(commands.TerminalOutput, async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				return
			}

			// Save current clipboard content
			const tempCopyBuffer = await readTextFromClipboard()

			try {
				// Copy the *existing* terminal selection (without selecting all)
				await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

				// Get copied content
				const terminalContents = (await readTextFromClipboard()).trim()

				// Restore original clipboard content
				await writeTextToClipboard(tempCopyBuffer)

				if (!terminalContents) {
					// No terminal content was copied (either nothing selected or some error)
					return
				}
				// Ensure the sidebar view is visible but preserve editor focus
				await showWebview(true)

				await sendAddToInputEvent(`Terminal output:\n\`\`\`\n${terminalContents}\n\`\`\``)

				console.log("addSelectedTerminalOutputToChat", terminalContents, terminal.name)
			} catch (error) {
				// Ensure clipboard is restored even if an error occurs
				await writeTextToClipboard(tempCopyBuffer)
				console.error("Error getting terminal contents:", error)
				HostProvider.window.showMessage({
					type: ShowMessageType.ERROR,
					message: "Failed to get terminal contents",
				})
			}
		}),
	)

	// Register code action provider
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			"*",
			new (class implements vscode.CodeActionProvider {
				public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Refactor]

				provideCodeActions(
					document: vscode.TextDocument,
					range: vscode.Range,
					context: vscode.CodeActionContext,
				): vscode.CodeAction[] {
					const CONTEXT_LINES_TO_EXPAND = 3
					const START_OF_LINE_CHAR_INDEX = 0
					const LINE_COUNT_ADJUSTMENT_FOR_ZERO_INDEXING = 1

					const actions: vscode.CodeAction[] = []
					const editor = vscode.window.activeTextEditor // Get active editor for selection check

					// Expand range to include surrounding 3 lines or use selection if broader
					const selection = editor?.selection
					let expandedRange = range
					if (
						editor &&
						selection &&
						!selection.isEmpty &&
						selection.contains(range.start) &&
						selection.contains(range.end)
					) {
						expandedRange = selection
					} else {
						expandedRange = new vscode.Range(
							Math.max(0, range.start.line - CONTEXT_LINES_TO_EXPAND),
							START_OF_LINE_CHAR_INDEX,
							Math.min(
								document.lineCount - LINE_COUNT_ADJUSTMENT_FOR_ZERO_INDEXING,
								range.end.line + CONTEXT_LINES_TO_EXPAND,
							),
							document.lineAt(
								Math.min(
									document.lineCount - LINE_COUNT_ADJUSTMENT_FOR_ZERO_INDEXING,
									range.end.line + CONTEXT_LINES_TO_EXPAND,
								),
							).text.length,
						)
					}

					// Add to Cline (Always available)
					const addAction = new vscode.CodeAction("Add to Coder", vscode.CodeActionKind.QuickFix)
					addAction.command = {
						command: commands.AddToChat,
						title: "Add to Coder",
						arguments: [expandedRange, context.diagnostics],
					}
					actions.push(addAction)

					// Explain with Cline (Always available)
					const explainAction = new vscode.CodeAction("Explain with Coder", vscode.CodeActionKind.RefactorExtract) // Using a refactor kind
					explainAction.command = {
						command: commands.ExplainCode,
						title: "Explain with Coder",
						arguments: [expandedRange],
					}
					actions.push(explainAction)

					// Improve with Cline (Always available)
					const improveAction = new vscode.CodeAction("Improve with Coder", vscode.CodeActionKind.RefactorRewrite) // Using a refactor kind
					improveAction.command = {
						command: commands.ImproveCode,
						title: "Improve with Coder",
						arguments: [expandedRange],
					}
					actions.push(improveAction)

					// Fix with Cline (Only if diagnostics exist)
					if (context.diagnostics.length > 0) {
						const fixAction = new vscode.CodeAction("Fix with Coder", vscode.CodeActionKind.QuickFix)
						fixAction.isPreferred = true
						fixAction.command = {
							command: commands.FixWithCline,
							title: "Fix with Coder",
							arguments: [expandedRange, context.diagnostics],
						}
						actions.push(fixAction)
					}
					return actions
				}
			})(),
			{
				providedCodeActionKinds: [
					vscode.CodeActionKind.QuickFix,
					vscode.CodeActionKind.RefactorExtract,
					vscode.CodeActionKind.RefactorRewrite,
				],
			},
		),
	)

	// Register the command handlers
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.AddToChat, async (range?: vscode.Range, diagnostics?: vscode.Diagnostic[]) => {
			const context = await getContextForCommand(range, diagnostics)
			if (!context) {
				return
			}
			await addToCline(context.controller, context.commandContext)
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.FixWithCline, async (range: vscode.Range, diagnostics: vscode.Diagnostic[]) => {
			const context = await getContextForCommand(range, diagnostics)
			if (!context) {
				return
			}
			await fixWithCline(context.controller, context.commandContext)
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.ExplainCode, async (range: vscode.Range) => {
			const context = await getContextForCommand(range)
			if (!context) {
				return
			}
			await explainWithCline(context.controller, context.commandContext)
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.ImproveCode, async (range: vscode.Range) => {
			const context = await getContextForCommand(range)
			if (!context) {
				return
			}
			await improveWithCline(context.controller, context.commandContext)
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand(commands.FocusChatInput, async (preserveEditorFocus: boolean = false) => {
			const webview = WebviewProvider.getInstance() as VscodeWebviewProvider

			// Show the webview
			const webviewView = webview.getWebview()
			if (webviewView) {
				if (preserveEditorFocus) {
					// Only make webview visible without forcing focus
					webviewView.show(false)
				} else {
					// Show and force focus (default behavior for explicit focus actions)
					webviewView.show(true)
				}
			}

			// Send show webview event with preserveEditorFocus flag
			sendShowWebviewEvent(preserveEditorFocus)
			telemetryService.captureButtonClick("command_focusChatInput", webview.controller?.task?.ulid)
		}),
	)

	// Register the openWalkthrough command handler
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.Walkthrough, async () => {
			await vscode.commands.executeCommand("workbench.action.openWalkthrough", `${context.extension.id}#CoderWalkthrough`)
			telemetryService.captureButtonClick("command_openWalkthrough")
		}),
	)

	// Register the reconstructTaskHistory command handler
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.ReconstructTaskHistory, async () => {
			const { reconstructTaskHistory } = await import("./core/commands/reconstructTaskHistory")
			await reconstructTaskHistory()
			telemetryService.captureButtonClick("command_reconstructTaskHistory")
		}),
	)

	// Register the generateGitCommitMessage command handler
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.GenerateCommit, async (scm) => {
			generateCommitMsg(webview.controller.stateManager, scm)
		}),
		vscode.commands.registerCommand(commands.AbortCommit, () => {
			abortCommitGeneration()
		}),
	)

	return createClineAPI(webview.controller)
}

function setupHostProvider(context: ExtensionContext) {
	console.log("Setting up vscode host providers...")

	const createWebview = () => new VscodeWebviewProvider(context)
	const createDiffView = () => new VscodeDiffViewProvider()
	const createCommentReview = () => getVscodeCommentReviewController()
	const createTerminalManager = () => new VscodeTerminalManager()
	const outputChannel = vscode.window.createOutputChannel("Coder")
	context.subscriptions.push(outputChannel)

	const getCallbackUrl = async () => `${vscode.env.uriScheme || "vscode"}://${context.extension.id}`
	HostProvider.initialize(
		createWebview,
		createDiffView,
		createCommentReview,
		createTerminalManager,
		vscodeHostBridgeClient,
		outputChannel.appendLine,
		getCallbackUrl,
		getBinaryLocation,
		context.extensionUri.fsPath,
		context.globalStorageUri.fsPath,
	)
}

async function getBinaryLocation(name: string): Promise<string> {
	// The only binary currently supported is the rg binary from the VSCode installation.
	if (!name.startsWith("rg")) {
		throw new Error(`Binary '${name}' is not supported`)
	}

	const checkPath = async (pkgFolder: string) => {
		const fullPathResult = workspaceResolver.resolveWorkspacePath(
			vscode.env.appRoot,
			path.join(pkgFolder, name),
			"Services.ripgrep.getBinPath",
		)
		const fullPath = typeof fullPathResult === "string" ? fullPathResult : fullPathResult.absolutePath
		return (await fileExistsAtPath(fullPath)) ? fullPath : undefined
	}

	const binPath =
		(await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
		(await checkPath("node_modules/vscode-ripgrep/bin")) ||
		(await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
		(await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/"))
	if (!binPath) {
		throw new Error("Could not find ripgrep binary")
	}
	return binPath
}

// This method is called when your extension is deactivated
export function deactivate() {
	wsClient?.disconnect();
	diffManager?.dispose();
	// part 3
    if (terminal) {
        terminal.dispose();
    }
}

// Connection management
async function connect(): Promise<void> {
	const config = vscode.workspace.getConfiguration('coder');
	const port = config.get<number>('serverPort', DEFAULT_PORT);

	updateStatusBar(false, 'Connecting...');

	const connected = await wsClient.connect(port);

	if (connected) {
		updateStatusBar(true);
		sendWorkspaceContext();
		vscode.window.showInformationMessage('Connected to Coder CLI');
	} else {
		updateStatusBar(false);
		const action = await vscode.window.showInformationMessage(
			'Connect to CLI? Make sure your Coder is ready.',
			'Start CLI',
			'Reconnect',
		);
		if (action === 'Start CLI') {
			startCli();
		} else if (action === 'Reconnect') {
			connect();
		}
	}

// part 2

	Logger.log("Coder extension deactivating, cleaning up resources...")

	tearDown()

	// Clean up test mode
	cleanupTestMode()

	// Kill any running hook processes to prevent zombies
	await HookProcessRegistry.terminateAll()

	// Clean up hook discovery cache
	HookDiscoveryCache.getInstance().dispose()

	// Clean up comment review controller
	disposeVscodeCommentReviewController()

	clearOnboardingModelsCache()

	Logger.log("Coder extension deactivated")
}

// TODO: Find a solution for automatically removing DEV related content from production builds.
//  This type of code is fine in production to keep. We just will want to remove it from production builds
//  to bring down built asset sizes.
//
// This is a workaround to reload the extension when the source code changes
// since vscode doesn't support hot reload for extensions
const IS_DEV = process.env.IS_DEV
const DEV_WORKSPACE_FOLDER = process.env.DEV_WORKSPACE_FOLDER

// Set up development mode file watcher
if (IS_DEV && IS_DEV !== "false") {
	assert(DEV_WORKSPACE_FOLDER, "DEV_WORKSPACE_FOLDER must be set in development")
	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(DEV_WORKSPACE_FOLDER, "src/**/*"))

	watcher.onDidChange(({ scheme, path }) => {
		console.info(`${scheme} ${path} changed. Reloading VSCode...`)

		vscode.commands.executeCommand("workbench.action.reloadWindow")
	})
}


// coder connector
// import * as vscode from 'vscode';
// import * as path from 'path';
// import { WebSocketClient } from './websocket-client';
// import { DiffManager } from './diff-manager';
// import {
// 	ServerMessage,
// 	FileChangeMessage,
// 	CloseDiffMessage,
// 	DiagnosticInfo,
// } from './protocol';

// const DEFAULT_PORT = 51820;

// let wsClient: WebSocketClient;
// let diffManager: DiffManager;
// let statusBarItem: vscode.StatusBarItem;
// let outputChannel: vscode.OutputChannel;
// let extensionContext: vscode.ExtensionContext;

// export function activate(context: vscode.ExtensionContext) {
// 	extensionContext = context;
// 	outputChannel = vscode.window.createOutputChannel('Coder');
// 	outputChannel.appendLine('Coder extension activating...');

// 	// Initialize components
// 	wsClient = new WebSocketClient(outputChannel);
// 	diffManager = new DiffManager(context);

// 	// Create status bar item
// 	statusBarItem = vscode.window.createStatusBarItem(
// 		vscode.StatusBarAlignment.Right,
// 		100,
// 	);
// 	statusBarItem.command = 'coder.connect';
// 	updateStatusBar(false);
// 	statusBarItem.show();

// 	// Handle messages from CLI
// 	wsClient.onMessage(message => handleServerMessage(message));

// 	// Register commands
// 	context.subscriptions.push(
// 		vscode.commands.registerCommand('coder.connect', connect),
// 		vscode.commands.registerCommand('coder.disconnect', disconnect),
// 		vscode.commands.registerCommand('coder.startCli', startCli),
// 		vscode.commands.registerCommand('coder.openSplitTerminal', openSplitTerminal),
// 		// Context menu commands
// 		vscode.commands.registerCommand('coder.askAboutCode', () =>
// 			sendCodeToCoder('ask'),
// 		),
// 		vscode.commands.registerCommand('coder.explainCode', () =>
// 			sendCodeToCoder('explain'),
// 		),
// 		vscode.commands.registerCommand('coder.refactorCode', () =>
// 			sendCodeToCoder('refactor'),
// 		),
// 	);

// 	// Auto-connect if configured
// 	const config = vscode.workspace.getConfiguration('coder');
// 	if (config.get<boolean>('autoConnect', true)) {
// 		setTimeout(() => connect(), 1000);
// 	}

// 	context.subscriptions.push(
// 		statusBarItem,
// 		outputChannel,
// 		{ dispose: () => wsClient.disconnect() },
// 		{ dispose: () => diffManager.dispose() },
// 	);

// 	outputChannel.appendLine('Coder extension activated');
// }

// export function deactivate() {
// 	wsClient?.disconnect();
// 	diffManager?.dispose();
// }

// // Connection management
// async function connect(): Promise<void> {
// 	const config = vscode.workspace.getConfiguration('coder');
// 	const port = config.get<number>('serverPort', DEFAULT_PORT);

// 	updateStatusBar(false, 'Connecting...');

// 	const connected = await wsClient.connect(port);

// 	if (connected) {
// 		updateStatusBar(true);
// 		sendWorkspaceContext();
// 		vscode.window.showInformationMessage('Connected to Coder CLI');
// 	} else {
// 		updateStatusBar(false);
// 		const action = await vscode.window.showInformationMessage(
// 			'Connect to CLI? Make sure your Coder is ready.',
// 			'Start CLI',
// 			'Reconnect',
// 		);
// 		if (action === 'Start CLI') {
// 			startCli();
// 		} else if (action === 'Reconnect') {
// 			connect();
// 		}
// 	}
// }

function disconnect(): void {
	wsClient.disconnect();
	updateStatusBar(false);
	vscode.window.showInformationMessage('Disconnected from Coder CLI');
}

// Status bar updates
function updateStatusBar(connected: boolean, text?: string): void {
	if (text) {
		coderStatusBarItem.text = `$(sync~spin) ${text}`;
	} else if (connected) {
		coderStatusBarItem.text = '$(check) Coder';
		coderStatusBarItem.tooltip = 'Connected to Coder CLI';
		coderStatusBarItem.command = 'coder.disconnect';
	} else {
		coderStatusBarItem.text = '$(plug) Coder';
		coderStatusBarItem.tooltip = 'Click to connect to Coder CLI';
		coderStatusBarItem.command = 'coder.connect';
	}
}

// Message handling
function handleServerMessage(message: ServerMessage): void {
	switch (message.type) {
		case 'file_change':
			handleFileChange(message);
			break;
		case 'close_diff':
			handleCloseDiff(message);
			break;
		case 'status':
			if (message.model) {
				coderStatusBarItem.text = `$(check) ${message.model}`;
			}
			break;
		case 'connection_ack':
			outputChannel.appendLine(
				`Connected to CLI v${message.cliVersion} (protocol v${message.protocolVersion})`,
			);
			break;
		case 'diagnostics_request':
			handleDiagnosticsRequest(message.filePath);
			break;
	}
}

function handleFileChange(message: FileChangeMessage): void {
	const config = vscode.workspace.getConfiguration('coder');
	const showDiffPreview = config.get<boolean>('showDiffPreview', true);

	// Add to pending changes
	diffManager.addPendingChange(message);

	if (showDiffPreview) {
		// Show diff immediately
		diffManager.showDiff(message.id);
	}
}

function handleCloseDiff(message: CloseDiffMessage): void {
	// Close the diff preview when tool is confirmed/rejected in CLI
	diffManager.closeDiff(message.id);
}

function handleDiagnosticsRequest(filePath?: string): void {
	const diagnostics: DiagnosticInfo[] = [];

	if (filePath) {
		// Get diagnostics for specific file
		const uri = vscode.Uri.file(filePath);
		const fileDiagnostics = vscode.languages.getDiagnostics(uri);
		diagnostics.push(...convertDiagnostics(uri, fileDiagnostics));
	} else {
		// Get all diagnostics
		const allDiagnostics = vscode.languages.getDiagnostics();
		for (const [uri, fileDiagnostics] of allDiagnostics) {
			diagnostics.push(...convertDiagnostics(uri, fileDiagnostics));
		}
	}

	wsClient.send({
		type: 'diagnostics_response',
		diagnostics,
	});
}

function convertDiagnostics(
	uri: vscode.Uri,
	diagnostics: readonly vscode.Diagnostic[],
): DiagnosticInfo[] {
	return diagnostics.map(d => ({
		filePath: uri.fsPath,
		line: d.range.start.line + 1, // 1-indexed
		character: d.range.start.character + 1,
		message: d.message,
		severity: severityToString(d.severity),
		source: d.source,
	}));
}

function severityToString(
	severity: vscode.DiagnosticSeverity,
): DiagnosticInfo['severity'] {
	switch (severity) {
		case vscode.DiagnosticSeverity.Error:
			return 'error';
		case vscode.DiagnosticSeverity.Warning:
			return 'warning';
		case vscode.DiagnosticSeverity.Information:
			return 'info';
		case vscode.DiagnosticSeverity.Hint:
			return 'hint';
	}
}

function startCli(): void {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const cwd = workspaceFolder?.uri.fsPath || process.cwd();

	// Create terminal and run coder
	const iconPath = vscode.Uri.file(
		path.join(extensionContext.extensionPath, 'assets', 'images', 'icon.svg'),
	);
	const terminal = vscode.window.createTerminal({
		// name: 'Coder',
		name: 'Monster',
		cwd,
		iconPath,
	});

	terminal.sendText('coder --vscode');
	terminal.show();

	// Try to connect after a delay
	setTimeout(() => connect(), 3000);
}

function openSplitTerminal(): void {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const cwd = workspaceFolder?.uri.fsPath || process.cwd();

	// Create terminal in editor area to the side
	const iconPath = vscode.Uri.file(
		path.join(extensionContext.extensionPath, 'assets', 'images', 'icon.svg'),
	);
	const terminal = vscode.window.createTerminal({
		// name: 'Coder',
		name: 'Monster',
		cwd,
		location: { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
		iconPath,
	});
	// terminal.sendText('coder --vscode');
	// terminal.sendText('coder --lite'); // why not both :P
	terminal.sendText('coder --vscode --lite');
	terminal.show();

	// Try to connect after a delay
	setTimeout(() => connect(), 3000);
}

// Send workspace context to CLI
function sendWorkspaceContext(): void {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const activeEditor = vscode.window.activeTextEditor;

	// Get open files
	const openFiles = vscode.workspace.textDocuments
		.filter(doc => doc.uri.scheme === 'file')
		.map(doc => doc.uri.fsPath);

	// Get diagnostics for open files
	const diagnostics: DiagnosticInfo[] = [];
	for (const filePath of openFiles) {
		const uri = vscode.Uri.file(filePath);
		const fileDiagnostics = vscode.languages.getDiagnostics(uri);
		diagnostics.push(...convertDiagnostics(uri, fileDiagnostics));
	}

	wsClient.send({
		type: 'context',
		workspaceFolder: workspaceFolder?.uri.fsPath,
		openFiles,
		activeFile: activeEditor?.document.uri.fsPath,
		diagnostics,
	});
}

// Send selected code to Coder CLI with a specific action
function sendCodeToCoder(action: 'ask' | 'explain' | 'refactor'): void {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor');
		return;
	}

	const selection = editor.selection;
	if (selection.isEmpty) {
		vscode.window.showWarningMessage('No code selected');
		return;
	}

	if (!wsClient.isConnected()) {
		vscode.window
			.showWarningMessage(
				'Not connected to Coder CLI',
				'Connect',
				'Start CLI',
			)
			.then(choice => {
				if (choice === 'Connect') {
					connect().then(() => sendCodeToCoder(action));
				} else if (choice === 'Start CLI') {
					startCli();
				}
			});
		return;
	}

	const selectedText = editor.document.getText(selection);
	const filePath = editor.document.uri.fsPath;
	const fileName = path.basename(filePath);
	const startLine = selection.start.line + 1;
	const endLine = selection.end.line + 1;

	// Build prompt based on action
	let prompt: string;
	switch (action) {
		case 'ask':
			// For 'ask', prompt the user for their question
			vscode.window
				.showInputBox({
					prompt: 'What would you like to ask about this code?',
					placeHolder: 'Enter your question...',
				})
				.then(question => {
					if (question) {
						const fullPrompt = `${question}\n\nCode from ${fileName} (lines ${startLine}-${endLine}):\n\`\`\`\n${selectedText}\n\`\`\``;
						sendPromptWithContext(
							fullPrompt,
							filePath,
							selectedText,
							selection,
						);
					}
				});
			return;

		case 'explain':
			prompt = `Explain this code from ${fileName} (lines ${startLine}-${endLine}):\n\`\`\`\n${selectedText}\n\`\`\``;
			break;

		case 'refactor':
			prompt = `Suggest refactoring improvements for this code from ${fileName} (lines ${startLine}-${endLine}):\n\`\`\`\n${selectedText}\n\`\`\``;
			break;
	}

	sendPromptWithContext(prompt, filePath, selectedText, selection);
}

// Helper to send prompt with context
function sendPromptWithContext(
	prompt: string,
	filePath: string,
	selection: string,
	selectionRange: vscode.Selection,
): void {
	wsClient.send({
		type: 'send_prompt',
		prompt,
		context: {
			filePath,
			selection,
			cursorPosition: {
				line: selectionRange.start.line,
				character: selectionRange.start.character,
			},
		},
	});

	vscode.window.showInformationMessage('Sent to Coder CLI');
	outputChannel.appendLine(
		`Sent prompt to CLI: ${prompt.substring(0, 100)}...`,
	);
}

// part 3

async function runOpenBotCommand(context: vscode.ExtensionContext, command: string) {
    try {
        // if (command === 'openclaw status') {
        //     // Update status to connecting for status command
        //     statusBarItem.text = '$(sync~spin) Connecting...';
        //     statusBarItem.tooltip = 'Connection in progress';
        // }

        // Detect OS
        const platform = os.platform();
        const isWindows = platform === 'win32';

        // Create or reuse terminal
        if (!terminal) {
            const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'images', 'claw.svg');
            if (isWindows) {
                terminal = vscode.window.createTerminal({
                    name: 'Bot',
                    shellPath: 'wsl.exe',
                    shellArgs: ['-d', 'Ubuntu'],
                    iconPath: iconPath
                });
            } else {
                terminal = vscode.window.createTerminal({
                    name: 'Bot',
                    iconPath: iconPath
                });
            }
        }

        // Show terminal and send command
        terminal.show(true); // true = preserve focus
        terminal.sendText(command);

        // if (command === 'openclaw status') {
        //     // Update status to connected after sending status command
        //     statusBarItem.text = '$(check) Bot';
        //     statusBarItem.tooltip = 'Connected to Bot';
        //     vscode.window.showInformationMessage('OpenClaw Status Command Sent');
        // }
    } catch (error) {
        // botStatusBarItem.text = '$(hubot) Bot';
        botStatusBarItem.tooltip = 'Click to show Bot menu';
        vscode.window.showErrorMessage(`Failed to execute ${command}: ${error}`);
    }
}
