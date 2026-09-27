const { runInvestigation } = require('../agents/orchestrator.agent');

function collectAffectedFiles(evidence) {
  const files = new Set();

  for (const item of evidence) {
    const filePath = item.metadata?.filePath || item.reference;
    if (!filePath || filePath.startsWith('Commit ') || filePath.startsWith('PR ')) continue;
    if (filePath.includes('/') || /\.[a-z0-9]+$/i.test(filePath)) files.add(filePath);
  }

  return [...files].slice(0, 30);
}

function buildRecommendedFix(rootCause, affectedFiles) {
  const files = affectedFiles.length
    ? affectedFiles.join(', ')
    : 'the files identified during developer verification';

  return {
    summary: `Review the suspected root cause, then make the smallest targeted change in ${files}.`,
    rationale: rootCause,
    affectedFiles,
    autoApplied: false,
  };
}

function buildRecommendedTests(affectedFiles) {
  const target = affectedFiles[0] || 'the affected code path';
  return [
    `Add a regression test that reproduces the reported failure in ${target}.`,
    'Add a success-case test to confirm the existing behavior remains intact.',
    'Add an edge-case test for invalid, missing, or boundary input described by the bug report.',
  ];
}

async function runDebuggingWorkflow({ context, bugReport }) {
  const investigation = await runInvestigation({ context, question: bugReport });
  const affectedFiles = collectAffectedFiles(investigation.evidence);
  const historicalIncidents = investigation.evidence.filter((item) => item.type === 'incident');
  const rootCause = investigation.answer.rootCause;

  return {
    debuggingId: investigation.investigationId,
    status: investigation.status,
    problem: bugReport,
    rootCause,
    why: investigation.answer.why,
    evidence: investigation.evidence,
    affectedFiles,
    historicalIncidents,
    recommendedFix: buildRecommendedFix(rootCause, affectedFiles),
    recommendedTests: buildRecommendedTests(affectedFiles),
    confidence: investigation.confidence,
    agents: investigation.agents,
    warnings: investigation.warnings,
    startedAt: investigation.startedAt,
    completedAt: investigation.completedAt,
  };
}

module.exports = {
  buildRecommendedFix,
  buildRecommendedTests,
  collectAffectedFiles,
  runDebuggingWorkflow,
};