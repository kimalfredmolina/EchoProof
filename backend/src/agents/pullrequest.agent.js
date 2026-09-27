const { searchDocuments } = require('../services/retrieval.service');

async function investigatePullRequests({ context, question }) {
  const evidence = await searchDocuments({
    contextId: context._id,
    question,
    types: ['pull_request'],
    limit: 8,
  });

  if (!evidence.length) {
    return {
      summary: 'No pull request descriptions or discussions matched the investigation terms.',
      evidence: [],
      warnings: [],
    };
  }

  const decisions = evidence
    .slice(0, 4)
    .map((item) => `${item.reference || item.title}: ${item.excerpt}`)
    .join(' | ');

  return {
    summary: `Found ${evidence.length} relevant pull request${evidence.length === 1 ? '' : 's'}. The strongest motivation and discussion excerpts are: ${decisions}`,
    evidence,
    warnings: [],
  };
}

module.exports = { investigatePullRequests };
