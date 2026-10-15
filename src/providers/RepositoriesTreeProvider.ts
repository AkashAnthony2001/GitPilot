import * as vscode from 'vscode';
import { GitService } from '../git/GitService';
import { GitRepositoryInfo } from '../models/types';

export class RepositoriesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

    const repos = await this.gitService.getRepositories();
    const activeId = this.gitService.getActiveRepositoryId();

    if (repos.length === 0) {
      const item = new vscode.TreeItem('No repositories in workspace', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
      return [item];
    }

    return repos.map((repo) => this.createRepoItem(repo, repo.id === activeId));
  }

  private createRepoItem(repo: GitRepositoryInfo, isActive: boolean): vscode.TreeItem {
    const item = new vscode.TreeItem(repo.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'repository';
    item.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'repo');
    item.description = `${isActive ? '(active) ' : ''}[${repo.currentBranch || 'detached'}]`;
    item.tooltip = `Path: ${repo.id}\nBranch: ${repo.currentBranch}\nStatus: ${repo.isClean ? 'Clean' : 'Modified'}`;
    item.command = {
      command: 'gitpilot.switchRepository',
      title: 'Switch Active Repository',
      arguments: [repo.id],
    };
    return item;
  }
}
