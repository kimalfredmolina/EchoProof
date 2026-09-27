const { randomUUID } = require('crypto');
const { investigateCode } = require('./code.agent');
const { investigateDocumentation } = require('./documentation.agent');
const { investigateGitHistory } = require('./git.agent');
const { investigateHistoricalIncidents } = require('./incident.agent');
const { investigatePullRequests } = require('./pullrequest.agent');
const { env } = require('../config/environment');
const { synthesizeInvestigation } = require('../services/llm.service');
const { calculateConfidence, mergeAndDeduplicateEvidence } = require('../utils/evidence');

const AGENTS = [
  { id: 'code', label: 'Code Investigation Agent', investigate: investigateCode },
  { id: 'git', label: 'Git History Agent', investigate: investigateGitHistory },
  { id: 'pullRequest', label: 'Pull Request Agent', investigate: investigatePullRequests },
  { id: 'documentation', label: 'Documentation Agent', investigate: investigateDocumentation },
  { id: 'incident', label: 'Historical Incident Agent', investigate: investigateHistoricalIncidents },
];

class AgentTimeoutError extends Error {}

function withTimeout(promise, timeoutMs) {
  let timeout;
  const deadline = new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new AgentTimeoutError()), timeoutMs);
  });

  return Promise.race([promise, deadline]).finally(() => clearTimeout(timeout));
}

async function executeAgent(agent, input) {
  const startedAt = Date.now();

  try {
    const result = await withTimeout(agent.investigate(input), env.AGENT_TIMEOUT_MS);
    const evidence = Array.isArray(result.evidence) ? result.evidence : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];
    const status = evidence.length
      ? warnings.length ? 'partial' : 'completed'
      : warnings.length ? 'unavailable' : 'no_evidence';

    return {
      id: agent.id,
      label: agent.label,
      status,
      summary: result.summary || 'Investigation completed without a summary.',
      evidence,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const timedOut = error instanceof AgentTimeoutError;
    console.error(`[agent:${agent.id}] Investigation ${timedOut ? 'timed out' : 'failed'}:`, error.message);
    return {
      id: agent.id,
      label: agent.label,
      status: timedOut ? 'unavailable' : 'failed',
      summary: timedOut
        ? 'This agent reached its investigation deadline.'
        : 'This agent could not complete its investigation.',
      evidence: [],
      warnings: [timedOut ? 'Agent investigation timed out.' : 'Agent investigation failed unexpectedly.'],
      durationMs: Date.now() - startedAt,
    };
  }
}

async function runInvestigation({ context, question }) {
  const investigationId = randomUUID();
  const startedAt = new Date();

  // Every repository question benefits from corroboration across these independent domains.
  // Each agent handles an empty source honestly, while Promise.all runs all investigations concurrently.
  const agentResults = await Promise.all(
    AGENTS.map((agent) => executeAgent(agent, { context, question }))
  );

  const evidence = mergeAndDeduplicateEvidence(agentResults);
  const confidence = calculateConfidence(evidence);
  const answer = await synthesizeInvestigation({
    question,
    evidence,
    agentResults,
    confidence,
  });
  const warnings = [...new Set([
    ...agentResults.flatMap((agent) => agent.warnings),
    ...(answer.warning ? [answer.warning] : []),
  ])];

  return {
    investigationId,
    question,
    context: {
      id: String(context._id),
      repository: context.name || `${context.owner}/${context.repository}`,
    },
    status: evidence.length ? warnings.length ? 'partial' : 'completed' : 'insufficient_evidence',
    insufficientEvidence: evidence.length === 0,
    confidence,
    answer: {
      summary: answer.summary,
      rootCause: answer.rootCause,
      why: answer.why,
      supportingEvidenceIds: answer.supportingEvidenceIds,
      generatedBy: answer.generatedBy,
    },
    agents: agentResults.map((agent) => ({
      id: agent.id,
      label: agent.label,
      status: agent.status,
      summary: agent.summary,
      evidenceCount: agent.evidence.length,
      warnings: agent.warnings,
      durationMs: agent.durationMs,
    })),
    evidence,
    warnings,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
  };
}

module.exports = { AGENTS, AgentTimeoutError, executeAgent, runInvestigation, withTimeout };
