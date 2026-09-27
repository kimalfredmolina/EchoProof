require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const env = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  OPENAI_TIMEOUT_MS: Number(process.env.OPENAI_TIMEOUT_MS) || 20000,
  ALLOW_EXTERNAL_SYNTHESIS: process.env.ALLOW_EXTERNAL_SYNTHESIS === 'true',
  AGENT_TIMEOUT_MS: Number(process.env.AGENT_TIMEOUT_MS) || 15000,
  GITHUB_TIMEOUT_MS: Number(process.env.GITHUB_TIMEOUT_MS) || 10000,
  QUERY_RATE_LIMIT_MAX: Number(process.env.QUERY_RATE_LIMIT_MAX) || 10,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};

const required = ['MONGODB_URI', 'GITHUB_TOKEN', 'GROQ_API_KEY'];

function validateEnv() {
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    console.warn(`[env] Warning: missing environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { env, validateEnv };
