require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const env = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
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
