# Changelog

All notable changes to the "GitPilot" extension will be documented in this file.

## [0.1.0] - Phase 1 Foundation Release

### Added
- **Activity Bar & Primary Sidebar**: Dedicated GitPilot Activity Bar icon with 10 native TreeViews:
  - Dashboard Overview
  - Repositories
  - Branches
  - Commits
  - Stashes
  - Pull Requests
  - Issues
  - GitHub Actions
  - Releases & Tags
  - Settings & Account
- **GitPilot Cockpit Webview**: Full-screen developer cockpit powered by React 18, Vite, and Tailwind CSS.
- **Source Control Companion Features**:
  - Live working tree status (staged, unstaged, untracked counts).
  - Commit history timeline with detailed tooltips and SHA badges.
  - Stashes inspector: view diffs (`git stash show -p`), Apply, Pop, and Drop with confirmation dialogs.
  - Interactive branch dropdown and quick branch creation.
- **GitHub API Integration**:
  - Secure authentication via `vscode.authentication` and `SecretStorage` for Personal Access Tokens.
  - Open PRs, issues, and Actions workflow runs with real-time status icons.
  - Smart API caching and rate-limit tracking.
- **Unit Testing**: Vitest suite covering remote parsing, stash parser, and git log formatters.
- **Build Pipeline**: Production-ready esbuild bundling and Vite asset compilation.
