import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitService } from '../git/GitService';
import { GitHubService } from '../github/GitHubService';
import { GitHubWorkflowRun } from '../models/types';

export class ActionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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
      const item = new vscode.TreeItem('Sign in to view GitHub Actions', vscode.TreeItemCollapsibleState.None);
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

    const runs = await this.githubService.getWorkflowRuns(ghRemote.owner, ghRemote.repo, 20);
    if (runs.length === 0) {
      const item = new vscode.TreeItem('No workflow runs found', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('play-circle');
      return [item];
    }

    return runs.map((run) => this.createRunItem(run));
  }

  private createRunItem(run: GitHubWorkflowRun): vscode.TreeItem {
    const item = new vscode.TreeItem(`${run.name} #${run.runNumber}`, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'workflowRun';

    let icon = 'circle-outline';
    if (run.status === 'in_progress' || run.status === 'queued') {
      icon = 'sync~spin';
    } else if (run.conclusion === 'success') {
      icon = 'pass';
    } else if (run.conclusion === 'failure') {
      icon = 'error';
    } else if (run.conclusion === 'cancelled') {
      icon = 'circle-slash';
    }

    item.iconPath = new vscode.ThemeIcon(icon);
    item.description = `${run.branch} • ${run.event} (${run.conclusion || run.status})`;
    item.tooltip = new vscode.MarkdownString(
      `**Workflow**: ${run.name} (Run #${run.runNumber})\n\n` +
      `**Branch**: \`${run.branch}\`\n\n` +
      `**Trigger**: ${run.event} by @${run.actor.login}\n\n` +
      `**Status**: ${run.status} | **Conclusion**: ${run.conclusion || 'pending'}\n\n` +
      `---\n\n` +
      `*Click to view run on GitHub*`
    );

    item.command = {
      command: 'gitpilot.openWorkflowRunOnGitHub',
      title: 'Open Workflow Run on GitHub',
      arguments: [run.htmlUrl],
    };

    return item;
  }
}
