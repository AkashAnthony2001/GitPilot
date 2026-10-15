import { describe, expect, it } from 'vitest';
import {
  enrichRemotesWithGitHubInfo,
  parseGitHubRemote,
  parseGitLog,
  parseGitStashList,
} from '../src/git/gitUtils';
import { GitRemote } from '../src/models/types';

describe('gitUtils', () => {
  describe('parseGitHubRemote', () => {
    it('parses standard HTTPS GitHub URL', () => {
      const res = parseGitHubRemote('https://github.com/microsoft/vscode.git');
      expect(res).toEqual({
        host: 'github.com',
        owner: 'microsoft',
        repo: 'vscode',
      });
    });

    it('parses HTTPS GitHub URL without .git suffix', () => {
      const res = parseGitHubRemote('https://github.com/octocat/Hello-World');
      expect(res).toEqual({
        host: 'github.com',
        owner: 'octocat',
        repo: 'Hello-World',
      });
    });

    it('parses SSH shorthand URL', () => {
      const res = parseGitHubRemote('git@github.com:facebook/react.git');
      expect(res).toEqual({
        host: 'github.com',
        owner: 'facebook',
        repo: 'react',
      });
    });

    it('parses SSH protocol URL', () => {
      const res = parseGitHubRemote('ssh://git@github.com/torvalds/linux.git');
      expect(res).toEqual({
        host: 'github.com',
        owner: 'torvalds',
        repo: 'linux',
      });
    });

    it('returns null for empty or invalid URLs', () => {
      expect(parseGitHubRemote(undefined)).toBeNull();
      expect(parseGitHubRemote('')).toBeNull();
      expect(parseGitHubRemote('not-a-url')).toBeNull();
    });
  });

  describe('enrichRemotesWithGitHubInfo', () => {
    it('enriches remote array with parsed owner and repo', () => {
      const remotes: GitRemote[] = [
        { name: 'origin', fetchUrl: 'https://github.com/my-org/my-project.git' },
        { name: 'upstream', fetchUrl: 'git@github.com:upstream-org/my-project.git' },
      ];
      const enriched = enrichRemotesWithGitHubInfo(remotes);
      expect(enriched[0].owner).toBe('my-org');
      expect(enriched[0].repo).toBe('my-project');
      expect(enriched[1].owner).toBe('upstream-org');
      expect(enriched[1].repo).toBe('my-project');
    });
  });

  describe('parseGitLog', () => {
    it('returns empty array for empty output', () => {
      expect(parseGitLog('')).toEqual([]);
      expect(parseGitLog('   \n  ')).toEqual([]);
    });

    it('correctly parses structured git log output', () => {
      const FIELD = '\x1f';
      const COMMIT = '\x1e';
      const sample = [
        `abcdef1234567890${FIELD}abcdef1${FIELD}feat: add cockpit${FIELD}Detailed description here${FIELD}Jane Doe${FIELD}jane@example.com${FIELD}2026-10-15 10:00:00${FIELD}2 hours ago${FIELD}1234567${COMMIT}`,
        `1234567890abcdef${FIELD}1234567${FIELD}fix: syntax error${FIELD}${FIELD}John Doe${FIELD}john@example.com${FIELD}2026-10-15 08:00:00${FIELD}4 hours ago${FIELD}${COMMIT}`,
      ].join('\n');

      const commits = parseGitLog(sample);
      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe('abcdef1234567890');
      expect(commits[0].shortHash).toBe('abcdef1');
      expect(commits[0].subject).toBe('feat: add cockpit');
      expect(commits[0].body).toBe('Detailed description here');
      expect(commits[0].authorName).toBe('Jane Doe');
      expect(commits[0].relativeDate).toBe('2 hours ago');
      expect(commits[0].parents).toEqual(['1234567']);

      expect(commits[1].subject).toBe('fix: syntax error');
      expect(commits[1].body).toBeUndefined();
    });
  });

  describe('parseGitStashList', () => {
    it('returns empty array for empty stash list', () => {
      expect(parseGitStashList('')).toEqual([]);
      expect(parseGitStashList('   ')).toEqual([]);
    });

    it('parses git stash list output correctly', () => {
      const output = [
        'stash@{0}: WIP on main: 9f1a2b3 Add dashboard panel',
        'stash@{1}: On feature/auth: 4b2c1d0 Temporary auth state',
      ].join('\n');

      const stashes = parseGitStashList(output);
      expect(stashes).toHaveLength(2);
      expect(stashes[0].index).toBe(0);
      expect(stashes[0].message).toBe('WIP on main: 9f1a2b3 Add dashboard panel');
      expect(stashes[0].hash).toBe('stash@{0}');

      expect(stashes[1].index).toBe(1);
      expect(stashes[1].message).toBe('On feature/auth: 4b2c1d0 Temporary auth state');
      expect(stashes[1].hash).toBe('stash@{1}');
    });
  });
});
