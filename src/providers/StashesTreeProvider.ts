import * as vscode from 'vscode';
import { GitService } from '../git/GitService';
import { GitStash } from '../models/types';

export class StashesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

    const stashes = await this.gitService.getStashes();
    if (stashes.length === 0) {
      const item = new vscode.TreeItem('No stashes found', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('archive');
      item.description = 'Working directory clean or unstashed';
      return [item];
    }

    return stashes.map((s) => this.createStashItem(s));
  }

  private createStashItem(stash: GitStash): vscode.TreeItem {
    const item = new vscode.TreeItem(`stash@{${stash.index}}`, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'stash';
    item.iconPath = new vscode.ThemeIcon('archive');
    item.description = stash.message;
    item.tooltip = new vscode.MarkdownString(
      `**Stash**: \`stash@{${stash.index}}\`\n\n` +
      `**Description**: ${stash.message}\n\n` +
      `---\n\n` +
      `*Click to view diff or use inline actions to Apply / Pop / Drop.*`
    );

    // Clicking the stash opens the diff view
    item.command = {
      command: 'gitpilot.viewStashDiff',
      title: 'View Stash Diff',
      arguments: [stash.index],
    };

    return item;
  }
}
