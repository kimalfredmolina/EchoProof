const path = require('path');
const { Octokit } = require('@octokit/rest');
const { env } = require('../config/environment');

/**
 * Returns a configured Octokit instance.
 * Uses the GITHUB_TOKEN from environment if present (higher rate limits).
 */
function createOctokit() {
  return new Octokit({
    auth: env.GITHUB_TOKEN || undefined,
    request: { timeout: env.GITHUB_TIMEOUT_MS },
  });
}

/**
 * Fetch repository metadata (name, description, owner, default branch, etc.)
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<object>} GitHub repo metadata
 */
async function fetchRepoMetadata(owner, repo) {
  const octokit = createOctokit();
  const { data } = await octokit.repos.get({ owner, repo });
  return {
    name: data.name,
    fullName: data.full_name,
    description: data.description || '',
    owner: data.owner.login,
    defaultBranch: data.default_branch,
    url: data.html_url,
    private: data.private,
    stargazersCount: data.stargazers_count,
    forksCount: data.forks_count,
  };
}

/**
 * Fetch all merged pull requests for a repository.
 * Returns PR number, title, body, author, dates, comments, changed files, and URL.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array>}
 */
async function fetchPullRequests(owner, repo) {
  const octokit = createOctokit();
  const pullRequests = [];

  // Paginate through all closed (merged) PRs
  for await (const response of octokit.paginate.iterator(octokit.pulls.list, {
    owner,
    repo,
    state: 'closed',
    per_page: 100,
  })) {
    for (const pr of response.data) {
      // Only include merged PRs
      if (!pr.merged_at) continue;

      // Fetch PR comments for discussion context
      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: pr.number,
        per_page: 100,
      });

      // Fetch PR review comments
      const { data: reviewComments } = await octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pr.number,
        per_page: 100,
      });

      // Fetch changed files
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pr.number,
        per_page: 100,
      });

      pullRequests.push({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        author: pr.user?.login || '',
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        url: pr.html_url,
        comments: [
          ...comments.map((c) => ({ author: c.user?.login || '', body: c.body, createdAt: c.created_at })),
          ...reviewComments.map((c) => ({ author: c.user?.login || '', body: c.body, createdAt: c.created_at })),
        ],
        changedFiles: files.map((f) => f.filename),
      });
    }
  }

  return pullRequests;
}

/**
 * Fetch commits for a repository.
 * Returns SHA, message, author, date, and changed files for each commit.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array>}
 */
async function fetchCommits(owner, repo) {
  const octokit = createOctokit();
  const commits = [];

  for await (const response of octokit.paginate.iterator(octokit.repos.listCommits, {
    owner,
    repo,
    per_page: 100,
  })) {
    for (const commit of response.data) {
      // Fetch the individual commit to get changed files
      const { data: detail } = await octokit.repos.getCommit({
        owner,
        repo,
        ref: commit.sha,
      });

      commits.push({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || commit.author?.login || '',
        date: commit.commit.author?.date || null,
        url: commit.html_url,
        changedFiles: (detail.files || []).map((f) => f.filename),
      });
    }
  }

  return commits;
}

/**
 * Fetch all Markdown documentation files from a repository.
 * Searches README.md, /docs/*, /adr/*, and any *.md file in the tree.
 * Returns { path, content, url } for each file.
 * @param {string} owner
 * @param {string} repo
 * @param {string} defaultBranch
 * @returns {Promise<Array>}
 */
async function fetchMarkdownDocs(owner, repo, defaultBranch = 'main') {
  const octokit = createOctokit();
  const docs = [];

  // Get the full file tree (recursive)
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: 'true',
  });

  // Filter to only Markdown files
  const mdFiles = treeData.tree.filter(
    (item) => item.type === 'blob' && item.path.endsWith('.md')
  );

  for (const file of mdFiles) {
    try {
      const { data: blob } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.path,
        ref: defaultBranch,
      });

      // getContent returns base64 encoded content for files
      const content = Buffer.from(blob.content, 'base64').toString('utf8');

      docs.push({
        path: file.path,
        content,
        url: blob.html_url,
      });
    } catch (err) {
      // Skip files that cannot be read
      console.warn(`[github] Skipping ${file.path}: ${err.message}`);
    }
  }

  return docs;
}

const SOURCE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.h', '.hpp', '.html', '.java', '.js',
  '.jsx', '.kt', '.kts', '.php', '.py', '.rb', '.rs', '.scss', '.sh', '.sql', '.swift',
  '.ts', '.tsx', '.vue',
]);
const MAX_SOURCE_FILE_BYTES = 120000;

function sourcePathScore(filePath, questionTerms, candidatePaths) {
  const normalizedPath = filePath.toLowerCase();
  const baseName = normalizedPath.split('/').pop();
  let score = 0;

  for (const candidate of candidatePaths) {
    if (normalizedPath === candidate) score += 30;
    else if (normalizedPath.endsWith(`/${candidate}`) || candidate.endsWith(`/${normalizedPath}`)) score += 18;
  }
  for (const term of questionTerms) {
    if (baseName.includes(term)) score += 8;
    else if (normalizedPath.includes(term)) score += 4;
  }

  return score;
}

function isEntryPoint(filePath) {
  return /(^|\/)(index|main|app|server|router|routes)\.[^/]+$/.test(filePath.toLowerCase());
}

/**
 * Fetch a bounded set of source files selected by question terms and paths found in history.
 * This is a Phase 5 compatibility path until Phase 3 indexes source-code chunks.
 */
async function fetchRelevantSourceFiles(owner, repo, options = {}) {
  const { question = '', candidatePaths = [], limit = 8 } = options;
  const octokit = createOctokit();
  const metadata = await fetchRepoMetadata(owner, repo);
  if (metadata.private) throw new Error('Private repository source inspection is disabled');

  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: metadata.defaultBranch,
    recursive: 'true',
  });

  const questionTerms = [...new Set(String(question)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3))];
  const normalizedCandidates = candidatePaths.map((item) => String(item).toLowerCase());
  const excludedPath = /(^|\/)(node_modules|vendor|dist|build|coverage|\.git)(\/|$)/;

  const ranked = treeData.tree
    .filter((item) => item.type === 'blob')
    .filter((item) => SOURCE_EXTENSIONS.has(path.extname(item.path).toLowerCase()))
    .filter((item) => !excludedPath.test(item.path.toLowerCase()))
    .filter((item) => !item.size || item.size <= MAX_SOURCE_FILE_BYTES)
    .map((item) => ({
      ...item,
      relevance: sourcePathScore(item.path, questionTerms, normalizedCandidates),
    }))
    .filter((item) => item.relevance > 0)
    .sort((left, right) => {
      if (right.relevance !== left.relevance) return right.relevance - left.relevance;
      if (isEntryPoint(left.path) !== isEntryPoint(right.path)) return isEntryPoint(left.path) ? -1 : 1;
      return left.path.localeCompare(right.path);
    })
    .slice(0, Math.max(1, Math.min(limit, 12)));

  const settled = await Promise.allSettled(ranked.map(async (file) => {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: file.path,
      ref: metadata.defaultBranch,
    });
    if (Array.isArray(data) || !data.content) throw new Error('GitHub returned no file content');

    return {
      path: file.path,
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      url: data.html_url,
      relevance: file.relevance,
    };
  }));

  const files = settled
    .filter((item) => item.status === 'fulfilled')
    .map((item) => item.value);
  const failedReads = settled.filter((item) => item.status === 'rejected');
  failedReads.forEach((item, index) => {
    console.warn(`[github] Source inspection read failed (${index + 1}/${failedReads.length}): ${item.reason.message}`);
  });

  const warnings = [];
  if (failedReads.length) warnings.push(`${failedReads.length} selected source file${failedReads.length === 1 ? '' : 's'} could not be read.`);
  if (treeData.truncated) warnings.push('GitHub returned a truncated repository tree.');
  if (!ranked.length) warnings.push('No source file paths matched the question or related history.');

  return { files, warnings, defaultBranch: metadata.defaultBranch };
}

module.exports = {
  createOctokit,
  fetchCommits,
  fetchMarkdownDocs,
  fetchPullRequests,
  fetchRelevantSourceFiles,
  fetchRepoMetadata,
  sourcePathScore,
};
