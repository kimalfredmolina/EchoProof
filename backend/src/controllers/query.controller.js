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
}

module.exports = { queryContext };
