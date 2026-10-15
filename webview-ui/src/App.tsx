import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  GitCommit as GitCommitIcon,
  Archive,
  GitPullRequest as GitPullRequestIcon,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  FolderGit2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ArrowUp,
  ArrowDown,
  Layers,
  FileCode,
  LogIn,
  LogOut,
  Trash2,
  FileDiff
} from 'lucide-react';
import { DashboardState, ToWebviewMessage } from '../../src/models/types';
import { getVsCodeApi } from './vscode';

export default function App() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'commits' | 'stashes' | 'prs' | 'actions'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState('');
  const [showNewBranchModal, setShowNewBranchModal] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ToWebviewMessage>) => {
      const message = event.data;
      if (message.type === 'STATE_UPDATE') {
        setState(message.payload);
        setIsRefreshing(false);
      } else if (message.type === 'ACTION_SUCCESS') {
        setIsRefreshing(false);
      } else if (message.type === 'ACTION_ERROR') {
        setIsRefreshing(false);
      }
    };

    window.addEventListener('message', handleMessage);
    // Request initial state
    getVsCodeApi().postMessage({ type: 'REFRESH' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    getVsCodeApi().postMessage({ type: 'REFRESH' });
  };

  const handleSwitchRepo = (repoId: string) => {
    getVsCodeApi().postMessage({ type: 'SWITCH_REPOSITORY', repositoryId: repoId });
  };

  const handleSwitchBranch = (branchName: string) => {
    getVsCodeApi().postMessage({ type: 'SWITCH_BRANCH', branchName });
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchInput.trim()) return;
    getVsCodeApi().postMessage({ type: 'CREATE_BRANCH', branchName: newBranchInput.trim() });
    setNewBranchInput('');
    setShowNewBranchModal(false);
  };

  const handleApplyStash = (index: number) => {
    getVsCodeApi().postMessage({ type: 'APPLY_STASH', index });
  };

  const handlePopStash = (index: number) => {
    getVsCodeApi().postMessage({ type: 'POP_STASH', index });
  };

  const handleDropStash = (index: number) => {
    getVsCodeApi().postMessage({ type: 'DROP_STASH', index });
  };

  const handleViewStashDiff = (index: number) => {
    getVsCodeApi().postMessage({ type: 'VIEW_STASH_DIFF', index });
  };

  const handleSignIn = () => {
    getVsCodeApi().postMessage({ type: 'SIGN_IN' });
  };

  const handleSignOut = () => {
    getVsCodeApi().postMessage({ type: 'SIGN_OUT' });
  };

  const handleOpenUrl = (url: string) => {
    getVsCodeApi().postMessage({ type: 'OPEN_URL', url });
  };

  const handleExecuteCommand = (command: string, args?: unknown[]) => {
    getVsCodeApi().postMessage({ type: 'EXECUTE_COMMAND', command, args });
  };

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-vsc-desc gap-3 p-6">
        <RefreshCw className="w-8 h-8 animate-spin text-vsc-btn" />
        <p className="text-sm">Connecting to GitPilot Cockpit...</p>
      </div>
    );
  }

  const { repository, repositories, commits, stashes, pullRequests, issues, workflowRuns, githubUser, isAuthenticated } = state;
  const ghRemote = repository?.remotes.find((r) => r.owner && r.repo);

  return (
    <div className="min-h-screen bg-vsc-bg text-vsc-fg flex flex-col p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cockpit Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-vsc-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-vsc-btn/10 border border-vsc-btn/30 text-vsc-btn">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">GitPilot Cockpit</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-vsc-card border border-vsc-border text-vsc-desc">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-vsc-desc">Your GitHub workflow. One cockpit. Zero context switching.</p>
          </div>
        </div>

        {/* Repository & Branch Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {repositories.length > 0 && (
            <select
              value={repository?.id || ''}
              onChange={(e) => handleSwitchRepo(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded bg-vsc-input text-vsc-inputFg border border-vsc-inputBorder focus:outline-none focus:ring-1 focus:ring-vsc-accent cursor-pointer"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  📁 {r.name} {r.currentBranch ? `(${r.currentBranch})` : ''}
                </option>
              ))}
            </select>
          )}

          {repository?.currentBranch && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded bg-vsc-card border border-vsc-border">
              <GitBranch className="w-3.5 h-3.5 text-vsc-desc" />
              {state.branches.filter((b) => !b.isRemote).length > 1 ? (
                <select
                  value={repository.currentBranch}
                  onChange={(e) => handleSwitchBranch(e.target.value)}
                  title="Switch branch"
                  className="bg-transparent border-0 font-semibold focus:outline-none cursor-pointer text-vsc-fg"
                >
                  {state.branches.filter((b) => !b.isRemote).map((b) => (
                    <option key={b.name} value={b.name} className="bg-vsc-input text-vsc-inputFg font-mono">
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-semibold">{repository.currentBranch}</span>
              )}
              {repository.aheadBehind && (repository.aheadBehind.ahead > 0 || repository.aheadBehind.behind > 0) && (
                <div className="flex items-center gap-1 text-[11px] text-vsc-desc pl-1 border-l border-vsc-border">
                  {repository.aheadBehind.ahead > 0 && (
                    <span className="flex items-center text-vsc-success">
                      <ArrowUp className="w-3 h-3" />
                      {repository.aheadBehind.ahead}
                    </span>
                  )}
                  {repository.aheadBehind.behind > 0 && (
                    <span className="flex items-center text-vsc-warning">
                      <ArrowDown className="w-3 h-3" />
                      {repository.aheadBehind.behind}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh All"
            className="p-1.5 rounded bg-vsc-card hover:bg-vsc-cardHover border border-vsc-border text-vsc-fg transition"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* GitHub Auth Pill */}
          {isAuthenticated && githubUser ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-vsc-card border border-vsc-border">
              <img src={githubUser.avatarUrl} alt={githubUser.login} className="w-5 h-5 rounded-full" />
              <span className="text-xs font-medium">@{githubUser.login}</span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="text-vsc-desc hover:text-vsc-error transition ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btn text-vsc-btnFg hover:bg-vsc-btnHover transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in with GitHub</span>
            </button>
          )}
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Working Tree Changes */}
        <div
          onClick={() => setActiveTab('overview')}
          className="p-3 rounded-lg bg-vsc-card border border-vsc-border hover:border-vsc-accent cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-vsc-desc mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Changes</span>
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold">
              {repository ? repository.workingTree.totalChanged : 0}
            </div>
            <div className="text-[11px] text-vsc-desc mt-0.5">
              {repository?.isClean ? 'Clean tree' : `${repository?.workingTree.staged.length} staged, ${repository?.workingTree.unstaged.length} unstaged`}
            </div>
          </div>
        </div>

        {/* Metric 2: Branch & Sync */}
        <div
          onClick={() => setActiveTab('commits')}
          className="p-3 rounded-lg bg-vsc-card border border-vsc-border hover:border-vsc-accent cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-vsc-desc mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Sync Status</span>
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold flex items-center gap-2">
              <span className="text-vsc-success">↑{repository?.aheadBehind?.ahead ?? 0}</span>
              <span className="text-vsc-warning">↓{repository?.aheadBehind?.behind ?? 0}</span>
            </div>
            <div className="text-[11px] text-vsc-desc truncate mt-0.5">
              {repository?.currentBranch || 'No branch'}
            </div>
          </div>
        </div>

        {/* Metric 3: Stashes */}
        <div
          onClick={() => setActiveTab('stashes')}
          className="p-3 rounded-lg bg-vsc-card border border-vsc-border hover:border-vsc-accent cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-vsc-desc mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Stashes</span>
            <Archive className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{stashes.length}</div>
            <div className="text-[11px] text-vsc-desc truncate mt-0.5">
              {stashes.length > 0 ? stashes[0].message : 'No stashed changes'}
            </div>
          </div>
        </div>

        {/* Metric 4: Pull Requests */}
        <div
          onClick={() => setActiveTab('prs')}
          className="p-3 rounded-lg bg-vsc-card border border-vsc-border hover:border-vsc-accent cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-vsc-desc mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pull Requests</span>
            <GitPullRequestIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{pullRequests.length}</div>
            <div className="text-[11px] text-vsc-desc mt-0.5">
              {isAuthenticated ? 'Open in repo' : 'Sign in to view'}
            </div>
          </div>
        </div>

        {/* Metric 5: Issues */}
        <div
          onClick={() => setActiveTab('prs')}
          className="p-3 rounded-lg bg-vsc-card border border-vsc-border hover:border-vsc-accent cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-vsc-desc mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Issues</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold">{issues.length}</div>
            <div className="text-[11px] text-vsc-desc mt-0.5">
              {isAuthenticated ? 'Open issues' : 'Sign in to view'}
            </div>
          </div>
        </div>

        {/* Metric 6: Actions Workflows */}
        <div
          onClick={() => setActiveTab('actions')}
          className="p-3 rounded-lg bg-vsc-card border border-vsc-border hover:border-vsc-accent cursor-pointer transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-vsc-desc mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Actions</span>
            <PlayCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold flex items-center gap-1.5">
              {workflowRuns.length > 0 ? (
                workflowRuns[0].conclusion === 'success' ? (
                  <span className="flex items-center text-vsc-success text-sm font-semibold gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Passed
                  </span>
                ) : workflowRuns[0].conclusion === 'failure' ? (
                  <span className="flex items-center text-vsc-error text-sm font-semibold gap-1">
                    <XCircle className="w-4 h-4" /> Failed
                  </span>
                ) : (
                  <span className="flex items-center text-vsc-warning text-sm font-semibold gap-1">
                    <Clock className="w-4 h-4" /> {workflowRuns[0].status}
                  </span>
                )
              ) : (
                <span className="text-sm font-medium text-vsc-desc">None</span>
              )}
            </div>
            <div className="text-[11px] text-vsc-desc mt-0.5">
              {workflowRuns.length} recent runs
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-vsc-card border border-vsc-border">
        <span className="text-xs font-medium text-vsc-desc mr-2">Quick Actions:</span>

        <button
          onClick={() => setShowNewBranchModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btnSec text-vsc-btnSecFg hover:bg-vsc-btnSecHover border border-vsc-border transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Branch</span>
        </button>

        <button
          onClick={() => handleExecuteCommand('gitpilot.createStash')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btnSec text-vsc-btnSecFg hover:bg-vsc-btnSecHover border border-vsc-border transition"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Stash Changes</span>
        </button>

        <button
          onClick={() => handleExecuteCommand('gitpilot.createCommit')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btnSec text-vsc-btnSecFg hover:bg-vsc-btnSecHover border border-vsc-border transition"
        >
          <GitCommitIcon className="w-3.5 h-3.5" />
          <span>Commit Changes</span>
        </button>

        <button
          onClick={() => handleExecuteCommand('gitpilot.createPullRequest')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btnSec text-vsc-btnSecFg hover:bg-vsc-btnSecHover border border-vsc-border transition"
        >
          <GitPullRequestIcon className="w-3.5 h-3.5" />
          <span>New Pull Request</span>
        </button>

        {ghRemote && (
          <button
            onClick={() => handleExecuteCommand('gitpilot.openOnGitHub')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btnSec text-vsc-btnSecFg hover:bg-vsc-btnSecHover border border-vsc-border transition ml-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>GitHub Repository</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-vsc-border space-x-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-vsc-accent text-vsc-fg font-semibold'
              : 'border-transparent text-vsc-desc hover:text-vsc-fg'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('commits')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'commits'
              ? 'border-vsc-accent text-vsc-fg font-semibold'
              : 'border-transparent text-vsc-desc hover:text-vsc-fg'
          }`}
        >
          <GitCommitIcon className="w-4 h-4" />
          <span>Commits ({commits.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('stashes')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'stashes'
              ? 'border-vsc-accent text-vsc-fg font-semibold'
              : 'border-transparent text-vsc-desc hover:text-vsc-fg'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Stashes ({stashes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('prs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'prs'
              ? 'border-vsc-accent text-vsc-fg font-semibold'
              : 'border-transparent text-vsc-desc hover:text-vsc-fg'
          }`}
        >
          <GitPullRequestIcon className="w-4 h-4" />
          <span>Pull Requests ({pullRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'actions'
              ? 'border-vsc-accent text-vsc-fg font-semibold'
              : 'border-transparent text-vsc-desc hover:text-vsc-fg'
          }`}
        >
          <PlayCircle className="w-4 h-4" />
          <span>Actions ({workflowRuns.length})</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1">
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Working Tree Files */}
            <div className="p-4 rounded-lg bg-vsc-card border border-vsc-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-vsc-desc" />
                  Working Tree Status
                </h2>
                <span className="text-xs text-vsc-desc">
                  {repository?.workingTree.totalChanged ?? 0} files modified
                </span>
              </div>

              {(!repository || repository.workingTree.totalChanged === 0) ? (
                <div className="py-8 text-center text-vsc-desc space-y-1">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-vsc-success opacity-80" />
                  <p className="text-xs font-medium text-vsc-fg">Working tree is clean</p>
                  <p className="text-[11px]">No uncommitted changes in the repository.</p>
                </div>
              ) : (
                <div className="divide-y divide-vsc-border max-h-80 overflow-y-auto pr-1">
                  {repository.workingTree.staged.map((f) => (
                    <div key={f.path} className="py-1.5 flex items-center justify-between text-xs">
                      <span className="font-mono truncate">{f.path}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-vsc-success/20 text-vsc-success">
                        Staged ({f.status})
                      </span>
                    </div>
                  ))}
                  {repository.workingTree.unstaged.map((f) => (
                    <div key={f.path} className="py-1.5 flex items-center justify-between text-xs">
                      <span className="font-mono truncate">{f.path}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-vsc-warning/20 text-vsc-warning">
                        Unstaged ({f.status})
                      </span>
                    </div>
                  ))}
                  {repository.workingTree.untracked.map((f) => (
                    <div key={f.path} className="py-1.5 flex items-center justify-between text-xs">
                      <span className="font-mono truncate text-vsc-desc">{f.path}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-vsc-card border border-vsc-border text-vsc-desc">
                        Untracked
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commits Preview */}
            <div className="p-4 rounded-lg bg-vsc-card border border-vsc-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <GitCommitIcon className="w-4 h-4 text-vsc-desc" />
                  Recent Commit History
                </h2>
                <button
                  onClick={() => setActiveTab('commits')}
                  className="text-xs text-vsc-btn hover:underline"
                >
                  View All
                </button>
              </div>

              {commits.length === 0 ? (
                <p className="text-xs text-vsc-desc py-6 text-center">No commits found.</p>
              ) : (
                <div className="divide-y divide-vsc-border max-h-80 overflow-y-auto pr-1">
                  {commits.slice(0, 8).map((c) => (
                    <div key={c.hash} className="py-2 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{c.subject}</span>
                        <span className="text-[11px] font-mono text-vsc-desc">{c.shortHash}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-vsc-desc">
                        <span>{c.authorName}</span>
                        <span>{c.relativeDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Commits History */}
        {activeTab === 'commits' && (
          <div className="p-4 rounded-lg bg-vsc-card border border-vsc-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-vsc-border">
              <h2 className="text-sm font-semibold">Commit History</h2>
              <span className="text-xs text-vsc-desc">{commits.length} commits</span>
            </div>

            <div className="divide-y divide-vsc-border">
              {commits.map((c) => (
                <div key={c.hash} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-vsc-cardHover px-2 rounded transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <GitCommitIcon className="w-4 h-4 text-vsc-desc shrink-0" />
                      <span className="text-xs font-semibold">{c.subject}</span>
                    </div>
                    {c.body && (
                      <p className="text-[11px] text-vsc-desc line-clamp-1 ml-6">{c.body}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-vsc-desc ml-6">
                      <span>{c.authorName} &lt;{c.authorEmail}&gt;</span>
                      <span>•</span>
                      <span>{c.authorDate} ({c.relativeDate})</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs px-2 py-1 rounded bg-vsc-bg border border-vsc-border text-vsc-desc self-start md:self-auto">
                    {c.shortHash}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Stashes Inspector */}
        {activeTab === 'stashes' && (
          <div className="p-4 rounded-lg bg-vsc-card border border-vsc-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-vsc-border">
              <div>
                <h2 className="text-sm font-semibold">Stashed Changes</h2>
                <p className="text-xs text-vsc-desc">View, apply, pop, or drop stashed working directories.</p>
              </div>
              <button
                onClick={() => handleExecuteCommand('gitpilot.createStash')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btn text-vsc-btnFg hover:bg-vsc-btnHover transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Stash</span>
              </button>
            </div>

            {stashes.length === 0 ? (
              <div className="py-12 text-center text-vsc-desc space-y-2">
                <Archive className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-sm font-medium">No stashed changes found</p>
                <p className="text-xs">Save uncommitted changes safely using the Create Stash action.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stashes.map((s) => (
                  <div
                    key={s.index}
                    className="p-3 rounded-lg bg-vsc-bg border border-vsc-border flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-vsc-card border border-vsc-border">
                          stash@&#123;{s.index}&#125;
                        </span>
                        <span className="text-xs font-medium">{s.message}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <button
                        onClick={() => handleViewStashDiff(s.index)}
                        title="View Stash Diff"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-vsc-card hover:bg-vsc-cardHover border border-vsc-border transition"
                      >
                        <FileDiff className="w-3.5 h-3.5" />
                        <span>Diff</span>
                      </button>

                      <button
                        onClick={() => handleApplyStash(s.index)}
                        title="Apply stash without removing from stack"
                        className="px-2.5 py-1 text-xs rounded bg-vsc-card hover:bg-vsc-cardHover border border-vsc-border transition"
                      >
                        Apply
                      </button>

                      <button
                        onClick={() => handlePopStash(s.index)}
                        title="Apply stash and remove from stack"
                        className="px-2.5 py-1 text-xs rounded bg-vsc-card hover:bg-vsc-cardHover border border-vsc-border font-medium transition"
                      >
                        Pop
                      </button>

                      <button
                        onClick={() => handleDropStash(s.index)}
                        title="Delete stash from stack"
                        className="p-1 text-xs rounded hover:bg-vsc-error/20 text-vsc-error transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Pull Requests */}
        {activeTab === 'prs' && (
          <div className="p-4 rounded-lg bg-vsc-card border border-vsc-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-vsc-border">
              <div>
                <h2 className="text-sm font-semibold">Pull Requests</h2>
                <p className="text-xs text-vsc-desc">Active pull requests for {ghRemote?.owner}/{ghRemote?.repo}</p>
              </div>
              <button
                onClick={() => handleExecuteCommand('gitpilot.createPullRequest')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-vsc-btn text-vsc-btnFg hover:bg-vsc-btnHover transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Pull Request</span>
              </button>
            </div>

            {!isAuthenticated ? (
              <div className="py-12 text-center text-vsc-desc space-y-3">
                <LogIn className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-sm font-medium">Sign in to GitHub to access Pull Requests</p>
                <button
                  onClick={handleSignIn}
                  className="px-4 py-2 text-xs font-medium rounded bg-vsc-btn text-vsc-btnFg hover:bg-vsc-btnHover transition"
                >
                  Sign In with GitHub
                </button>
              </div>
            ) : pullRequests.length === 0 ? (
              <div className="py-12 text-center text-vsc-desc space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto opacity-40 text-vsc-success" />
                <p className="text-sm font-medium">No open pull requests</p>
                <p className="text-xs">All clear! Create a pull request when your branch is ready for review.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pullRequests.map((pr) => (
                  <div
                    key={pr.id}
                    className="p-3 rounded-lg bg-vsc-bg border border-vsc-border flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-vsc-accent transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">#{pr.number} {pr.title}</span>
                        {pr.isDraft && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-vsc-card border border-vsc-border text-vsc-desc">
                            Draft
                          </span>
                        )}
                        {pr.labels.map((l) => (
                          <span
                            key={l.name}
                            className="px-1.5 py-0.2 text-[10px] rounded font-medium"
                            style={{ backgroundColor: `#${l.color}22`, color: `#${l.color}` }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-vsc-desc">
                        <span>by @{pr.user.login}</span>
                        <span>•</span>
                        <span className="font-mono">{pr.headRef} → {pr.baseRef}</span>
                        <span>•</span>
                        <span>{pr.commentsCount} comments</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenUrl(pr.htmlUrl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-vsc-card hover:bg-vsc-cardHover border border-vsc-border transition self-end md:self-auto"
                    >
                      <span>Open on GitHub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: GitHub Actions */}
        {activeTab === 'actions' && (
          <div className="p-4 rounded-lg bg-vsc-card border border-vsc-border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-vsc-border">
              <div>
                <h2 className="text-sm font-semibold">GitHub Actions Workflows</h2>
                <p className="text-xs text-vsc-desc">Recent CI/CD pipeline runs and build status.</p>
              </div>
            </div>

            {!isAuthenticated ? (
              <div className="py-12 text-center text-vsc-desc space-y-3">
                <LogIn className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-sm font-medium">Sign in to GitHub to access workflow runs</p>
                <button
                  onClick={handleSignIn}
                  className="px-4 py-2 text-xs font-medium rounded bg-vsc-btn text-vsc-btnFg hover:bg-vsc-btnHover transition"
                >
                  Sign In with GitHub
                </button>
              </div>
            ) : workflowRuns.length === 0 ? (
              <div className="py-12 text-center text-vsc-desc space-y-2">
                <PlayCircle className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-sm font-medium">No workflow runs found</p>
                <p className="text-xs">Run GitHub Actions workflows to see build reports and logs here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workflowRuns.map((run) => (
                  <div
                    key={run.id}
                    className="p-3 rounded-lg bg-vsc-bg border border-vsc-border flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-vsc-accent transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        {run.status === 'in_progress' || run.status === 'queued' ? (
                          <RefreshCw className="w-5 h-5 text-vsc-warning animate-spin" />
                        ) : run.conclusion === 'success' ? (
                          <CheckCircle2 className="w-5 h-5 text-vsc-success" />
                        ) : run.conclusion === 'failure' ? (
                          <XCircle className="w-5 h-5 text-vsc-error" />
                        ) : (
                          <Clock className="w-5 h-5 text-vsc-desc" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{run.name}</span>
                          <span className="text-xs font-mono text-vsc-desc">#{run.runNumber}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-vsc-desc mt-0.5">
                          <span className="font-mono">{run.branch}</span>
                          <span>•</span>
                          <span>{run.event} by @{run.actor.login}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenUrl(run.htmlUrl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-vsc-card hover:bg-vsc-cardHover border border-vsc-border transition self-end md:self-auto"
                    >
                      <span>View Run Logs</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Branch Modal Dialog */}
      {showNewBranchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateBranch}
            className="w-full max-w-md p-5 rounded-lg bg-vsc-bg border border-vsc-border shadow-xl space-y-4"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-vsc-btn" />
              Create New Branch
            </h3>
            <p className="text-xs text-vsc-desc">
              Create a new branch from current branch <strong>{repository?.currentBranch}</strong>.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. feature/cockpit-enhancements"
              value={newBranchInput}
              onChange={(e) => setNewBranchInput(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded bg-vsc-input text-vsc-inputFg border border-vsc-inputBorder focus:outline-none focus:ring-1 focus:ring-vsc-accent font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewBranchModal(false)}
                className="px-3 py-1.5 text-xs rounded bg-vsc-card hover:bg-vsc-cardHover border border-vsc-border transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newBranchInput.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded bg-vsc-btn text-vsc-btnFg hover:bg-vsc-btnHover disabled:opacity-50 transition"
              >
                Create & Switch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
