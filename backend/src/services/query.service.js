const { runInvestigation } = require('../agents/orchestrator.agent');

/**
 * Canonical query entry point shared by the Phase 4 API and Phase 5 orchestrator.
 * Retrieval, ranking, evidence merging, and synthesis are owned by the agents and
 * their shared services so the two phases cannot drift into separate pipelines.
 *
 * @param {object} context Ready SystemContext document
 * @param {string} question Developer's natural-language question
 * @returns {Promise<object>} Multi-agent investigation response
 */
async function runQuery(context, question) {
  if (!context?._id) throw new Error('A ready system context is required');
  return runInvestigation({ context, question });
}

module.exports = { runQuery };
