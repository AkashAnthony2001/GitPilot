import { execFile } from 'child_process';
import { promisify } from 'util';
import { GitCommit, GitRemote, GitStash } from '../models/types';

const execFileAsync = promisify(execFile);

export function parseGitHubRemote(url: string | undefined): { owner: string; repo: string; host: string } | null {
  if (!url) {
    return null;
  }

  const cleaned = url.trim();

  // HTTPS: https://github.com/owner/repo(.git)
  const httpsMatch = cleaned.match(/^https?:\/\/([^/:]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return {
      host: httpsMatch[1],
      owner: httpsMatch[2],
      repo: httpsMatch[3],
    };
  }

  // SSH shorthand: git@github.com:owner/repo(.git)
  const sshShortMatch = cleaned.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshShortMatch) {
    return {
      host: sshShortMatch[1],
      owner: sshShortMatch[2],
      repo: sshShortMatch[3],
    };
  }

  // SSH protocol: ssh://git@github.com/owner/repo(.git)
  const sshProtoMatch = cleaned.match(/^ssh:\/\/git@([^/:]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshProtoMatch) {
    return {
      host: sshProtoMatch[1],
      owner: sshProtoMatch[2],
      repo: sshProtoMatch[3],
    };
  }

  return null;
}

export function enrichRemotesWithGitHubInfo(remotes: GitRemote[]): GitRemote[] {
  return remotes.map((remote) => {
    const parsed = parseGitHubRemote(remote.fetchUrl || remote.pushUrl);
    if (parsed) {
      return {
        ...remote,
        owner: parsed.owner,
        repo: parsed.repo,
      };
    }
    return remote;
  });
}

export async function execGit(args: string[], cwd: string, timeoutMs = 15000): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        LANG: 'C',
        LC_ALL: 'C',
      },
    });
    return stdout;
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string; code?: number };
    throw new Error(`Git command failed: git ${args.join(' ')}\n${error.stderr || error.message}`);
  }
}

const COMMIT_DELIMITER = '\x1e';
const FIELD_DELIMITER = '\x1f';
export const GIT_LOG_FORMAT = `%H${FIELD_DELIMITER}%h${FIELD_DELIMITER}%s${FIELD_DELIMITER}%b${FIELD_DELIMITER}%an${FIELD_DELIMITER}%ae${FIELD_DELIMITER}%ad${FIELD_DELIMITER}%ar${FIELD_DELIMITER}%P${COMMIT_DELIMITER}`;

export function parseGitLog(output: string): GitCommit[] {
  if (!output || !output.trim()) {
    return [];
  }

  const chunks = output.split(COMMIT_DELIMITER).map((c) => c.trim()).filter(Boolean);
  const commits: GitCommit[] = [];

  for (const chunk of chunks) {
    const fields = chunk.split(FIELD_DELIMITER);
    if (fields.length >= 7) {
      const [hash, shortHash, subject, body, authorName, authorEmail, authorDate, relativeDate, parents] = fields;
      commits.push({
        hash,
        shortHash,
        subject: subject || '(no commit message)',
        body: body ? body.trim() : undefined,
        authorName,
        authorEmail,
        authorDate,
        relativeDate: relativeDate || authorDate,
        parents: parents ? parents.trim().split(/\s+/).filter(Boolean) : [],
      });
    }
  }

  return commits;
}

export function parseGitStashList(output: string): GitStash[] {
  if (!output || !output.trim()) {
    return [];
  }

  const lines = output.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const stashes: GitStash[] = [];

  for (const line of lines) {
    // Expected: stash@{0}: WIP on main: 9f1a2b3 Initial commit or On branch: message
    const match = line.match(/^stash@\{(\d+)\}:(?: (.*?):)? (.*)$/);
    if (match) {
      const index = parseInt(match[1], 10);
      const branchOrContext = match[2] || '';
      const message = match[3] || line;

      stashes.push({
        index,
        message: branchOrContext ? `${branchOrContext}: ${message}` : message,
        hash: `stash@{${index}}`,
        date: '',
      });
    }
  }

  return stashes;
}
