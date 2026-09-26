const SystemContext = require('../models/SystemContext');
const Document = require('../models/Document');
const { fetchRepoMetadata, fetchPullRequests, fetchCommits, fetchMarkdownDocs } = require('./github.service');

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

/**
 * Classify a Markdown file path as 'adr', 'readme', or 'design_document'.
 */
function classifyMarkdownType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes('/adr/') || lower.match(/adr[-_]\d+/)) return 'adr';
  if (lower === 'readme.md' || lower.endsWith('/readme.md')) return 'readme';
  return 'design_document';
}

/**
 * Ingest Markdown documentation files and store them as Documents.
 * @param {string} contextId
 * @param {string} owner
 * @param {string} repo
 * @param {string} defaultBranch
 */
async function ingestMarkdownDocs(contextId, owner, repo, defaultBranch) {
  await updateProgress(contextId, { currentStep: 'Fetching documentation' });

  const files = await fetchMarkdownDocs(owner, repo, defaultBranch);

  if (files.length === 0) return 0;

  const docs = files.map((file) => ({
    contextId,
    type: classifyMarkdownType(file.path),
    title: file.path,
    content: file.content,
    metadata: {
      url: file.url,
      filePath: file.path,
    },
  }));

  await Document.insertMany(docs);
  return docs.length;
}

/**
 * Full ingestion pipeline — runs all steps sequentially and updates status throughout.
 * This is intended to be called in the background after returning a contextId to the caller.
 *
 * @param {string} contextId - MongoDB ObjectId string of the SystemContext
 * @param {string} owner
 * @param {string} repo
 */
async function runIngestion(contextId, owner, repo) {
  let lastSuccessfulStep = '';

  try {
    await SystemContext.findByIdAndUpdate(contextId, { status: 'indexing' });

    // Step 1 (10%): fetch repo metadata
    await updateProgress(contextId, {
      currentStep: 'Fetching repository metadata',
      percentage: 10,
    });
    const meta = await fetchRepoMetadata(owner, repo);
    await SystemContext.findByIdAndUpdate(contextId, {
      name: meta.fullName,
      description: meta.description,
    });
    lastSuccessfulStep = 'Fetching repository metadata';

    // Step 2 (30%): ingest PRs
    await updateProgress(contextId, { percentage: 30 });
    const prCount = await ingestPullRequests(contextId, owner, repo);
    lastSuccessfulStep = 'Fetching pull requests';

    // Step 3 (60%): ingest commits
    await updateProgress(contextId, { percentage: 60 });
    const commitCount = await ingestCommits(contextId, owner, repo);
    lastSuccessfulStep = 'Fetching commits';

    // Step 4 (90%): ingest Markdown docs
    await updateProgress(contextId, { percentage: 90 });
    const docsCount = await ingestMarkdownDocs(contextId, owner, repo, meta.defaultBranch);
    lastSuccessfulStep = 'Fetching documentation';

    const totalDocuments = prCount + commitCount + docsCount;

    await SystemContext.findByIdAndUpdate(contextId, {
      status: 'ready',
      $set: {
        'ingestionProgress.currentStep': 'Complete',
        'ingestionProgress.percentage': 100,
        'ingestionProgress.processedDocuments': totalDocuments,
        'ingestionProgress.totalDocuments': totalDocuments,
        'ingestionProgress.lastSuccessfulStep': lastSuccessfulStep,
      },
    });

    console.log(
      `[ingestion] Context ${contextId} ready — PRs: ${prCount}, commits: ${commitCount}, docs: ${docsCount}`
    );
  } catch (err) {
    console.error(`[ingestion] Context ${contextId} failed:`, err.message);
    await SystemContext.findByIdAndUpdate(contextId, {
      status: 'failed',
      $set: {
        'ingestionProgress.currentStep': `Failed: ${err.message}`,
        'ingestionProgress.lastSuccessfulStep': lastSuccessfulStep,
      },
    });
  }
}

module.exports = { runIngestion, ingestPullRequests, ingestCommits, ingestMarkdownDocs, updateProgress };
