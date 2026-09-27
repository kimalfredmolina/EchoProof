const SystemContext = require('../models/SystemContext');
const { runQuery } = require('../services/query.service');

/**
 * POST /api/context/:id/query
 * Body: { "question": "..." }
 *
 * Runs the full Phase 4 pipeline against the indexed repository documents
 * and returns a structured answer with evidence and confidence.
 */
async function queryContext(req, res) {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  // Verify the context exists and is ready
  const context = await SystemContext.findById(req.params.id).select('status').lean();
  if (!context) {
    return res.status(404).json({ error: 'Context not found' });
  }
  if (context.status !== 'ready') {
    return res.status(409).json({
      error: `Repository is not ready for queries. Current status: ${context.status}`,
    });
  }

  const result = await runQuery(req.params.id, question.trim());

  return res.json({
    question: question.trim(),
    ...result,
  });
}

module.exports = { queryContext };
