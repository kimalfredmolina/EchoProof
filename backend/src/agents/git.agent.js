const { searchDocuments } = require('../services/retrieval.service');

async function investigateGitHistory({ context, question }) {
  const evidence = await searchDocuments({
    contextId: context._id,
    question,
    types: ['commit'],
    limit: 8,
  });

  if (!evidence.length) {
    return {
      summary: 'No commit messages matched the investigation terms.',
      evidence: [],
      warnings: [],
    };
  }

  const timeline = [...evidence]
    .sort((left, right) => {
      const leftDate = left.metadata?.date ? new Date(left.metadata.date).getTime() : 0;
      const rightDate = right.metadata?.date ? new Date(right.metadata.date).getTime() : 0;
      return rightDate - leftDate;
    })
    .slice(0, 5)
    .map((item) => `${item.metadata?.date ? new Date(item.metadata.date).toISOString().slice(0, 10) : 'unknown date'} — ${item.title}`)
    .join('; ');

  return {
    summary: `Found ${evidence.length} relevant commit${evidence.length === 1 ? '' : 's'}. Timeline: ${timeline}.`,
    evidence,
    warnings: [],
  };
}

module.exports = { investigateGitHistory };
