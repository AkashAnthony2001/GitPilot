import * as vscode from 'vscode';

const SECRET_KEY_PAT = 'gitpilot.github.pat';
const AUTH_PROVIDER_ID = 'github';
const SCOPES = ['repo', 'workflow', 'read:user', 'user:email'];

export class AuthService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeAuthentication = new vscode.EventEmitter<void>();
  public readonly onDidChangeAuthentication = this._onDidChangeAuthentication.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.authentication.onDidChangeSessions((e) => {
        if (e.provider.id === AUTH_PROVIDER_ID) {
          this._onDidChangeAuthentication.fire();
        }
      })
    );
  }

  public async getToken(): Promise<string | undefined> {
    // 1. Try VS Code GitHub Authentication Session first
    try {
      const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, {
        createIfNone: false,
      });
      if (session) {
        return session.accessToken;
      }
    } catch {
      // Session lookup failed or user not signed in yet
    }

    // 2. Try SecretStorage for manually entered Personal Access Token
    try {
      const pat = await this.context.secrets.get(SECRET_KEY_PAT);
      if (pat && pat.trim().length > 0) {
        return pat.trim();
      }
    } catch {
      // SecretStorage retrieval failed
    }

    return undefined;
  }

  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  public async signIn(): Promise<boolean> {
    try {
      const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, {
        createIfNone: true,
      });
      if (session) {
        vscode.window.showInformationMessage(`GitPilot: Signed in to GitHub as ${session.account.label}.`);
        this._onDidChangeAuthentication.fire();
        return true;
      }
    } catch (err: unknown) {
      const error = err as Error;
      const setPatOption = 'Set Personal Access Token';
      const action = await vscode.window.showErrorMessage(
        `GitPilot: Sign in failed: ${error.message || 'Unknown error'}. Would you like to use a Personal Access Token instead?`,
        setPatOption
      );
      if (action === setPatOption) {
        return await this.promptForPersonalAccessToken();
      }
    }
    return false;
  }

  public async promptForPersonalAccessToken(): Promise<boolean> {
    const pat = await vscode.window.showInputBox({
      title: 'GitPilot: GitHub Personal Access Token',
      prompt: 'Enter a Classic or Fine-Grained GitHub token with repo, workflow, and read:user scopes.',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Token cannot be empty.';
        }
        if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
          return 'Token should typically start with ghp_ or github_pat_.';
        }
        return null;
      },
    });

    if (pat && pat.trim().length > 0) {
      await this.context.secrets.store(SECRET_KEY_PAT, pat.trim());
      vscode.window.showInformationMessage('GitPilot: Personal Access Token saved securely in SecretStorage.');
      this._onDidChangeAuthentication.fire();
      return true;
    }
    return false;
  }

  public async signOut(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY_PAT);
    vscode.window.showInformationMessage('GitPilot: Signed out. Personal Access Token cleared.');
    this._onDidChangeAuthentication.fire();
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeAuthentication.dispose();
  }
}
