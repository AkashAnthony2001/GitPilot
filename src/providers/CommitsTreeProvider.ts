import * as vscode from 'vscode';
import { GitService } from '../git/GitService';
import { GitCommit } from '../models/types';

export class CommitsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly gitService: GitService) {
    this.gitService.onDidChangeState(() => this.refresh());
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

    const commits = await this.gitService.getCommits(40);
    if (commits.length === 0) {
      const item = new vscode.TreeItem('No commit history found', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
      return [item];
    }

    return commits.map((c) => this.createCommitItem(c));
  }

  private createCommitItem(commit: GitCommit): vscode.TreeItem {
    const item = new vscode.TreeItem(commit.subject, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'commit';
    item.iconPath = new vscode.ThemeIcon('git-commit');
    item.description = `${commit.shortHash} • ${commit.relativeDate}`;
    item.tooltip = new vscode.MarkdownString(
      `**Commit**: \`${commit.hash}\`\n\n` +
      `**Author**: ${commit.authorName} <${commit.authorEmail}>\n\n` +
      `**Date**: ${commit.authorDate}\n\n` +
      `---\n\n` +
      `${commit.subject}\n\n` +
      (commit.body ? `${commit.body}` : '')
    );

    return item;
  }
}
