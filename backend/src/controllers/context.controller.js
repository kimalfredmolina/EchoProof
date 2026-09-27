const SystemContext = require('../models/SystemContext');
const { runIngestion } = require('../services/ingestion.service');
const { isPrivateRepositoryAllowed } = require('../services/repository-access.service');

function canAccessContext(context) {
  return context.repositoryVisibility !== 'private'
    || isPrivateRepositoryAllowed(context.owner, context.repository);
}

// POST /api/context — create a new system context and start background ingestion
async function createContext(req, res) {
  const { repoUrl } = req.body;

  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({ error: 'repoUrl is required' });
  }

  // Validate GitHub URL format
  const match = repoUrl.trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/);
  if (!match) {
    return res.status(400).json({
      error: 'Repository URL is invalid. Expected: https://github.com/owner/repo',
    });
  }

  const owner = match[1];
  const repository = match[2];

  // Create the context record immediately so the caller gets a contextId back right away
  const context = await SystemContext.create({
    repoUrl: repoUrl.trim(),
    owner,
    repository,
    name: `${owner}/${repository}`,
    status: 'pending',
  });

  // Run the full ingestion pipeline in the background — do not await
  runIngestion(context._id.toString(), owner, repository);

  return res.status(201).json({ contextId: context._id, status: context.status });
}

// GET /api/context/:id — get context details
async function getContext(req, res) {
  const context = await SystemContext.findById(req.params.id);
  if (!context) return res.status(404).json({ error: 'Context not found' });
  if (!canAccessContext(context)) {
    return res.status(403).json({ error: 'Private repository is not allowed by this server' });
  }
  return res.json(context);
}

// GET /api/context/:id/status — get ingestion status and progress
async function getContextStatus(req, res) {
  const context = await SystemContext.findById(req.params.id).select(
    'owner repository repositoryVisibility status ingestionProgress'
  );
  if (!context) return res.status(404).json({ error: 'Context not found' });
  if (!canAccessContext(context)) {
    return res.status(403).json({ error: 'Private repository is not allowed by this server' });
  }

  return res.json({
    status: context.status,
    progress: context.ingestionProgress.percentage,
    currentStep: context.ingestionProgress.currentStep,
    lastSuccessfulStep: context.ingestionProgress.lastSuccessfulStep,
    processedDocuments: context.ingestionProgress.processedDocuments,
    totalDocuments: context.ingestionProgress.totalDocuments,
  });
}

module.exports = { createContext, getContext, getContextStatus };
