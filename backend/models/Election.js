const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['upcoming', 'active', 'ended'], default: 'active' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  totalRegisteredVoters: { type: Number, default: 0 },
  isSealed: { type: Boolean, default: false },
  sealedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Election', electionSchema);
