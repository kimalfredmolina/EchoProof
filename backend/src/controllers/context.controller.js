const SystemContext = require('../models/SystemContext');

// POST /api/context — create a new system context (repository ingestion entry point)
async function createContext(req, res) {
  const { repoUrl } = req.body;

  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({ error: 'repoUrl is required' });
  }

  // Basic GitHub URL validation
  const match = repoUrl.trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/);
  if (!match) {
    return res.status(400).json({ error: 'Repository URL is invalid. Expected: https://github.com/owner/repo' });
  }

  const owner = match[1];
  const repository = match[2];

  const context = await SystemContext.create({
    repoUrl: repoUrl.trim(),
    owner,
    repository,
    name: `${owner}/${repository}`,
  });

  return res.status(201).json({ contextId: context._id, status: context.status });
}

// GET /api/context/:id — get context details
async function getContext(req, res) {
  const context = await SystemContext.findById(req.params.id);
  if (!context) return res.status(404).json({ error: 'Context not found' });
  return res.json(context);
}

// GET /api/context/:id/status — get ingestion status and progress
async function getContextStatus(req, res) {
  const context = await SystemContext.findById(req.params.id).select(
    'status ingestionProgress'
  );
  if (!context) return res.status(404).json({ error: 'Context not found' });

  return res.json({
    status: context.status,
    progress: context.ingestionProgress.percentage,
    currentStep: context.ingestionProgress.currentStep,
    processedDocuments: context.ingestionProgress.processedDocuments,
    totalDocuments: context.ingestionProgress.totalDocuments,
  });
}

module.exports = { createContext, getContext, getContextStatus };
