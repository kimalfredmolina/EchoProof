const mongoose = require('mongoose');
const SystemContext = require('../models/SystemContext');
const Incident = require('../models/Incident');
const { tokenize } = require('../services/retrieval.service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that the contextId param is a valid ObjectId and that the
 * referenced SystemContext exists.
 * Returns the context doc or throws (which Express 5 forwards to the error handler).
 */
async function requireContext(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Context ID is invalid');
    err.status = 400;
    throw err;
  }
  const context = await SystemContext.findById(id).select('_id status').lean();
  if (!context) {
    const err = new Error('Context not found');
    err.status = 404;
    throw err;
  }
  return context;
}

/**
 * Generate a lightweight keyword embedding from the incident text fields.
 * Stored as a sparse array of term-frequency pairs encoded as a flat number array:
 *   [termHash1, freq1, termHash2, freq2, ...]
 *
 * Phase 3 will replace this with proper dense vectors. For now this gives
 * searchIncidents something richer than pure text scanning.
 *
 * @param {object} fields  { title, problem, rootCause, resolution, affectedFiles }
 * @returns {number[]}
 */
function buildKeywordEmbedding({ title, problem, rootCause, resolution, affectedFiles }) {
  const text = [
    title,
    problem,
    rootCause,
    resolution,
    ...(Array.isArray(affectedFiles) ? affectedFiles : []),
  ]
    .filter(Boolean)
    .join(' ');

  const terms = tokenize(text);
  const freq = {};
  for (const term of terms) {
    freq[term] = (freq[term] || 0) + 1;
  }

  // Encode as flat [hashCode, count, ...] pairs so it fits in the Number[] field.
  // We use a simple djb2-style hash to convert the term string to a number.
  const result = [];
  for (const [term, count] of Object.entries(freq)) {
    let hash = 5381;
    for (let i = 0; i < term.length; i++) {
      hash = ((hash << 5) + hash + term.charCodeAt(i)) >>> 0;
    }
    result.push(hash, count);
  }
  return result;
}

// ---------------------------------------------------------------------------
// POST /api/context/:id/incidents  — save a new incident
// ---------------------------------------------------------------------------

async function createIncident(req, res) {
  await requireContext(req.params.id);

  const {
    title,
    problem = '',
    rootCause = '',
    resolution = '',
    evidence = [],
    affectedFiles = [],
    generatedTests = [],
    verificationResult = '',
    confidence = '',
  } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const validConfidence = ['high', 'medium', 'low', ''].includes(confidence) ? confidence : '';

  const embedding = buildKeywordEmbedding({
    title,
    problem,
    rootCause,
    resolution,
    affectedFiles,
  });

  const incident = await Incident.create({
    contextId: req.params.id,
    title: title.trim(),
    problem,
    rootCause,
    resolution,
    evidence: Array.isArray(evidence)
      ? evidence.map((e) => ({
          type: e.type || '',
          title: e.title || '',
          url: e.url || '',
          reference: e.reference || '',
        }))
      : [],
    affectedFiles: Array.isArray(affectedFiles) ? affectedFiles.filter(Boolean) : [],
    generatedTests: Array.isArray(generatedTests) ? generatedTests.filter(Boolean) : [],
    verificationResult,
    confidence: validConfidence,
    embedding,
  });

  console.log(`[incidents] Created incident ${incident._id} for context ${req.params.id}`);
  return res.status(201).json(incident);
}

// ---------------------------------------------------------------------------
// GET /api/context/:id/incidents  — list incidents (newest first)
// ---------------------------------------------------------------------------

async function listIncidents(req, res) {
  await requireContext(req.params.id);

  const incidents = await Incident.find({ contextId: req.params.id })
    .select('-embedding')        // embedding is internal, no need to send to client
    .sort({ createdAt: -1 })
    .lean();

  return res.json(incidents);
}

// ---------------------------------------------------------------------------
// GET /api/context/:id/incidents/:incidentId  — get one incident
// ---------------------------------------------------------------------------

async function getIncident(req, res) {
  await requireContext(req.params.id);

  if (!mongoose.isValidObjectId(req.params.incidentId)) {
    return res.status(400).json({ error: 'Incident ID is invalid' });
  }

  const incident = await Incident.findOne({
    _id: req.params.incidentId,
    contextId: req.params.id,
  })
    .select('-embedding')
    .lean();

  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  return res.json(incident);
}

module.exports = { createIncident, listIncidents, getIncident };
