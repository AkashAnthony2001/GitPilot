import * as vscode from 'vscode';
import { AuthService } from './auth/AuthService';
import { registerCommands } from './commands/registerCommands';
import { GitService } from './git/GitService';
import { GitHubService } from './github/GitHubService';
import { ActionsTreeProvider } from './providers/ActionsTreeProvider';
import { BranchesTreeProvider } from './providers/BranchesTreeProvider';
import { CommitsTreeProvider } from './providers/CommitsTreeProvider';
import { DashboardTreeProvider } from './providers/DashboardTreeProvider';
import { IssuesTreeProvider } from './providers/IssuesTreeProvider';
import { PullRequestsTreeProvider } from './providers/PullRequestsTreeProvider';
import { ReleasesTreeProvider } from './providers/ReleasesTreeProvider';
import { RepositoriesTreeProvider } from './providers/RepositoriesTreeProvider';
import { SettingsTreeProvider } from './providers/SettingsTreeProvider';
import { StashesTreeProvider } from './providers/StashesTreeProvider';
import { DashboardPanel } from './webview/DashboardPanel';

let refreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('[GitPilot] Activating extension...');

  // 1. Initialize Core Services
  const gitService = new GitService();
  const authService = new AuthService(context);
  const githubService = new GitHubService(authService);

  context.subscriptions.push(gitService, authService, githubService);

  // 2. Initialize and Register All 10 Sidebar Tree Views
  const dashboardProvider = new DashboardTreeProvider(gitService, authService, githubService);
  const repositoriesProvider = new RepositoriesTreeProvider(gitService);
  const branchesProvider = new BranchesTreeProvider(gitService);
  const commitsProvider = new CommitsTreeProvider(gitService);
  const stashesProvider = new StashesTreeProvider(gitService);
  const pullRequestsProvider = new PullRequestsTreeProvider(gitService, authService, githubService);
  const issuesProvider = new IssuesTreeProvider(gitService, authService, githubService);
  const actionsProvider = new ActionsTreeProvider(gitService, authService, githubService);
  const releasesProvider = new ReleasesTreeProvider(gitService, authService, githubService);
  const settingsProvider = new SettingsTreeProvider(authService, githubService);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('gitpilot.views.dashboard', dashboardProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.repositories', repositoriesProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.branches', branchesProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.commits', commitsProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.stashes', stashesProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.pullRequests', pullRequestsProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.issues', issuesProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.actions', actionsProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.releases', releasesProvider),
    vscode.window.registerTreeDataProvider('gitpilot.views.settings', settingsProvider)
  );

  // 3. Register Commands
  const commandDisposables = registerCommands(context, gitService, authService, githubService);
  context.subscriptions.push(...commandDisposables);

  // 4. Setup Auto-Refresh Timer
  function setupAutoRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }

    const config = vscode.workspace.getConfiguration('gitpilot');
    const intervalSeconds = config.get<number>('autoRefreshInterval', 60);

    if (intervalSeconds > 0) {
      refreshTimer = setInterval(() => {
        githubService.clearCache();
        dashboardProvider.refresh();
        pullRequestsProvider.refresh();
        issuesProvider.refresh();
        actionsProvider.refresh();
        releasesProvider.refresh();
        DashboardPanel.currentPanel?.update();
      }, intervalSeconds * 1000);
    }
  }

  setupAutoRefresh();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('gitpilot.autoRefreshInterval')) {
        setupAutoRefresh();
      }
    })
  );

  // 5. Open Dashboard on Startup if configured
  const openOnStartup = vscode.workspace.getConfiguration('gitpilot').get<boolean>('openDashboardOnStartup', false);
  if (openOnStartup) {
    DashboardPanel.createOrShow(context.extensionUri, gitService, authService, githubService);
  }

  console.log('[GitPilot] Extension activated successfully.');
}

export function deactivate(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}
