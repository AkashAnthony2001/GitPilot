import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitService } from '../git/GitService';
import { GitHubService } from '../github/GitHubService';
import {
  DashboardState,
  FromWebviewMessage,
  ToWebviewMessage,
} from '../models/types';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  public static readonly viewType = 'gitpilot.dashboard';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    gitService: GitService,
    authService: AuthService,
    githubService: GitHubService
  ): DashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      DashboardPanel.currentPanel.update();
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'GitPilot Cockpit',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      extensionUri,
      gitService,
      authService,
      githubService
    );
    return DashboardPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly gitService: GitService,
    private readonly authService: AuthService,
    private readonly githubService: GitHubService
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'gitpilot-activitybar.svg');

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: FromWebviewMessage) => this.handleMessage(message),
      null,
      this._disposables
    );

    this.gitService.onDidChangeState(() => this.update(), null, this._disposables);
    this.authService.onDidChangeAuthentication(() => this.update(), null, this._disposables);

    this.update();
  }

  public async update(): Promise<void> {
    const webview = this._panel.webview;
    this._panel.title = 'GitPilot Cockpit';
    this._panel.webview.html = this.getHtmlForWebview(webview);
    await this.postCurrentState();
  }

  private async postCurrentState(): Promise<void> {
    try {
      const repos = await this.gitService.getRepositories();
      const activeRepo = await this.gitService.getActiveRepository();
      const branches = await this.gitService.getBranches();
      const commits = await this.gitService.getCommits(25);
      const stashes = await this.gitService.getStashes();
      const isAuth = await this.authService.isAuthenticated();

      let githubUser = undefined;
      let prs = [];
      let issues = [];
      let workflowRuns = [];
      let releases = [];

      const ghRemote = activeRepo?.remotes.find((r) => r.owner && r.repo);

      if (isAuth) {
        githubUser = await this.githubService.getAuthenticatedUser();

        if (ghRemote?.owner && ghRemote.repo) {
          [prs, issues, workflowRuns, releases] = await Promise.all([
            this.githubService.getPullRequests(ghRemote.owner, ghRemote.repo),
            this.githubService.getIssues(ghRemote.owner, ghRemote.repo),
            this.githubService.getWorkflowRuns(ghRemote.owner, ghRemote.repo, 15),
            this.githubService.getReleases(ghRemote.owner, ghRemote.repo),
          ]);
        }
      }

      const state: DashboardState = {
        repository: activeRepo,
        repositories: repos,
        branches,
        commits,
        stashes,
        githubUser,
        pullRequests: prs,
        issues,
        workflowRuns,
        releases,
        isAuthenticated: isAuth,
        isLoading: false,
        lastRefreshedAt: new Date().toISOString(),
      };

      this.postMessage({ type: 'STATE_UPDATE', payload: state });
    } catch (err: unknown) {
      const error = err as Error;
      this.postMessage({
        type: 'ACTION_ERROR',
        message: error.message || 'Failed to load repository state.',
      });
    }
  }

  private postMessage(message: ToWebviewMessage): void {
    this._panel.webview.postMessage(message);
  }

  private async handleMessage(message: FromWebviewMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'REFRESH':
          this.githubService.clearCache();
          await this.postCurrentState();
          this.postMessage({ type: 'ACTION_SUCCESS', message: 'Data refreshed.' });
          break;

        case 'SWITCH_REPOSITORY':
          this.gitService.setActiveRepositoryId(message.repositoryId);
          await this.postCurrentState();
          break;

        case 'SWITCH_BRANCH':
          await this.gitService.switchBranch(message.branchName);
          vscode.window.showInformationMessage(`Switched to branch ${message.branchName}.`);
          break;

        case 'CREATE_BRANCH':
          await this.gitService.createBranch(message.branchName);
          vscode.window.showInformationMessage(`Created and switched to branch ${message.branchName}.`);
          break;

        case 'APPLY_STASH':
          await this.gitService.applyStash(message.index);
          vscode.window.showInformationMessage(`Applied stash@{${message.index}}.`);
          break;

        case 'POP_STASH':
          await this.gitService.popStash(message.index);
          vscode.window.showInformationMessage(`Popped stash@{${message.index}}.`);
          break;

        case 'DROP_STASH': {
          const config = vscode.workspace.getConfiguration('gitpilot');
          const confirm = config.get<boolean>('confirmDestructiveActions', true);
          if (confirm) {
            const answer = await vscode.window.showWarningMessage(
              `Are you sure you want to drop stash@{${message.index}}? This action cannot be undone.`,
              { modal: true },
              'Drop Stash'
            );
            if (answer !== 'Drop Stash') {
              return;
            }
          }
          await this.gitService.dropStash(message.index);
          vscode.window.showInformationMessage(`Dropped stash@{${message.index}}.`);
          break;
        }

        case 'VIEW_STASH_DIFF': {
          const diff = await this.gitService.getStashDiff(message.index);
          const doc = await vscode.workspace.openTextDocument({
            content: diff,
            language: 'diff',
          });
          await vscode.window.showTextDocument(doc, { preview: true });
          break;
        }

        case 'SIGN_IN':
          await this.authService.signIn();
          await this.postCurrentState();
          break;

        case 'SIGN_OUT':
          await this.authService.signOut();
          await this.postCurrentState();
          break;

        case 'OPEN_URL':
          if (message.url) {
            await vscode.env.openExternal(vscode.Uri.parse(message.url));
          }
          break;

        case 'EXECUTE_COMMAND':
          if (message.command) {
            await vscode.commands.executeCommand(message.command, ...(message.args || []));
          }
          break;
      }
    } catch (err: unknown) {
      const error = err as Error;
      vscode.window.showErrorMessage(`GitPilot Error: ${error.message}`);
      this.postMessage({ type: 'ACTION_ERROR', message: error.message });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const webviewDistDir = path.join(this._extensionUri.fsPath, 'dist', 'webview');

    // Check if built webview bundle exists
    let scriptUri: vscode.Uri | undefined;
    let styleUri: vscode.Uri | undefined;

    if (fs.existsSync(webviewDistDir)) {
      const assetsDir = path.join(webviewDistDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const jsFile = files.find((f) => f.endsWith('.js'));
        const cssFile = files.find((f) => f.endsWith('.css'));

        if (jsFile) {
          scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', jsFile));
        }
        if (cssFile) {
          styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', cssFile));
        }
      }
    }

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} https: data:`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitPilot Cockpit</title>
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ''}
  <style>
    body {
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
  </style>
</head>
<body>
  <div id="root">
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; gap: 1rem;">
      <div style="font-size: 1.25rem; font-weight: 600; color: var(--vscode-foreground);">Loading GitPilot Cockpit...</div>
      <div style="font-size: 0.875rem; color: var(--vscode-descriptionForeground);">Initializing repository and GitHub state</div>
    </div>
  </div>
  ${scriptUri ? `<script nonce="${nonce}" src="${scriptUri}"></script>` : `<script nonce="${nonce}">console.warn('GitPilot Webview assets not found at dist/webview');</script>`}
</body>
</html>`;
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
  }
}
