const path = require('path');
const { fetchRelevantSourceFiles } = require('../services/github.service');
const {
  excerptAroundTerms,
  scoreText,
  searchDocuments,
  tokenize,
} = require('../services/retrieval.service');

function extractChangedFiles(historyEvidence) {
  const files = new Set();

  for (const evidence of historyEvidence) {
    const content = String(evidence.content || '');
    const markerIndex = content.lastIndexOf('Changed files:');
    if (markerIndex === -1) continue;

    for (const line of content.slice(markerIndex + 'Changed files:'.length).split('\n')) {
      const candidate = line.trim().replace(/^[-*]\s*/, '');
      if (candidate && !candidate.includes(' ') && candidate.includes('/')) files.add(candidate);
      if (candidate && !candidate.includes(' ') && candidate.includes('.')) files.add(candidate);
    }
  }

  return [...files].slice(0, 30);
}

function withoutExtension(filePath) {
  return filePath.replace(/\.[^/.]+$/, '').toLowerCase();
}

function findExecutionRelationships(files) {
  const relationships = new Set();
  const knownPaths = files.map((file) => file.path.replace(/\\/g, '/'));
  const importPattern = /(?:from\s+|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

  for (const file of files) {
    let match = importPattern.exec(file.content);
    while (match) {
      const specifier = match[1];
      if (specifier.startsWith('.')) {
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier));
        const target = knownPaths.find((knownPath) => {
          const normalized = withoutExtension(knownPath);
          return normalized === withoutExtension(resolved)
            || normalized === `${withoutExtension(resolved)}/index`;
        });
        if (target) relationships.add(`${file.path} → ${target}`);
      }
      match = importPattern.exec(file.content);
    }
  }

  return [...relationships].slice(0, 8);
}

async function investigateCode({ context, question }) {
  const indexedCode = await searchDocuments({
    contextId: context._id,
    question,
    types: ['source_code'],
    limit: 8,
  });

  const relatedHistory = await searchDocuments({
    contextId: context._id,
    question,
    types: ['commit', 'pull_request'],
    limit: 12,
    includeContent: true,
  });
  const candidatePaths = extractChangedFiles(relatedHistory);

  try {
    const result = await fetchRelevantSourceFiles(context.owner, context.repository, {
      question,
      candidatePaths,
      limit: 8,
    });
    const terms = tokenize(question);
    const sourceEvidence = result.files.map((file) => ({
      type: 'source_code',
      title: file.path,
      url: file.url,
      reference: file.path,
      excerpt: excerptAroundTerms(file.content, terms),
      score: Math.max(file.relevance, scoreText(terms, [
        { value: file.path, weight: 5 },
        { value: file.content, weight: 1 },
      ])),
      metadata: { filePath: file.path, url: file.url },
    }));
    const relationships = findExecutionRelationships(result.files);
    const relationshipSummary = relationships.length
      ? ` Observed import relationships: ${relationships.join('; ')}.`
      : ' No direct import relationship was visible among the selected files.';

    if (!sourceEvidence.length && !indexedCode.length) {
      return {
        summary: candidatePaths.length
          ? `History identified candidate files (${candidatePaths.slice(0, 8).join(', ')}), but their current source could not be inspected.`
          : 'No source files or changed-file references matched the investigation terms.',
        evidence: [],
        warnings: result.warnings,
      };
    }

    const evidence = [...sourceEvidence, ...indexedCode];
    return {
      summary: `Inspected ${evidence.length} relevant source file${evidence.length === 1 ? '' : 's'}: ${evidence.map((item) => item.title).join(', ')}.${relationshipSummary}`,
      evidence,
      warnings: result.warnings,
    };
  } catch (error) {
    console.warn('[agent:code] Live source inspection failed:', error.message);
    return {
      summary: candidatePaths.length
        ? `History identified candidate files (${candidatePaths.slice(0, 8).join(', ')}), but live source inspection was unavailable.`
        : 'Live source inspection was unavailable and no indexed source code matched the question.',
      evidence: indexedCode,
      warnings: ['Live GitHub source inspection was unavailable.'],
    };
  }
}

module.exports = { extractChangedFiles, findExecutionRelationships, investigateCode };
