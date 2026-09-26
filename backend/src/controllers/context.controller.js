const SystemContext = require('../models/SystemContext');
const { fetchRepoMetadata } = require('../services/github.service');

// POST /api/context — create a new system context and kick off metadata fetch
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

  // Create the context record immediately so the caller gets a contextId
  const context = await SystemContext.create({
    repoUrl: repoUrl.trim(),
    owner,
    repository,
    name: `${owner}/${repository}`,
    status: 'pending',
  });

  // Fetch metadata asynchronously — do not await so the response is returned immediately
  fetchRepoMetadata(owner, repository)
    .then(async (meta) => {
      await SystemContext.findByIdAndUpdate(context._id, {
        name: meta.fullName,
        description: meta.description,
      });
    })
    .catch((err) => {
      console.error(`[github] Failed to fetch metadata for ${owner}/${repository}:`, err.message);
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
