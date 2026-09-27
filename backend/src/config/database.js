const mongoose = require('mongoose');
const { env } = require('./environment');

async function connectDatabase() {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('[db] MongoDB connected successfully');
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDatabase };
