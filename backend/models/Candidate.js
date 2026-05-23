const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  party: { type: String, required: true },
  partyColor: { type: String, default: '#4f46e5' },
  partyShortName: { type: String },
  bio: { type: String },
  avatar: { type: String }, // emoji or URL
  slogan: { type: String },
  position: { type: Number, default: 0 }, // display order
  electionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Election' },
});

module.exports = mongoose.model('Candidate', candidateSchema);
