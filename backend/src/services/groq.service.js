const Groq = require('groq-sdk');
const { env } = require('../config/environment');

let _client = null;

/**
 * Returns a singleton Groq client.
 */
function getClient() {
  if (!_client) {
    if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
    _client = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return _client;
}

/**
 * Send a prompt to Groq and return the text response.
 * Uses openai/gpt-oss-120b — available on the free tier.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function generate(prompt) {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });
  return completion.choices[0]?.message?.content || '';
}

module.exports = { generate };
