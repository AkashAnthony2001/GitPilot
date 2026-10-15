export interface GitRepositoryInfo {
  id: string;
  name: string;
  rootUri: string;
  currentBranch?: string;
  isClean: boolean;
  remotes: GitRemote[];
  headCommit?: GitCommit;
  aheadBehind?: { ahead: number; behind: number };
  workingTree: WorkingTreeStatus;
}

export interface GitRemote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
  owner?: string;
  repo?: string;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  subject: string;
  body?: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  relativeDate: string;
  parents?: string[];
  filesChanged?: number;
}

export interface GitStash {
  index: number;
  message: string;
  hash: string;
  date: string;
  fileCount?: number;
  files?: string[];
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'copied';
  staged: boolean;
}

export interface WorkingTreeStatus {
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
  totalChanged: number;
}

export interface GitHubUser {
  login: string;
  name?: string;
  avatarUrl: string;
  htmlUrl: string;
  bio?: string;
  company?: string;
  location?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  user: {
    login: string;
    avatarUrl: string;
  };
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  headRef: string;
  baseRef: string;
  isDraft: boolean;
  commentsCount: number;
  labels: { name: string; color: string }[];
  assignees: { login: string; avatarUrl: string }[];
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: {
    login: string;
    avatarUrl: string;
  };
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  commentsCount: number;
  labels: { name: string; color: string }[];
  assignees: { login: string; avatarUrl: string }[];
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  workflowId: number;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | 'skipped' | 'neutral' | null;
  htmlUrl: string;
  branch: string;
  event: string;
  runNumber: number;
  createdAt: string;
  updatedAt: string;
  actor: {
    login: string;
    avatarUrl: string;
  };
}

export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string;
  body?: string;
  isDraft: boolean;
  isPrerelease: boolean;
  publishedAt?: string;
  htmlUrl: string;
  assetsCount: number;
}

export interface DashboardState {
  repository?: GitRepositoryInfo;
  repositories: GitRepositoryInfo[];
  branches: GitBranch[];
  commits: GitCommit[];
  stashes: GitStash[];
  githubUser?: GitHubUser;
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  workflowRuns: GitHubWorkflowRun[];
  releases: GitHubRelease[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string;
  lastRefreshedAt: string;
}

export type ToWebviewMessage =
  | { type: 'STATE_UPDATE'; payload: DashboardState }
  | { type: 'ACTION_SUCCESS'; message: string }
  | { type: 'ACTION_ERROR'; message: string };

export type FromWebviewMessage =
  | { type: 'REFRESH' }
  | { type: 'SWITCH_REPOSITORY'; repositoryId: string }
  | { type: 'SWITCH_BRANCH'; branchName: string }
  | { type: 'CREATE_BRANCH'; branchName: string }
  | { type: 'APPLY_STASH'; index: number }
  | { type: 'POP_STASH'; index: number }
  | { type: 'DROP_STASH'; index: number }
  | { type: 'VIEW_STASH_DIFF'; index: number }
  | { type: 'SIGN_IN' }
  | { type: 'SIGN_OUT' }
  | { type: 'OPEN_URL'; url: string }
  | { type: 'EXECUTE_COMMAND'; command: string; args?: unknown[] };
