function cleanText(value, maxLength = 600) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function canonicalizeUrl(value) {
  if (!value) return '';

  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString();
  } catch {
    return String(value).trim().replace(/\/$/, '');
  }
}

function evidenceKey(evidence) {
  const metadata = evidence.metadata || {};
  const type = evidence.type || 'unknown';

  // Preserve distinct entities even when an incident links to a commit or PR URL.
  if (type === 'incident' && (evidence.id || evidence._id)) return `incident:${evidence.id || evidence._id}`;
  if (type === 'commit' && metadata.sha) return `commit:${String(metadata.sha).toLowerCase()}`;
  if (type === 'pull_request' && metadata.pullRequestNumber != null) return `pr:${metadata.pullRequestNumber}`;
  if (type === 'source_code' && metadata.filePath) return `file:${String(metadata.filePath).toLowerCase()}`;

  const url = canonicalizeUrl(evidence.url || metadata.url);
  if (url) return `${type}:url:${url}`;
  if (evidence.reference) return `${type}:reference:${String(evidence.reference).toLowerCase()}`;
  if (evidence.id || evidence._id) return `${type}:id:${evidence.id || evidence._id}`;

  return `content:${type}:${cleanText(evidence.title, 160).toLowerCase()}`;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeEvidence(evidence, sourceAgent = '') {
  const metadata = evidence.metadata || {};
  const sourceAgents = new Set(evidence.sourceAgents || []);
  if (sourceAgent) sourceAgents.add(sourceAgent);

  return {
    id: evidenceKey(evidence),
    type: evidence.type || 'unknown',
    title: cleanText(evidence.title || 'Untitled source', 240),
    url: canonicalizeUrl(evidence.url || metadata.url),
    reference: cleanText(evidence.reference || '', 160),
    excerpt: cleanText(evidence.excerpt || evidence.content || '', 700),
    score: Number.isFinite(evidence.score) ? Math.max(0, evidence.score) : 0,
    metadata: {
      author: cleanText(metadata.author || '', 120),
      date: normalizeDate(metadata.date),
      sha: cleanText(metadata.sha || '', 80),
      pullRequestNumber: metadata.pullRequestNumber ?? null,
      filePath: cleanText(metadata.filePath || '', 300),
    },
    sourceAgents: [...sourceAgents],
  };
}

function mergeAndDeduplicateEvidence(agentResults) {
  const merged = new Map();

  for (const result of agentResults) {
    for (const item of result.evidence || []) {
      const evidence = normalizeEvidence(item, result.id);
      const existing = merged.get(evidence.id);

      if (!existing) {
        merged.set(evidence.id, evidence);
        continue;
      }

      const sourceAgents = new Set([...existing.sourceAgents, ...evidence.sourceAgents]);
      const preferred = evidence.score > existing.score ? evidence : existing;
      merged.set(evidence.id, {
        ...preferred,
        score: Math.max(existing.score, evidence.score),
        sourceAgents: [...sourceAgents],
      });
    }
  }

  return [...merged.values()].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const rightDate = right.metadata.date || '';
    const leftDate = left.metadata.date || '';
    return rightDate.localeCompare(leftDate);
  });
}

function calculateConfidence(evidence) {
  if (evidence.length === 0) return 'low';

  const agents = new Set(evidence.flatMap((item) => item.sourceAgents));
  const types = new Set(evidence.map((item) => item.type));

  if (evidence.length >= 5 && agents.size >= 3 && types.size >= 3) return 'high';
  if (evidence.length >= 2 && (agents.size >= 2 || types.size >= 2)) return 'medium';
  return 'low';
}

module.exports = {
  calculateConfidence,
  canonicalizeUrl,
  cleanText,
  evidenceKey,
  mergeAndDeduplicateEvidence,
  normalizeEvidence,
};
