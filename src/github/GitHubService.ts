import { Octokit } from '@octokit/rest';
import * as vscode from 'vscode';
import { AuthService } from '../auth/AuthService';
import {
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubUser,
  GitHubWorkflowRun,
} from '../models/types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class GitHubService implements vscode.Disposable {
  private octokit?: Octokit;
  private currentToken?: string;
  private cache = new Map<string, CacheEntry<unknown>>();
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly authService: AuthService) {
    this.disposables.push(
      this.authService.onDidChangeAuthentication(() => {
        this.octokit = undefined;
        this.currentToken = undefined;
        this.clearCache();
      })
    );
  }

  private async getClient(): Promise<Octokit | undefined> {
    const token = await this.authService.getToken();
    if (!token) {
      this.octokit = undefined;
      this.currentToken = undefined;
      return undefined;
    }

    if (!this.octokit || this.currentToken !== token) {
      this.currentToken = token;
      this.octokit = new Octokit({
        auth: token,
        userAgent: 'VSCode-GitPilot/0.1.0',
      });
    }

    return this.octokit;
  }

  private getCacheTtl(): number {
    const config = vscode.workspace.getConfiguration('gitpilot');
    const ttlSeconds = config.get<number>('cacheTtlSeconds', 180);
    return ttlSeconds * 1000;
  }

  private getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && Date.now() - entry.timestamp < this.getCacheTtl()) {
      return entry.data;
    }
    return undefined;
  }

  private setInCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public async getAuthenticatedUser(): Promise<GitHubUser | undefined> {
    const client = await this.getClient();
    if (!client) {
      return undefined;
    }

    const cacheKey = 'user:authenticated';
    const cached = this.getFromCache<GitHubUser>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data } = await client.users.getAuthenticated();
      const user: GitHubUser = {
        login: data.login,
        name: data.name || undefined,
        avatarUrl: data.avatar_url,
        htmlUrl: data.html_url,
        bio: data.bio || undefined,
        company: data.company || undefined,
        location: data.location || undefined,
      };
      this.setInCache(cacheKey, user);
      return user;
    } catch (err: unknown) {
      console.warn('[GitHubService] Failed to fetch user:', err);
      return undefined;
    }
  }

  public async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubPullRequest[]> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    const cacheKey = `prs:${owner}:${repo}:${state}`;
    const cached = this.getFromCache<GitHubPullRequest[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data } = await client.pulls.list({
        owner,
        repo,
        state,
        per_page: 30,
        sort: 'updated',
        direction: 'desc',
      });

      const prs: GitHubPullRequest[] = data.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed'),
        user: {
          login: pr.user?.login || 'unknown',
          avatarUrl: pr.user?.avatar_url || '',
        },
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        htmlUrl: pr.html_url,
        headRef: pr.head.ref,
        baseRef: pr.base.ref,
        isDraft: !!pr.draft,
        commentsCount: pr.comments || 0,
        labels: (pr.labels || []).map((l) => ({
          name: typeof l === 'string' ? l : l.name || '',
          color: typeof l === 'string' ? 'cccccc' : l.color || 'cccccc',
        })),
        assignees: (pr.assignees || []).map((a) => ({
          login: a.login,
          avatarUrl: a.avatar_url,
        })),
      }));

      this.setInCache(cacheKey, prs);
      return prs;
    } catch (err: unknown) {
      console.warn('[GitHubService] Failed to fetch PRs:', err);
      return [];
    }
  }

  public async getIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubIssue[]> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    const cacheKey = `issues:${owner}:${repo}:${state}`;
    const cached = this.getFromCache<GitHubIssue[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data } = await client.issues.listForRepo({
        owner,
        repo,
        state,
        per_page: 30,
        sort: 'updated',
        direction: 'desc',
      });

      // Filter out pull requests since GitHub Issues API includes PRs
      const issuesOnly = data.filter((item) => !item.pull_request);

      const issues: GitHubIssue[] = issuesOnly.map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state as 'open' | 'closed',
        user: {
          login: issue.user?.login || 'unknown',
          avatarUrl: issue.user?.avatar_url || '',
        },
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        htmlUrl: issue.html_url,
        commentsCount: issue.comments || 0,
        labels: (issue.labels || []).map((l) => ({
          name: typeof l === 'string' ? l : l.name || '',
          color: typeof l === 'string' ? 'cccccc' : l.color || 'cccccc',
        })),
        assignees: (issue.assignees || []).map((a) => ({
          login: a.login,
          avatarUrl: a.avatar_url,
        })),
      }));

      this.setInCache(cacheKey, issues);
      return issues;
    } catch (err: unknown) {
      console.warn('[GitHubService] Failed to fetch issues:', err);
      return [];
    }
  }

  public async getWorkflowRuns(
    owner: string,
    repo: string,
    limit = 20
  ): Promise<GitHubWorkflowRun[]> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    const cacheKey = `actions:${owner}:${repo}:${limit}`;
    const cached = this.getFromCache<GitHubWorkflowRun[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data } = await client.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: limit,
      });

      const runs: GitHubWorkflowRun[] = data.workflow_runs.map((run) => ({
        id: run.id,
        name: run.name || 'Workflow Run',
        workflowId: run.workflow_id,
        status: run.status as GitHubWorkflowRun['status'],
        conclusion: run.conclusion as GitHubWorkflowRun['conclusion'],
        htmlUrl: run.html_url,
        branch: run.head_branch || '',
        event: run.event,
        runNumber: run.run_number,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        actor: {
          login: run.actor?.login || 'unknown',
          avatarUrl: run.actor?.avatar_url || '',
        },
      }));

      this.setInCache(cacheKey, runs);
      return runs;
    } catch (err: unknown) {
      console.warn('[GitHubService] Failed to fetch workflow runs:', err);
      return [];
    }
  }

  public async getReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    const cacheKey = `releases:${owner}:${repo}`;
    const cached = this.getFromCache<GitHubRelease[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data } = await client.repos.listReleases({
        owner,
        repo,
        per_page: 20,
      });

      const releases: GitHubRelease[] = data.map((rel) => ({
        id: rel.id,
        tagName: rel.tag_name,
        name: rel.name || rel.tag_name,
        body: rel.body || undefined,
        isDraft: rel.draft,
        isPrerelease: rel.prerelease,
        publishedAt: rel.published_at || undefined,
        htmlUrl: rel.html_url,
        assetsCount: (rel.assets || []).length,
      }));

      this.setInCache(cacheKey, releases);
      return releases;
    } catch (err: unknown) {
      console.warn('[GitHubService] Failed to fetch releases:', err);
      return [];
    }
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
