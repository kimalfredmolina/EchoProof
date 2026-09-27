const mongoose = require('mongoose');

const ingestionProgressSchema = new mongoose.Schema(
  {
    totalDocuments: { type: Number, default: 0 },
    processedDocuments: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    currentStep: { type: String, default: '' },
    lastSuccessfulStep: { type: String, default: '' },
  },
  { _id: false }
);

const systemContextSchema = new mongoose.Schema(
  {
    repoUrl: { type: String, required: true, trim: true },
    owner: { type: String, required: true, trim: true },
    repository: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
    description: { type: String, default: '' },

    repositoryVisibility: {
      type: String,
      enum: ['public', 'private', 'unknown'],
      default: 'unknown',
    },

    status: {
      type: String,
      enum: ['pending', 'indexing', 'ready', 'failed'],
      default: 'pending',
    },

    ingestionProgress: {
      type: ingestionProgressSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemContext', systemContextSchema);
