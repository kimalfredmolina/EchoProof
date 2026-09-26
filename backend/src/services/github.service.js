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

module.exports = { createOctokit, fetchRepoMetadata };
