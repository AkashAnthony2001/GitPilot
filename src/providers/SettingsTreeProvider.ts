import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitHubService } from '../github/GitHubService';

export class SettingsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly authService: AuthService,
    private readonly githubService: GitHubService
  ) {
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

    const isAuth = await this.authService.isAuthenticated();
    if (isAuth) {
      const user = await this.githubService.getAuthenticatedUser();
      const userItem = new vscode.TreeItem(
        `Account: ${user ? `@${user.login}` : 'Signed In'}`,
        vscode.TreeItemCollapsibleState.None
      );
      userItem.iconPath = new vscode.ThemeIcon('account');
      userItem.description = user?.name ? `(${user.name})` : '';
      items.push(userItem);

      const signOutItem = new vscode.TreeItem('Sign Out from GitHub', vscode.TreeItemCollapsibleState.None);
      signOutItem.iconPath = new vscode.ThemeIcon('sign-out');
      signOutItem.command = {
        command: 'gitpilot.signOut',
        title: 'Sign Out from GitHub',
      };
      items.push(signOutItem);
    } else {
      const signInItem = new vscode.TreeItem('Sign In with GitHub', vscode.TreeItemCollapsibleState.None);
      signInItem.iconPath = new vscode.ThemeIcon('sign-in');
      signInItem.command = {
        command: 'gitpilot.signIn',
        title: 'Sign In to GitHub',
      };
      items.push(signInItem);

      const patItem = new vscode.TreeItem('Set Personal Access Token', vscode.TreeItemCollapsibleState.None);
      patItem.iconPath = new vscode.ThemeIcon('key');
      patItem.command = {
        command: 'gitpilot.setPersonalAccessToken',
        title: 'Set Personal Access Token',
      };
      items.push(patItem);
    }

    // Extension Settings
    const settingsItem = new vscode.TreeItem('Configure GitPilot Settings', vscode.TreeItemCollapsibleState.None);
    settingsItem.iconPath = new vscode.ThemeIcon('gear');
    settingsItem.command = {
      command: 'workbench.action.openSettings',
      title: 'Open Settings',
      arguments: ['gitpilot'],
    };
    items.push(settingsItem);

    // Refresh
    const refreshItem = new vscode.TreeItem('Refresh GitPilot Data', vscode.TreeItemCollapsibleState.None);
    refreshItem.iconPath = new vscode.ThemeIcon('refresh');
    refreshItem.command = {
      command: 'gitpilot.refresh',
      title: 'Refresh All',
    };
    items.push(refreshItem);

    return items;
  }
}
