const mongoose = require('mongoose');

const voterSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  password: { type: String }, // Used only for admin accounts
  voterId: { type: String, unique: true }, // anonymized hash
  hasVoted: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
  otpAttempts: { type: Number, default: 0 },
  kyberPublicKey: { type: String },
  dilithiumPublicKey: { type: String },
  role: { type: String, enum: ['voter', 'admin'], default: 'voter' },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Voter', voterSchema);
