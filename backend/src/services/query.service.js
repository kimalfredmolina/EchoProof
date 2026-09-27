const Document = require('../models/Document');
const Incident = require('../models/Incident');
const { generate } = require('./groq.service');

// ---------------------------------------------------------------------------
// Step 1 — Question Analysis
// Extract key terms so we can do targeted keyword retrieval.
// ---------------------------------------------------------------------------

/**
 * Ask Gemini to extract the most important search keywords from the question.
 * Returns an array of 3–8 lowercased terms.
 * @param {string} question
 * @returns {Promise<string[]>}
 */
async function extractKeyTerms(question) {
  const prompt = `Extract 3 to 8 important search keywords from this software engineering question.
Return ONLY a JSON array of lowercase strings. No explanation, no markdown, just the array.

Question: "${question}"`;

  try {
    const text = await generate(prompt);
    // Strip any accidental markdown fences
    const cleaned = text.replace(/```json|```/g, '').trim();
    const terms = JSON.parse(cleaned);
    if (Array.isArray(terms)) return terms.map((t) => String(t).toLowerCase());
  } catch {
    // Fallback: split the question into words
  }

  return question
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8);
}

// ---------------------------------------------------------------------------
// Step 2 — Parallel Retrieval
// No vector index yet (Phase 3 not done), so we do keyword / regex search
// across MongoDB with parallel queries per document type.
// ---------------------------------------------------------------------------

const RETRIEVE_LIMIT = 6; // max docs per source type

/**
 * Build a MongoDB $regex query that matches any of the key terms.
 * @param {string[]} terms
 * @returns {object} mongoose condition
 */
function buildTextFilter(terms) {
  if (!terms.length) return {};
  const pattern = terms.join('|');
  return { $regex: pattern, $options: 'i' };
}

/**
 * Retrieve relevant documents from MongoDB using keyword matching.
 * Runs queries for each document type in parallel.
 * @param {string} contextId
 * @param {string[]} terms
 * @returns {Promise<object[]>} combined list of documents
 */
async function retrieveDocuments(contextId, terms) {
  const textFilter = buildTextFilter(terms);

  const contentMatch = textFilter.$regex
    ? { contextId, $or: [{ content: textFilter }, { title: textFilter }] }
    : { contextId };

  const types = ['pull_request', 'commit', 'adr', 'design_document', 'readme'];

  // Run a limited query per type in parallel
  const perTypeQueries = types.map((type) =>
    Document.find({ ...contentMatch, type })
      .limit(RETRIEVE_LIMIT)
      .select('type title content metadata')
      .lean()
  );

  // Also search saved incidents
  const incidentQuery = Incident.find({
    contextId,
    $or: [
      { title: textFilter.$regex ? textFilter : { $exists: true } },
      { problem: textFilter.$regex ? textFilter : { $exists: true } },
      { rootCause: textFilter.$regex ? textFilter : { $exists: true } },
    ],
  })
    .limit(RETRIEVE_LIMIT)
    .select('title problem rootCause resolution evidence affectedFiles confidence')
    .lean();

  const [docResults, incidents] = await Promise.all([
    Promise.all(perTypeQueries),
    incidentQuery,
  ]);

  const docs = docResults.flat();

  // Tag incidents with a virtual type so the ranker can handle them uniformly
  const incidentDocs = incidents.map((inc) => ({
    _id: inc._id,
    type: 'incident',
    title: inc.title,
    content: [inc.problem, inc.rootCause, inc.resolution].filter(Boolean).join('\n\n'),
    metadata: { incidentId: inc._id, evidence: inc.evidence, confidence: inc.confidence },
  }));

  return [...docs, ...incidentDocs];
}

// ---------------------------------------------------------------------------
// Step 3 — Evidence Ranking
// Score each retrieved chunk by how many key terms appear in it.
// ---------------------------------------------------------------------------

/**
 * Score a document by how many key terms appear in its title + content.
 * @param {object} doc
 * @param {string[]} terms
 * @returns {number}
 */
function scoreDocument(doc, terms) {
  const haystack = `${doc.title || ''} ${doc.content || ''}`.toLowerCase();
  return terms.reduce((acc, term) => {
    const occurrences = (haystack.match(new RegExp(term, 'gi')) || []).length;
    return acc + occurrences;
  }, 0);
}

/**
 * Rank documents by relevance score, highest first.
 * @param {object[]} docs
 * @param {string[]} terms
 * @returns {object[]} sorted docs
 */
function rankDocuments(docs, terms) {
  return docs
    .map((doc) => ({ ...doc, _score: scoreDocument(doc, terms) }))
    .sort((a, b) => b._score - a._score);
}

// ---------------------------------------------------------------------------
// Step 4 — LLM Synthesis
// Send the top-ranked evidence + the original question to Groq and ask for
// a structured answer with root cause, reasoning, confidence, and source refs.
// ---------------------------------------------------------------------------

const MAX_EVIDENCE_CHARS = 12000; // stay well within free-tier context

/**
 * Truncate evidence text to avoid token limit issues.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function truncate(text, maxChars) {
  if (!text) return '';
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
}

/**
 * Format a ranked document into a compact evidence block for the prompt.
 * @param {object} doc
 * @param {number} index
 * @returns {string}
 */
function formatEvidenceBlock(doc, index) {
  const url = doc.metadata?.url || '';
  const author = doc.metadata?.author || '';
  const date = doc.metadata?.date ? new Date(doc.metadata.date).toISOString().slice(0, 10) : '';

  const meta = [url && `URL: ${url}`, author && `Author: ${author}`, date && `Date: ${date}`]
    .filter(Boolean)
    .join(' | ');

  return `[${index + 1}] TYPE: ${doc.type} | TITLE: ${doc.title || '(untitled)'}
${meta}
${truncate(doc.content, 1500)}`;
}

/**
 * Determine confidence based on evidence count and diversity.
 * @param {object[]} rankedDocs
 * @returns {'high'|'medium'|'low'}
 */
function computeConfidence(rankedDocs) {
  const uniqueTypes = new Set(rankedDocs.map((d) => d.type));
  if (rankedDocs.length >= 4 && uniqueTypes.size >= 3) return 'high';
  if (rankedDocs.length >= 2) return 'medium';
  return 'low';
}

/**
 * Synthesize an answer from the question and evidence blocks using Gemini.
 * Returns a structured object: { rootCause, why, answer, confidence, sources }.
 * @param {string} question
 * @param {object[]} rankedDocs
 * @returns {Promise<object>}
 */
async function synthesizeAnswer(question, rankedDocs) {
  const hasEvidence = rankedDocs.length > 0;

  if (!hasEvidence) {
    return {
      rootCause: null,
      why: null,
      answer:
        'Not enough evidence found in the indexed repository to answer this question confidently. ' +
        'The repository may not contain documentation, pull requests, or commits related to this topic.',
      confidence: 'low',
      sources: [],
    };
  }

  // Only use top 10 ranked docs to keep the prompt manageable
  const topDocs = rankedDocs.slice(0, 10);
  let evidenceText = topDocs.map(formatEvidenceBlock).join('\n\n---\n\n');

  // Hard-cap total evidence chars
  if (evidenceText.length > MAX_EVIDENCE_CHARS) {
    evidenceText = evidenceText.slice(0, MAX_EVIDENCE_CHARS) + '\n\n[evidence truncated]';
  }

  const prompt = `You are EchoProof, an AI software maintenance assistant. Analyze the following repository evidence and answer the developer's question.

QUESTION: ${question}

EVIDENCE FROM REPOSITORY:
${evidenceText}

Respond with ONLY a valid JSON object in this exact shape (no markdown, no extra text):
{
  "rootCause": "One or two sentences identifying the core finding. Null if not found.",
  "why": "One or two sentences explaining the motivation or reason. Null if not found.",
  "answer": "A clear, concise answer (2-5 sentences) that directly addresses the question.",
  "confidence": "high | medium | low",
  "sources": [
    {
      "type": "pull_request | commit | adr | design_document | readme | incident",
      "title": "Evidence item title",
      "author": "Author or committer name from the evidence, or empty string if unknown",
      "url": "GitHub URL if available, otherwise empty string",
      "reference": "Short description of what this source shows"
    }
  ]
}

Rules:
- Base your answer ONLY on the evidence provided. Do not use general knowledge.
- If the evidence does not support a conclusion, set rootCause and why to null and explain honestly in "answer".
- For confidence: high = 3+ independent sources; medium = 1-2 sources; low = weak or indirect evidence.
- Include up to 5 of the most relevant sources.
- For "author": use the Author field from the evidence block if present, otherwise use empty string.`;

  const raw = await generate(prompt);
  const cleaned = raw.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Ensure confidence value is valid
    if (!['high', 'medium', 'low'].includes(parsed.confidence)) {
      parsed.confidence = computeConfidence(rankedDocs);
    }
    return parsed;
  } catch {
    // Groq returned non-JSON — wrap the raw text gracefully
    return {
      rootCause: null,
      why: null,
      answer: cleaned,
      confidence: computeConfidence(rankedDocs),
      sources: topDocs.slice(0, 5).map((doc) => ({
        type: doc.type,
        title: doc.title || '(untitled)',
        author: doc.metadata?.author || '',
        url: doc.metadata?.url || '',
        reference: '',
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full Phase 4 query pipeline:
 *   question → key term extraction → parallel retrieval → ranking → LLM synthesis
 *
 * @param {string} contextId  MongoDB ObjectId string of the SystemContext
 * @param {string} question   Developer's natural-language question
 * @returns {Promise<{rootCause, why, answer, confidence, sources, retrievedCount}>}
 */
async function runQuery(contextId, question) {
  // Step 1 — analyse question
  const terms = await extractKeyTerms(question);
  console.log(`[query] Context ${contextId} | terms: ${terms.join(', ')}`);

  // Step 2 — parallel retrieval
  const docs = await retrieveDocuments(contextId, terms);
  console.log(`[query] Retrieved ${docs.length} documents`);

  // Step 3 — rank
  const ranked = rankDocuments(docs, terms);

  // Step 4 — synthesize
  const result = await synthesizeAnswer(question, ranked);

  return {
    ...result,
    retrievedCount: docs.length,
  };
}

module.exports = { runQuery };
