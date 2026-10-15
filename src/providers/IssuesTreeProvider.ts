import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitService } from '../git/GitService';
import { GitHubService } from '../github/GitHubService';
import { GitHubIssue } from '../models/types';

export class IssuesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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
      const item = new vscode.TreeItem('Sign in to view Issues', vscode.TreeItemCollapsibleState.None);
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
      return [item];
    }

    const issues = await this.githubService.getIssues(ghRemote.owner, ghRemote.repo);
    if (issues.length === 0) {
      const item = new vscode.TreeItem('No open issues', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('check');
      return [item];
    }

    return issues.map((issue) => this.createIssueItem(issue));
  }

  private createIssueItem(issue: GitHubIssue): vscode.TreeItem {
    const item = new vscode.TreeItem(`#${issue.number} ${issue.title}`, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'issue';
    item.iconPath = new vscode.ThemeIcon('issues');
    item.description = `by @${issue.user.login} (${issue.commentsCount} comments)`;
    item.tooltip = new vscode.MarkdownString(
      `**#${issue.number} ${issue.title}**\n\n` +
      `**Author**: @${issue.user.login}\n\n` +
      `**Comments**: ${issue.commentsCount}\n\n` +
      (issue.labels.length > 0 ? `**Labels**: ${issue.labels.map((l) => l.name).join(', ')}\n\n` : '') +
      `---\n\n` +
      `*Click to open on GitHub*`
    );

    item.command = {
      command: 'gitpilot.openIssueOnGitHub',
      title: 'Open Issue on GitHub',
      arguments: [issue.htmlUrl],
    };

    return item;
  }
}
