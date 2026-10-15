import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import { GitService } from '../git/GitService';
import { GitHubService } from '../github/GitHubService';
import { DashboardPanel } from '../webview/DashboardPanel';

export function registerCommands(
  context: vscode.ExtensionContext,
  gitService: GitService,
  authService: AuthService,
  githubService: GitHubService
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Open Dashboard Cockpit
  disposables.push(
    vscode.commands.registerCommand('gitpilot.openDashboard', () => {
      DashboardPanel.createOrShow(context.extensionUri, gitService, authService, githubService);
    })
  );

  // Authentication
  disposables.push(
    vscode.commands.registerCommand('gitpilot.signIn', async () => {
      await authService.signIn();
      DashboardPanel.currentPanel?.update();
    }),
    vscode.commands.registerCommand('gitpilot.signOut', async () => {
      await authService.signOut();
      DashboardPanel.currentPanel?.update();
    }),
    vscode.commands.registerCommand('gitpilot.setPersonalAccessToken', async () => {
      await authService.promptForPersonalAccessToken();
      DashboardPanel.currentPanel?.update();
    })
  );

  // Refresh
  disposables.push(
    vscode.commands.registerCommand('gitpilot.refresh', async () => {
      githubService.clearCache();
      vscode.commands.executeCommand('git.refresh').then(undefined, () => {});
      DashboardPanel.currentPanel?.update();
      vscode.window.showInformationMessage('GitPilot: Refreshed all repository and GitHub data.');
    })
  );

  // Repositories
  disposables.push(
    vscode.commands.registerCommand('gitpilot.switchRepository', async (repoId?: string) => {
      if (repoId) {
        gitService.setActiveRepositoryId(repoId);
        return;
      }
      const repos = await gitService.getRepositories();
      if (repos.length === 0) {
        vscode.window.showInformationMessage('No Git repositories found in workspace.');
        return;
      }
      const items = repos.map((r) => ({
        label: r.name,
        description: `[${r.currentBranch || 'detached'}]`,
        detail: r.id,
        id: r.id,
      }));
      const chosen = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a repository to switch to in GitPilot',
      });
      if (chosen) {
        gitService.setActiveRepositoryId(chosen.id);
      }
    })
  );

  // Branches
  disposables.push(
    vscode.commands.registerCommand('gitpilot.switchBranch', async (branchName?: string) => {
      if (branchName) {
        await gitService.switchBranch(branchName);
        vscode.window.showInformationMessage(`Switched to branch '${branchName}'.`);
        return;
      }
      const branches = await gitService.getBranches();
      const items = branches
        .filter((b) => !b.isCurrent)
        .map((b) => ({
          label: b.name,
          description: b.isRemote ? 'Remote' : 'Local',
        }));
      const chosen = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a branch to checkout',
      });
      if (chosen) {
        await gitService.switchBranch(chosen.label);
        vscode.window.showInformationMessage(`Switched to branch '${chosen.label}'.`);
      }
    }),
    vscode.commands.registerCommand('gitpilot.createBranch', async () => {
      const name = await vscode.window.showInputBox({
        title: 'GitPilot: Create New Branch',
        prompt: 'Enter the new branch name',
        placeHolder: 'feature/my-new-feature',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Branch name cannot be empty.';
          }
          if (/\s/.test(value)) {
            return 'Branch names cannot contain whitespace.';
          }
          return null;
        },
      });
      if (name) {
        await gitService.createBranch(name.trim());
        vscode.window.showInformationMessage(`Created and switched to branch '${name.trim()}'.`);
      }
    })
  );

  // Commits
  disposables.push(
    vscode.commands.registerCommand('gitpilot.createCommit', async () => {
      const message = await vscode.window.showInputBox({
        title: 'GitPilot: Create Commit',
        prompt: 'Enter commit message for staged changes',
        placeHolder: 'feat: implement gitpilot cockpit',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Commit message cannot be empty.';
          }
          return null;
        },
      });
      if (message) {
        try {
          await gitService.createCommit(message);
          vscode.window.showInformationMessage(`Committed: ${message}`);
        } catch (err: unknown) {
          const error = err as Error;
          vscode.window.showErrorMessage(`Commit failed: ${error.message}`);
        }
      }
    })
  );

  // Stashes
  disposables.push(
    vscode.commands.registerCommand('gitpilot.createStash', async () => {
      const message = await vscode.window.showInputBox({
        title: 'GitPilot: Create Stash',
        prompt: 'Optional stash description',
        placeHolder: 'WIP: working on new feature',
      });
      if (message !== undefined) {
        await gitService.createStash(message);
        vscode.window.showInformationMessage('Stash created successfully.');
      }
    }),
    vscode.commands.registerCommand('gitpilot.applyStash', async (indexOrItem?: number | vscode.TreeItem) => {
      const index = typeof indexOrItem === 'number' ? indexOrItem : 0;
      await gitService.applyStash(index);
      vscode.window.showInformationMessage(`Applied stash@{${index}}.`);
    }),
    vscode.commands.registerCommand('gitpilot.popStash', async (indexOrItem?: number | vscode.TreeItem) => {
      const index = typeof indexOrItem === 'number' ? indexOrItem : 0;
      await gitService.popStash(index);
      vscode.window.showInformationMessage(`Popped stash@{${index}}.`);
    }),
    vscode.commands.registerCommand('gitpilot.dropStash', async (indexOrItem?: number | vscode.TreeItem) => {
      const index = typeof indexOrItem === 'number' ? indexOrItem : 0;
      const config = vscode.workspace.getConfiguration('gitpilot');
      if (config.get<boolean>('confirmDestructiveActions', true)) {
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to drop stash@{${index}}? This action cannot be undone.`,
          { modal: true },
          'Drop Stash'
        );
        if (confirm !== 'Drop Stash') {
          return;
        }
      }
      await gitService.dropStash(index);
      vscode.window.showInformationMessage(`Dropped stash@{${index}}.`);
    }),
    vscode.commands.registerCommand('gitpilot.viewStashDiff', async (indexOrItem?: number | vscode.TreeItem) => {
      const index = typeof indexOrItem === 'number' ? indexOrItem : 0;
      const diff = await gitService.getStashDiff(index);
      const doc = await vscode.workspace.openTextDocument({
        content: diff || '(Stash contains no diff or is empty)',
        language: 'diff',
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    })
  );

  // GitHub Actions & Navigation
  disposables.push(
    vscode.commands.registerCommand('gitpilot.openOnGitHub', async () => {
      const repo = await gitService.getActiveRepository();
      const ghRemote = repo?.remotes.find((r) => r.owner && r.repo);
      if (ghRemote?.owner && ghRemote.repo) {
        const url = `https://github.com/${ghRemote.owner}/${ghRemote.repo}`;
        vscode.env.openExternal(vscode.Uri.parse(url));
      } else {
        vscode.window.showWarningMessage('No GitHub remote URL found on active repository.');
      }
    }),
    vscode.commands.registerCommand('gitpilot.createPullRequest', async () => {
      const repo = await gitService.getActiveRepository();
      const ghRemote = repo?.remotes.find((r) => r.owner && r.repo);
      if (ghRemote?.owner && ghRemote.repo) {
        const branch = repo?.currentBranch || 'main';
        const url = `https://github.com/${ghRemote.owner}/${ghRemote.repo}/compare/${branch}?expand=1`;
        vscode.env.openExternal(vscode.Uri.parse(url));
      } else {
        vscode.window.showWarningMessage('No GitHub remote found to open pull request.');
      }
    }),
    vscode.commands.registerCommand('gitpilot.viewPullRequests', () => {
      vscode.commands.executeCommand('gitpilot.views.pullRequests.focus');
    }),
    vscode.commands.registerCommand('gitpilot.viewIssues', () => {
      vscode.commands.executeCommand('gitpilot.views.issues.focus');
    }),
    vscode.commands.registerCommand('gitpilot.viewWorkflowRuns', () => {
      vscode.commands.executeCommand('gitpilot.views.actions.focus');
    }),
    vscode.commands.registerCommand('gitpilot.openPullRequestOnGitHub', (url?: string) => {
      if (url) vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    vscode.commands.registerCommand('gitpilot.openIssueOnGitHub', (url?: string) => {
      if (url) vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    vscode.commands.registerCommand('gitpilot.openWorkflowRunOnGitHub', (url?: string) => {
      if (url) vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  return disposables;
}
