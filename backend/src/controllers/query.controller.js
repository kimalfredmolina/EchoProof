const mongoose = require('mongoose');
const SystemContext = require('../models/SystemContext');
const { isPrivateRepositoryAllowed } = require('../services/repository-access.service');
const { runQuery } = require('../services/query.service');

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
  if (
    context.repositoryVisibility === 'private'
    && !isPrivateRepositoryAllowed(context.owner, context.repository)
  ) {
    return res.status(403).json({
      error: 'Private repository is not allowed by this server',
    });
  }

  const investigation = await runQuery(context, question);
  return res.json(investigation);
}

module.exports = { queryContext };
