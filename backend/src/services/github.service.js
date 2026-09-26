const { Octokit } = require('@octokit/rest');
const { env } = require('../config/environment');

/**
 * Returns a configured Octokit instance.
 * Uses the GITHUB_TOKEN from environment if present (higher rate limits).
 */
function createOctokit() {
  return new Octokit({
    auth: env.GITHUB_TOKEN || undefined,
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

module.exports = { createOctokit, fetchRepoMetadata, fetchPullRequests };
