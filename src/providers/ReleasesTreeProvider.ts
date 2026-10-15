import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitService } from '../git/GitService';
import { GitHubService } from '../github/GitHubService';
import { GitHubRelease } from '../models/types';

export class ReleasesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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
      const item = new vscode.TreeItem('Sign in to view Releases', vscode.TreeItemCollapsibleState.None);
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

    const releases = await this.githubService.getReleases(ghRemote.owner, ghRemote.repo);
    if (releases.length === 0) {
      const item = new vscode.TreeItem('No releases found', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('tag');
      return [item];
    }

    return releases.map((rel) => this.createReleaseItem(rel));
  }

  private createReleaseItem(rel: GitHubRelease): vscode.TreeItem {
    const item = new vscode.TreeItem(rel.name || rel.tagName, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'release';
    item.iconPath = new vscode.ThemeIcon('tag');
    item.description = `${rel.tagName}${rel.isDraft ? ' [Draft]' : ''}${rel.isPrerelease ? ' [Pre-release]' : ''}`;
    item.tooltip = new vscode.MarkdownString(
      `**Release**: ${rel.name} (\`${rel.tagName}\`)\n\n` +
      `**Status**: ${rel.isDraft ? 'Draft' : rel.isPrerelease ? 'Pre-release' : 'Published'}\n\n` +
      `**Assets**: ${rel.assetsCount}\n\n` +
      `---\n\n` +
      `*Click to view release on GitHub*`
    );

    item.command = {
      command: 'vscode.open',
      title: 'Open Release on GitHub',
      arguments: [vscode.Uri.parse(rel.htmlUrl)],
    };

    return item;
  }
}
