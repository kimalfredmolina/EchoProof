<<<<<<< HEAD
const mongoose = require('mongoose');
const SystemContext = require('../models/SystemContext');
const { runInvestigation } = require('../agents/orchestrator.agent');

const MAX_QUESTION_LENGTH = 2000;

async function queryContext(req, res) {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer`,
    });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Context ID is invalid' });
  }

  const context = await SystemContext.findById(req.params.id).lean();
  if (!context) return res.status(404).json({ error: 'Context not found' });
  if (context.status !== 'ready') {
    return res.status(409).json({
      error: 'Context is not ready for investigation',
      status: context.status,
    });
  }
  if (context.repositoryVisibility !== 'public') {
    return res.status(403).json({
      error: 'Only verified public repositories can be queried in this unauthenticated deployment',
    });
  }

  const investigation = await runInvestigation({ context, question });
  return res.json(investigation);
=======
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
>>>>>>> 5433b523a80aa430b2a949d4d379219c9a6d8db6
}

module.exports = { queryContext };
