const mongoose = require('mongoose');
const SystemContext = require('../models/SystemContext');
const { isPrivateRepositoryAllowed } = require('../services/repository-access.service');
const { runDebuggingWorkflow } = require('../services/debugging.service');

const MAX_BUG_REPORT_LENGTH = 5000;

async function debugContext(req, res) {
  const bugReport = typeof req.body?.bugReport === 'string' ? req.body.bugReport.trim() : '';

  if (!bugReport) return res.status(400).json({ error: 'bugReport is required' });
  if (bugReport.length > MAX_BUG_REPORT_LENGTH) {
    return res.status(400).json({
      error: `bugReport must be ${MAX_BUG_REPORT_LENGTH} characters or fewer`,
    });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Context ID is invalid' });
  }

  const context = await SystemContext.findById(req.params.id).lean();
  if (!context) return res.status(404).json({ error: 'Context not found' });
  if (context.status !== 'ready') {
    return res.status(409).json({
      error: 'Context is not ready for debugging',
      status: context.status,
    });
  }
  if (
    context.repositoryVisibility === 'private'
    && !isPrivateRepositoryAllowed(context.owner, context.repository)
  ) {
    return res.status(403).json({ error: 'Private repository is not allowed by this server' });
  }

  const report = await runDebuggingWorkflow({ context, bugReport });
  return res.json(report);
}

module.exports = { debugContext };