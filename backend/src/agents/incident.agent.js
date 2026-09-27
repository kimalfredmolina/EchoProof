const { searchIncidents } = require('../services/retrieval.service');

async function investigateHistoricalIncidents({ context, question }) {
  const evidence = await searchIncidents({
    contextId: context._id,
    question,
    limit: 6,
  });

  if (!evidence.length) {
    return {
      summary: 'No saved incidents matched this investigation. Incident storage can remain empty until Phase 7 adds its CRUD workflow.',
      evidence: [],
      warnings: [],
    };
  }

  return {
    summary: `Found ${evidence.length} similar historical incident${evidence.length === 1 ? '' : 's'}: ${evidence.map((item) => item.title).join(', ')}.`,
    evidence,
    warnings: [],
  };
}

module.exports = { investigateHistoricalIncidents };
