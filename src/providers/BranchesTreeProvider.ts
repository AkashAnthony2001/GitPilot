import * as vscode from 'vscode';
import { GitService } from '../git/GitService';
import { GitBranch } from '../models/types';

export class BranchesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

    const branches = await this.gitService.getBranches();
    if (branches.length === 0) {
      const item = new vscode.TreeItem('No branches found', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
      return [item];
    }

    // Sort: current branch first, then local branches, then remotes
    const sorted = [...branches].sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      if (a.isRemote && !b.isRemote) return 1;
      if (!a.isRemote && b.isRemote) return -1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((b) => this.createBranchItem(b));
  }

  private createBranchItem(branch: GitBranch): vscode.TreeItem {
    const item = new vscode.TreeItem(branch.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'branch';

    if (branch.isCurrent) {
      item.iconPath = new vscode.ThemeIcon('check');
      item.description = '(current)';
    } else if (branch.isRemote) {
      item.iconPath = new vscode.ThemeIcon('cloud');
    } else {
      item.iconPath = new vscode.ThemeIcon('git-branch');
    }

    if (branch.upstream) {
      const syncInfo: string[] = [];
      if (branch.ahead && branch.ahead > 0) syncInfo.push(`↑${branch.ahead}`);
      if (branch.behind && branch.behind > 0) syncInfo.push(`↓${branch.behind}`);
      const tracking = syncInfo.length > 0 ? ` [${syncInfo.join(' ')}]` : '';
      item.tooltip = `Branch: ${branch.name}\nUpstream: ${branch.upstream}${tracking}`;
      if (!branch.isCurrent && tracking) {
        item.description = tracking;
      }
    }

    item.command = {
      command: 'gitpilot.switchBranch',
      title: 'Switch Branch',
      arguments: [branch.name],
    };

    return item;
  }
}
