const mongoose = require('mongoose');

const evidenceItemSchema = new mongoose.Schema(
  {
    type: { type: String, default: '' },
    title: { type: String, default: '' },
    url: { type: String, default: '' },
    reference: { type: String, default: '' },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    contextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SystemContext',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },

    problem: { type: String, default: '' },

    rootCause: { type: String, default: '' },

    resolution: { type: String, default: '' },

    evidence: {
      type: [evidenceItemSchema],
      default: [],
    },

    affectedFiles: {
      type: [String],
      default: [],
    },

    generatedTests: {
      type: [String],
      default: [],
    },

    verificationResult: { type: String, default: '' },

    confidence: {
      type: String,
      enum: ['high', 'medium', 'low', ''],
      default: '',
    },

    // Embedding used by Historical Incident Agent for semantic similarity search
    embedding: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Incident', incidentSchema);
