import * as vscode from 'vscode';
import {
  GitBranch,
  GitCommit,
  GitFileStatus,
  GitRemote,
  GitRepositoryInfo,
  GitStash,
  WorkingTreeStatus,
} from '../models/types';
import {
  enrichRemotesWithGitHubInfo,
  execGit,
  GIT_LOG_FORMAT,
  parseGitLog,
  parseGitStashList,
} from './gitUtils';

// VS Code Git Extension API subset
interface VSCodeGitAPI {
  repositories: VSCodeRepository[];
  onDidOpenRepository: vscode.Event<VSCodeRepository>;
  onDidCloseRepository: vscode.Event<VSCodeRepository>;
}

interface VSCodeRepository {
  rootUri: vscode.Uri;
  state: {
    HEAD?: {
      name?: string;
      commit?: string;
      upstream?: { name: string; remote: string };
      ahead?: number;
      behind?: number;
    };
    remotes: { name: string; fetchUrl?: string; pushUrl?: string }[];
    workingTreeChanges: { uri: vscode.Uri; status: number }[];
    indexChanges: { uri: vscode.Uri; status: number }[];
    onDidChange: vscode.Event<void>;
  };
  checkout(treeish: string): Promise<void>;
  createBranch(name: string, checkout: boolean): Promise<void>;
}

export class GitService implements vscode.Disposable {
  private gitApi?: VSCodeGitAPI;
  private activeRepoId?: string;
  private disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeState = new vscode.EventEmitter<void>();
  public readonly onDidChangeState = this._onDidChangeState.event;

  constructor() {
    this.initGitApi();
  }

  private async initGitApi(): Promise<void> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (gitExtension) {
        if (!gitExtension.isActive) {
          await gitExtension.activate();
        }
        const exports = gitExtension.exports;
        if (exports && typeof exports.getAPI === 'function') {
          this.gitApi = exports.getAPI(1);
          if (this.gitApi) {
            this.disposables.push(
              this.gitApi.onDidOpenRepository(() => this.handleRepoChange()),
              this.gitApi.onDidCloseRepository(() => this.handleRepoChange())
            );

            for (const repo of this.gitApi.repositories) {
              this.disposables.push(
                repo.state.onDidChange(() => this._onDidChangeState.fire())
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn('[GitService] Error activating vscode.git:', err);
    }
  }

  private handleRepoChange(): void {
    if (this.gitApi) {
      for (const repo of this.gitApi.repositories) {
        this.disposables.push(
          repo.state.onDidChange(() => this._onDidChangeState.fire())
        );
      }
    }
    this._onDidChangeState.fire();
  }

  public async getRepositories(): Promise<GitRepositoryInfo[]> {
    const repos: GitRepositoryInfo[] = [];

    // 1. Try VS Code Git API
    if (this.gitApi && this.gitApi.repositories.length > 0) {
      for (const repo of this.gitApi.repositories) {
        const rootPath = repo.rootUri.fsPath;
        const name = vscode.workspace.asRelativePath(repo.rootUri, false) || repo.rootUri.path.split('/').pop() || 'Repository';
        const remotes: GitRemote[] = enrichRemotesWithGitHubInfo(
          repo.state.remotes.map((r) => ({
            name: r.name,
            fetchUrl: r.fetchUrl,
            pushUrl: r.pushUrl,
          }))
        );

        const currentBranch = repo.state.HEAD?.name;
        const ahead = repo.state.HEAD?.ahead ?? 0;
        const behind = repo.state.HEAD?.behind ?? 0;

        const workingTree = await this.getWorkingTreeStatus(rootPath);

        repos.push({
          id: rootPath,
          name,
          rootUri: repo.rootUri.toString(),
          currentBranch,
          isClean: workingTree.totalChanged === 0,
          remotes,
          aheadBehind: { ahead, behind },
          workingTree,
        });
      }
    } else {
      // 2. Fallback to scanning workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders || [];
      for (const folder of workspaceFolders) {
        try {
          const isRepo = await execGit(['rev-parse', '--is-inside-work-tree'], folder.uri.fsPath);
          if (isRepo.trim() === 'true') {
            const rootPath = folder.uri.fsPath;
            const branchOut = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], rootPath).catch(() => 'main');
            const remotesOut = await execGit(['remote', '-v'], rootPath).catch(() => '');
            const parsedRemotes = this.parseCliRemotes(remotesOut);
            const workingTree = await this.getWorkingTreeStatus(rootPath);

            repos.push({
              id: rootPath,
              name: folder.name,
              rootUri: folder.uri.toString(),
              currentBranch: branchOut.trim(),
              isClean: workingTree.totalChanged === 0,
              remotes: enrichRemotesWithGitHubInfo(parsedRemotes),
              workingTree,
            });
          }
        } catch {
          // Folder is not a git repo
        }
      }
    }

    if (repos.length > 0 && !this.activeRepoId) {
      this.activeRepoId = repos[0].id;
    }

    return repos;
  }

  private parseCliRemotes(output: string): GitRemote[] {
    const remotesMap = new Map<string, GitRemote>();
    const lines = output.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (match) {
        const [, name, url, type] = match;
        const existing = remotesMap.get(name) || { name };
        if (type === 'fetch') {
          existing.fetchUrl = url;
        } else {
          existing.pushUrl = url;
        }
        remotesMap.set(name, existing);
      }
    }

    return Array.from(remotesMap.values());
  }

  public getActiveRepositoryId(): string | undefined {
    return this.activeRepoId;
  }

  public setActiveRepositoryId(id: string): void {
    this.activeRepoId = id;
    this._onDidChangeState.fire();
  }

  public async getActiveRepository(): Promise<GitRepositoryInfo | undefined> {
    const repos = await this.getRepositories();
    if (repos.length === 0) {
      return undefined;
    }
    if (this.activeRepoId) {
      const found = repos.find((r) => r.id === this.activeRepoId);
      if (found) {
        return found;
      }
    }
    this.activeRepoId = repos[0].id;
    return repos[0];
  }

  public async getWorkingTreeStatus(cwd?: string): Promise<WorkingTreeStatus> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      return { staged: [], unstaged: [], untracked: [], totalChanged: 0 };
    }

    try {
      const statusOutput = await execGit(['status', '--porcelain=v1', '-uall'], targetCwd);
      const lines = statusOutput.split('\n').filter((l) => l.length >= 3);

      const staged: GitFileStatus[] = [];
      const unstaged: GitFileStatus[] = [];
      const untracked: GitFileStatus[] = [];

      for (const line of lines) {
        const x = line[0];
        const y = line[1];
        const filePath = line.substring(3).trim();

        if (x === '?' && y === '?') {
          untracked.push({ path: filePath, status: 'untracked', staged: false });
          continue;
        }

        // Staged status
        if (x !== ' ' && x !== '?') {
          staged.push({
            path: filePath,
            status: this.mapStatusChar(x),
            staged: true,
          });
        }

        // Unstaged status
        if (y !== ' ' && y !== '?') {
          unstaged.push({
            path: filePath,
            status: this.mapStatusChar(y),
            staged: false,
          });
        }
      }

      return {
        staged,
        unstaged,
        untracked,
        totalChanged: staged.length + unstaged.length + untracked.length,
      };
    } catch {
      return { staged: [], unstaged: [], untracked: [], totalChanged: 0 };
    }
  }

  private mapStatusChar(char: string): GitFileStatus['status'] {
    switch (char) {
      case 'M':
        return 'modified';
      case 'A':
        return 'added';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      case 'C':
        return 'copied';
      default:
        return 'modified';
    }
  }

  public async getBranches(cwd?: string): Promise<GitBranch[]> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      return [];
    }

    try {
      const output = await execGit(['branch', '-a', '--format=%(HEAD)|%(refname:short)|%(upstream:short)|%(upstream:track)'], targetCwd);
      const lines = output.split('\n').filter((l) => l.trim().length > 0);
      const branches: GitBranch[] = [];

      for (const line of lines) {
        const [isHeadStr, refname, upstream, track] = line.split('|');
        const isCurrent = isHeadStr.trim() === '*';
        const isRemote = refname.startsWith('origin/') || refname.includes('/');

        let ahead = 0;
        let behind = 0;
        if (track) {
          const aheadMatch = track.match(/ahead (\d+)/);
          const behindMatch = track.match(/behind (\d+)/);
          if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
          if (behindMatch) behind = parseInt(behindMatch[1], 10);
        }

        branches.push({
          name: refname,
          isCurrent,
          isRemote,
          upstream: upstream || undefined,
          ahead,
          behind,
        });
      }

      return branches;
    } catch {
      return [];
    }
  }

  public async getCommits(limit = 30, cwd?: string): Promise<GitCommit[]> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      return [];
    }

    try {
      const output = await execGit(['log', `-n${limit}`, `--format=${GIT_LOG_FORMAT}`], targetCwd);
      return parseGitLog(output);
    } catch {
      return [];
    }
  }

  public async getStashes(cwd?: string): Promise<GitStash[]> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      return [];
    }

    try {
      const output = await execGit(['stash', 'list'], targetCwd);
      return parseGitStashList(output);
    } catch {
      return [];
    }
  }

  public async getStashDiff(index: number, cwd?: string): Promise<string> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    return execGit(['stash', 'show', '-p', `stash@{${index}}`], targetCwd);
  }

  public async applyStash(index: number, cwd?: string): Promise<void> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    await execGit(['stash', 'apply', `stash@{${index}}`], targetCwd);
    this._onDidChangeState.fire();
  }

  public async popStash(index: number, cwd?: string): Promise<void> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    await execGit(['stash', 'pop', `stash@{${index}}`], targetCwd);
    this._onDidChangeState.fire();
  }

  public async dropStash(index: number, cwd?: string): Promise<void> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    await execGit(['stash', 'drop', `stash@{${index}}`], targetCwd);
    this._onDidChangeState.fire();
  }

  public async createStash(message?: string, cwd?: string): Promise<void> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    const args = ['stash', 'push'];
    if (message && message.trim().length > 0) {
      args.push('-m', message.trim());
    }
    await execGit(args, targetCwd);
    this._onDidChangeState.fire();
  }

  public async switchBranch(branchName: string, cwd?: string): Promise<void> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    await execGit(['checkout', branchName], targetCwd);
    this._onDidChangeState.fire();
  }

  public async createBranch(branchName: string, cwd?: string): Promise<void> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    await execGit(['checkout', '-b', branchName], targetCwd);
    this._onDidChangeState.fire();
  }

  public async createCommit(message: string, cwd?: string): Promise<void> {
    const targetCwd = cwd || this.activeRepoId;
    if (!targetCwd) {
      throw new Error('No active repository selected.');
    }
    if (!message || message.trim().length === 0) {
      throw new Error('Commit message cannot be empty.');
    }
    await execGit(['commit', '-m', message.trim()], targetCwd);
    this._onDidChangeState.fire();
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeState.dispose();
  }
}
