# GitPilot — GitHub Control Center for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/AkashAnthony2001/GitPilot/blob/main/LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-v1.90%2B-blue)](https://code.visualstudio.com/)

> **"Your GitHub workflow. One cockpit. Zero context switching."**

GitPilot is an all-in-one GitHub management workspace and Source Control companion embedded directly inside Visual Studio Code. Rather than repeatedly switching to your browser to view pull requests, monitor GitHub Actions, review stashed files, or inspect commit trees, GitPilot brings the entire GitHub cockpit directly into your editor.

---

## Key Features

### 🚀 GitPilot Cockpit Dashboard
- **All-in-One Cockpit Tab**: View working tree status, commit history, stashed changes, open pull requests, and CI/CD workflow health at a glance.
- **Theme-Native UI**: Styled using official VS Code theme variables (`var(--vscode-...)`), providing seamless contrast and beauty in Dark, Light, and High-Contrast modes.
- **Interactive Controls**: Switch repositories and branches, trigger quick commits, stash changes, and launch PRs directly from the cockpit.

### 🌳 Commits Tree & History Explorer
- Visual commit history with author avatars, commit SHAs, relative dates, and commit messages.
- Full markdown tooltips with complete commit descriptions and parent commit hashes.

### 📦 Stashes Inspector & Actions
- Dedicated **Stashes** view in the sidebar.
- Inspect stashed files and preview full stash diffs (`git stash show -p`).
- Apply, Pop, or Drop stashes with explicit confirmation prompts to prevent accidental data loss.

### 🔀 Pull Request Workspace
- List open, draft, and merged pull requests for your repository.
- View author, review status, base/head branches, and label badges.
- One-click navigation to GitHub PR comparison and review pages.

### ⚙️ GitHub Actions Workflow Monitor
- Live CI/CD status for recent workflow runs (Passed, Failed, Running, Cancelled).
- View branch, triggering event, runner actor, and execution duration.
- Direct links to workflow run logs and GitHub Actions runs.

### 🔒 Enterprise-Grade Security
- Direct integration with VS Code's official `vscode.authentication` GitHub provider.
- Secure fallback to VS Code `SecretStorage` for Personal Access Tokens.
- Zero credential exposure: tokens are never passed to Webviews, logged to disk, or committed to configuration.

---

## Getting Started

1. **Open the Activity Bar**: Click the **GitPilot** icon in the VS Code Activity Bar (or run `GitPilot: Open Dashboard` from the Command Palette `Cmd+Shift+P` / `Ctrl+Shift+P`).
2. **Sign In to GitHub**: Click **Sign In with GitHub** in the GitPilot sidebar or Cockpit header to authorize read access to your pull requests and workflow runs.
3. **Cockpit Overview**: Enjoy instant access to your repository metrics, commits, stashes, and PRs without opening your browser!

---

## Extension Commands

| Command | Title | Description |
| :--- | :--- | :--- |
| `gitpilot.openDashboard` | **GitPilot: Open Dashboard** | Opens the rich React Cockpit dashboard tab. |
| `gitpilot.signIn` | **GitPilot: Sign In to GitHub** | Authenticates using VS Code GitHub provider or PAT. |
| `gitpilot.signOut` | **GitPilot: Sign Out from GitHub** | Clears stored GitHub session and credentials. |
| `gitpilot.refresh` | **GitPilot: Refresh All** | Flushes API cache and fetches latest repository data. |
| `gitpilot.switchRepository` | **GitPilot: Switch Repository** | Switches active repository in multi-repo workspaces. |
| `gitpilot.switchBranch` | **GitPilot: Switch Branch** | Quickly checkouts a local or remote branch. |
| `gitpilot.createBranch` | **GitPilot: Create Branch** | Creates a new branch from current HEAD. |
| `gitpilot.createStash` | **GitPilot: Create Stash** | Stashes uncommitted working tree changes. |
| `gitpilot.applyStash` | **GitPilot: Apply Stash** | Applies a stash without dropping it from the stack. |
| `gitpilot.popStash` | **GitPilot: Pop Stash** | Applies and removes a stash from the stack. |
| `gitpilot.dropStash` | **GitPilot: Drop Stash** | Drops a stash with confirmation dialog. |
| `gitpilot.viewStashDiff` | **GitPilot: View Stash Diff** | Opens a dedicated diff editor for a stash. |
| `gitpilot.createPullRequest` | **GitPilot: Create Pull Request** | Prepares a new GitHub PR from current branch. |

---

## Extension Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `gitpilot.autoRefreshInterval` | `60` | Auto-refresh interval in seconds (0 disables auto-refresh). |
| `gitpilot.confirmDestructiveActions` | `true` | Show confirmation prompt before dropping stashes or discarding changes. |
| `gitpilot.openDashboardOnStartup` | `false` | Automatically open the GitPilot Cockpit when VS Code launches. |
| `gitpilot.cacheTtlSeconds` | `180` | Cache duration in seconds for GitHub API read requests. |

---

## License

MIT &copy; 2026 GitPilot Contributors.
