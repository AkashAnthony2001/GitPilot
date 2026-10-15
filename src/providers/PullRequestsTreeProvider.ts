import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitService } from '../git/GitService';
import { GitHubService } from '../github/GitHubService';
import { GitHubPullRequest } from '../models/types';

export class PullRequestsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      const item = new vscode.TreeItem('Sign in to view Pull Requests', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('sign-in');
      item.command = {
        command: 'gitpilot.signIn',
        title: 'Sign In to GitHub',
      };
      return [item];
    }

    const repo = await this.gitService.getActiveRepository();
    const ghRemote = repo?.remotes.find((r) => r.owner && r.repo);
    if (!ghRemote || !ghRemote.owner || !ghRemote.repo) {
      const item = new vscode.TreeItem('No GitHub remote configured', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
      item.description = 'Ensure remote origin points to GitHub';
      return [item];
    }

    const prs = await this.githubService.getPullRequests(ghRemote.owner, ghRemote.repo);
    if (prs.length === 0) {
      const item = new vscode.TreeItem('No open pull requests', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('check');
      return [item];
    }

    return prs.map((pr) => this.createPRItem(pr));
  }

  private createPRItem(pr: GitHubPullRequest): vscode.TreeItem {
    const item = new vscode.TreeItem(`#${pr.number} ${pr.title}`, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'pullRequest';
    item.iconPath = new vscode.ThemeIcon(pr.isDraft ? 'git-pull-request-draft' : 'git-pull-request');
    item.description = `${pr.isDraft ? '[Draft] ' : ''}by @${pr.user.login} (${pr.headRef} → ${pr.baseRef})`;
    item.tooltip = new vscode.MarkdownString(
      `**#${pr.number} ${pr.title}**\n\n` +
      `**Author**: @${pr.user.login}\n\n` +
      `**Branches**: \`${pr.headRef}\` → \`${pr.baseRef}\`\n\n` +
      `**Status**: ${pr.isDraft ? 'Draft' : pr.state}\n\n` +
      `---\n\n` +
      `*Click to open on GitHub*`
    );

    item.command = {
      command: 'gitpilot.openPullRequestOnGitHub',
      title: 'Open Pull Request on GitHub',
      arguments: [pr.htmlUrl],
    };

    return item;
  }
}
