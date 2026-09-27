const Document = require('../models/Document');
const Incident = require('../models/Incident');
const { cleanText } = require('../utils/evidence');

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'been', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'should', 'that', 'the', 'their',
  'then', 'this', 'to', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who',
  'why', 'will', 'with', 'would', 'you', 'your',
]);

const SHORT_TECHNICAL_TERMS = new Set(['ai', 'api', 'db', 'id', 'pr', 'ui']);

function stemTerm(term) {
  if (term.length <= 5) return term;
  if (term.endsWith('ing')) return term.slice(0, -3);
  if (term.endsWith('ed')) return term.slice(0, -2);
  if (term.endsWith('es')) return term.slice(0, -2);
  if (term.endsWith('s')) return term.slice(0, -1);
  return term;
}

function tokenize(value) {
  const rawTerms = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return [...new Set(rawTerms
    .filter((term) => !STOP_WORDS.has(term))
    .filter((term) => term.length >= 3 || SHORT_TECHNICAL_TERMS.has(term))
    .flatMap((term) => [term, stemTerm(term)])
    .filter(Boolean))];
}

function countOccurrences(text, term) {
  if (!term || !text) return 0;
  let count = 0;
  let position = text.indexOf(term);
  while (position !== -1 && count < 5) {
    count += 1;
    position = text.indexOf(term, position + term.length);
  }
  return count;
}

function scoreText(terms, fields) {
  return fields.reduce((total, field) => {
    const text = String(field.value || '').toLowerCase();
    const weight = field.weight || 1;
    return total + terms.reduce(
      (score, term) => score + countOccurrences(text, term) * weight,
      0
    );
  }, 0);
}

function excerptAroundTerms(content, terms, maxLength = 600) {
  const text = String(content || '').replace(/\r/g, '').trim();
  if (!text) return '';

  const lower = text.toLowerCase();
  const indexes = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const matchIndex = indexes.length ? Math.min(...indexes) : 0;
  const start = Math.max(0, matchIndex - Math.floor(maxLength / 3));
  const excerpt = text.slice(start, start + maxLength);
  return cleanText(`${start > 0 ? '…' : ''}${excerpt}${start + maxLength < text.length ? '…' : ''}`, maxLength);
}

function documentToEvidence(document, terms, score, includeContent) {
  const metadata = document.metadata || {};
  const evidence = {
    id: String(document._id),
    type: document.type,
    title: document.title,
    url: metadata.url,
    reference: metadata.sha
      ? `Commit ${metadata.sha.slice(0, 12)}`
      : metadata.pullRequestNumber != null
        ? `PR #${metadata.pullRequestNumber}`
        : metadata.filePath || '',
    excerpt: excerptAroundTerms(document.content, terms),
    score,
    metadata,
  };

  if (includeContent) evidence.content = document.content;
  return evidence;
}

async function searchDocuments({ contextId, question, types, limit = 8, includeContent = false }) {
  const terms = tokenize(question);
  if (!terms.length || !types?.length) return [];

  const documents = await Document.find({ contextId, type: { $in: types } })
    .select('type title content metadata createdAt')
    .sort({ 'metadata.date': -1, createdAt: -1 })
    .limit(500)
    .lean();

  return documents
    .map((document) => {
      const metadata = document.metadata || {};
      const score = scoreText(terms, [
        { value: document.title, weight: 5 },
        { value: document.content, weight: 1 },
        { value: metadata.filePath, weight: 4 },
        { value: metadata.sha, weight: 3 },
        { value: metadata.author, weight: 2 },
      ]);
      return documentToEvidence(document, terms, score, includeContent);
    })
    .filter((evidence) => evidence.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

/**
 * Compute a similarity bonus from a stored keyword embedding.
 * The embedding is stored as flat [hash, freq, hash, freq, ...] pairs
 * produced by buildKeywordEmbedding() in incident.controller.js.
 * We hash each query term the same way and look for overlaps.
 * @param {number[]} embedding
 * @param {string[]} terms
 * @returns {number}
 */
function embeddingSimilarityBonus(embedding, terms) {
  if (!Array.isArray(embedding) || embedding.length < 2) return 0;

  // Rebuild hash → freq map from the stored flat array
  const stored = new Map();
  for (let i = 0; i + 1 < embedding.length; i += 2) {
    stored.set(embedding[i], embedding[i + 1]);
  }

  let bonus = 0;
  for (const term of terms) {
    let hash = 5381;
    for (let i = 0; i < term.length; i++) {
      hash = ((hash << 5) + hash + term.charCodeAt(i)) >>> 0;
    }
    if (stored.has(hash)) bonus += stored.get(hash);
  }
  return bonus;
}

async function searchIncidents({ contextId, question, limit = 6 }) {
  const terms = tokenize(question);
  if (!terms.length) return [];

  const incidents = await Incident.find({ contextId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return incidents
    .map((incident) => {
      const textScore = scoreText(terms, [
        { value: incident.title, weight: 5 },
        { value: incident.problem, weight: 3 },
        { value: incident.rootCause, weight: 3 },
        { value: incident.resolution, weight: 2 },
        { value: (incident.affectedFiles || []).join(' '), weight: 4 },
      ]);
      // Embedding bonus rewards incidents whose stored keyword distribution
      // overlaps with the current query terms — wires Phase 7 embedding storage
      // into the Historical Incident Agent without a full vector index.
      const embeddingBonus = embeddingSimilarityBonus(incident.embedding, terms);
      const score = textScore + embeddingBonus;

      const linkedEvidence = (incident.evidence || []).find((item) => item.url);
      return {
        id: String(incident._id),
        type: 'incident',
        title: incident.title,
        url: linkedEvidence?.url || '',
        reference: `Incident ${String(incident._id).slice(-8)}`,
        excerpt: excerptAroundTerms(
          `Problem: ${incident.problem}\nRoot cause: ${incident.rootCause}\nResolution: ${incident.resolution}`,
          terms
        ),
        score,
        metadata: {
          date: incident.createdAt,
          filePath: (incident.affectedFiles || [])[0] || '',
          confidence: incident.confidence || '',
        },
      };
    })
    .filter((evidence) => evidence.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

module.exports = {
  excerptAroundTerms,
  scoreText,
  searchDocuments,
  searchIncidents,
  tokenize,
};
