import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitService } from '../git/GitService';
import { GitHubService } from '../github/GitHubService';

export class DashboardTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly gitService: GitService,
    private readonly authService: AuthService,
    private readonly githubService: GitHubService
  ) {
    this.gitService.onDidChangeState(() => this.refresh());
    this.authService.onDidChangeAuthentication(() => this.refresh());
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }

    const items: vscode.TreeItem[] = [];

    // 1. Open Dashboard Action
    const openDashItem = new vscode.TreeItem('Open GitPilot Cockpit', vscode.TreeItemCollapsibleState.None);
    openDashItem.iconPath = new vscode.ThemeIcon('dashboard');
    openDashItem.command = {
      command: 'gitpilot.openDashboard',
      title: 'Open GitPilot Cockpit',
    };
    openDashItem.description = 'Full-screen cockpit';
    items.push(openDashItem);

    // 2. Repository & Branch state
    const repo = await this.gitService.getActiveRepository();
    if (repo) {
      const repoItem = new vscode.TreeItem(`Repository: ${repo.name}`, vscode.TreeItemCollapsibleState.None);
      repoItem.iconPath = new vscode.ThemeIcon('repo');
      repoItem.description = repo.currentBranch ? `[${repo.currentBranch}]` : '';
      repoItem.tooltip = `Path: ${repo.rootUri}\nBranch: ${repo.currentBranch || 'unknown'}`;
      items.push(repoItem);

      // Status
      const changesItem = new vscode.TreeItem(
        repo.isClean ? 'Working Tree: Clean' : `Changes: ${repo.workingTree.totalChanged} file(s)`,
        vscode.TreeItemCollapsibleState.None
      );
      changesItem.iconPath = new vscode.ThemeIcon(repo.isClean ? 'check' : 'diff-modified');
      changesItem.description = `Staged: ${repo.workingTree.staged.length} | Unstaged: ${repo.workingTree.unstaged.length}`;
      items.push(changesItem);

      // Ahead / Behind
      if (repo.aheadBehind) {
        const syncItem = new vscode.TreeItem(
          `Sync: ↑ ${repo.aheadBehind.ahead} ahead, ↓ ${repo.aheadBehind.behind} behind`,
          vscode.TreeItemCollapsibleState.None
        );
        syncItem.iconPath = new vscode.ThemeIcon('sync');
        items.push(syncItem);
      }

      // Stashes
      const stashes = await this.gitService.getStashes();
      const stashItem = new vscode.TreeItem(`Stashes: ${stashes.length}`, vscode.TreeItemCollapsibleState.None);
      stashItem.iconPath = new vscode.ThemeIcon('archive');
      stashItem.description = stashes.length > 0 ? `Latest: ${stashes[0].message}` : 'None';
      items.push(stashItem);

      // GitHub remote & user info
      const ghRemote = repo.remotes.find((r) => r.owner && r.repo);
      if (ghRemote && ghRemote.owner && ghRemote.repo) {
        const isAuth = await this.authService.isAuthenticated();
        if (isAuth) {
          const user = await this.githubService.getAuthenticatedUser();
          const authItem = new vscode.TreeItem(
            `GitHub: ${user ? `@${user.login}` : 'Signed In'}`,
            vscode.TreeItemCollapsibleState.None
          );
          authItem.iconPath = new vscode.ThemeIcon('mark-github');
          authItem.description = `${ghRemote.owner}/${ghRemote.repo}`;
          items.push(authItem);

          const prs = await this.githubService.getPullRequests(ghRemote.owner, ghRemote.repo);
          const prItem = new vscode.TreeItem(`Open PRs: ${prs.length}`, vscode.TreeItemCollapsibleState.None);
          prItem.iconPath = new vscode.ThemeIcon('git-pull-request');
          prItem.command = {
            command: 'gitpilot.viewPullRequests',
            title: 'View Pull Requests',
          };
          items.push(prItem);

          const issues = await this.githubService.getIssues(ghRemote.owner, ghRemote.repo);
          const issueItem = new vscode.TreeItem(`Open Issues: ${issues.length}`, vscode.TreeItemCollapsibleState.None);
          issueItem.iconPath = new vscode.ThemeIcon('issues');
          issueItem.command = {
            command: 'gitpilot.viewIssues',
            title: 'View Issues',
          };
          items.push(issueItem);
        } else {
          const signInItem = new vscode.TreeItem('Sign In to GitHub for PRs & Issues', vscode.TreeItemCollapsibleState.None);
          signInItem.iconPath = new vscode.ThemeIcon('sign-in');
          signInItem.command = {
            command: 'gitpilot.signIn',
            title: 'Sign In to GitHub',
          };
          items.push(signInItem);
        }
      }
    } else {
      const noRepoItem = new vscode.TreeItem('No Git repository detected', vscode.TreeItemCollapsibleState.None);
      noRepoItem.iconPath = new vscode.ThemeIcon('info');
      noRepoItem.description = 'Open a Git folder';
      items.push(noRepoItem);
    }

    return items;
  }
}
