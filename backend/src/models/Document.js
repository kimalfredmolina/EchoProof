const mongoose = require('mongoose');

const DOCUMENT_TYPES = [
  'pull_request',
  'commit',
  'design_document',
  'adr',
  'readme',
  'issue',
  'source_code',
  'incident',
];

const metadataSchema = new mongoose.Schema(
  {
    url: { type: String, default: '' },
    author: { type: String, default: '' },
    date: { type: Date, default: null },
    sha: { type: String, default: '' },
    pullRequestNumber: { type: Number, default: null },
    filePath: { type: String, default: '' },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    contextId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SystemContext',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: DOCUMENT_TYPES,
      required: true,
    },

    title: { type: String, default: '' },

    content: { type: String, required: true },

    metadata: {
      type: metadataSchema,
      default: () => ({}),
    },

    // Vector embedding stored as array of numbers
    embedding: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Document', documentSchema);
