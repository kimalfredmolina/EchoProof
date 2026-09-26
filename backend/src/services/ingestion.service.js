const SystemContext = require('../models/SystemContext');
const Document = require('../models/Document');
const { fetchPullRequests, fetchCommits } = require('./github.service');

/**
 * Update the ingestion progress fields on a SystemContext document.
 */
async function updateProgress(contextId, patch) {
  const update = {};
  for (const [key, value] of Object.entries(patch)) {
    update[`ingestionProgress.${key}`] = value;
  }
  await SystemContext.findByIdAndUpdate(contextId, { $set: update });
}

/**
 * Ingest all merged pull requests for a repository and store them as Documents.
 * @param {string} contextId - MongoDB ObjectId of the SystemContext
 * @param {string} owner
 * @param {string} repo
 */
async function ingestPullRequests(contextId, owner, repo) {
  await updateProgress(contextId, { currentStep: 'Fetching pull requests' });

  const prs = await fetchPullRequests(owner, repo);

  if (prs.length === 0) return 0;

  const docs = prs.map((pr) => {
    // Build a rich text body: title + description + all comments
    const commentText = pr.comments
      .map((c) => `[${c.author}]: ${c.body}`)
      .join('\n\n');

    const content = [
      `PR #${pr.number}: ${pr.title}`,
      pr.body,
      commentText,
      `Changed files:\n${pr.changedFiles.join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      contextId,
      type: 'pull_request',
      title: `PR #${pr.number}: ${pr.title}`,
      content,
      metadata: {
        url: pr.url,
        author: pr.author,
        date: new Date(pr.mergedAt),
        pullRequestNumber: pr.number,
      },
    };
  });

  await Document.insertMany(docs);
  return docs.length;
}

/**
 * Ingest commits for a repository and store them as Documents.
 * @param {string} contextId
 * @param {string} owner
 * @param {string} repo
 */
async function ingestCommits(contextId, owner, repo) {
  await updateProgress(contextId, { currentStep: 'Fetching commits' });

  const commits = await fetchCommits(owner, repo);

  if (commits.length === 0) return 0;

  const docs = commits.map((commit) => {
    const content = [
      commit.message,
      `Changed files:\n${commit.changedFiles.join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      contextId,
      type: 'commit',
      title: commit.message.split('\n')[0].slice(0, 120),
      content,
      metadata: {
        url: commit.url,
        author: commit.author,
        date: commit.date ? new Date(commit.date) : null,
        sha: commit.sha,
      },
    };
  });

  await Document.insertMany(docs);
  return docs.length;
}

module.exports = { ingestPullRequests, ingestCommits, updateProgress };
