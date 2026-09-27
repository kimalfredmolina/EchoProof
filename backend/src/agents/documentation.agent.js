const { searchDocuments } = require('../services/retrieval.service');

async function investigateDocumentation({ context, question }) {
  const evidence = await searchDocuments({
    contextId: context._id,
    question,
    types: ['readme', 'adr', 'design_document'],
    limit: 8,
  });

  if (!evidence.length) {
    return {
      summary: 'No README, ADR, or design-document content matched the investigation terms.',
      evidence: [],
      warnings: [],
    };
  }

  const sourceTypes = [...new Set(evidence.map((item) => item.type.replace('_', ' ')))];
  const decisions = evidence.slice(0, 4).map((item) => item.title).join(', ');

  return {
    summary: `Found ${evidence.length} relevant documentation source${evidence.length === 1 ? '' : 's'} across ${sourceTypes.join(', ')}. Relevant decisions appear in: ${decisions}.`,
    evidence,
    warnings: [],
  };
}

module.exports = { investigateDocumentation };
