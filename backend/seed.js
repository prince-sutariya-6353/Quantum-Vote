/**
 * QuantumVote — Database Seeder
 * Seeds demo election, candidates, admin user, and sample voters
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const Voter = require('./models/Voter');
const Candidate = require('./models/Candidate');
const Election = require('./models/Election');
const AuditLog = require('./models/AuditLog');
const SecurityAlert = require('./models/SecurityAlert');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/quantumvote';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Voter.deleteMany({}),
    Candidate.deleteMany({}),
    Election.deleteMany({}),
    AuditLog.deleteMany({}),
    SecurityAlert.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // Create election
  const election = await Election.create({
    title: '2026 Global Digital Summit Election',
    description: 'Secure quantum-resistant election for the Global Technology Leadership Council',
    status: 'active',
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    totalRegisteredVoters: 6,
  });
  console.log('🗳️  Election created:', election.title);

  // Create candidates
  const candidates = await Candidate.create([
    {
      name: 'Dr. Aria Quantum',
      party: 'Progressive Digital Alliance',
      partyShortName: 'PDA',
      partyColor: '#00F5FF',
      bio: 'Former AI Ethics Director at MIT. Champion of digital sovereignty and quantum-secured elections. Advocates for open-source governance.',
      avatar: '🔵',
      slogan: 'Secure Today, Quantum-Ready Tomorrow',
      position: 1,
      electionId: election._id,
    },
    {
      name: 'Marcus Sterling',
      party: 'Democratic Innovation Party',
      partyShortName: 'DIP',
      partyColor: '#FFD700',
      bio: 'Tech entrepreneur with 20 years in cybersecurity. Founder of the OpenVote Initiative. Strong believer in transparent governance.',
      avatar: '🟡',
      slogan: 'Transparency, Security, Democracy',
      position: 2,
      electionId: election._id,
    },
    {
      name: 'Prof. Nadia Vance',
      party: 'Future Governance Coalition',
      partyShortName: 'FGC',
      partyColor: '#A855F7',
      bio: 'Constitutional law expert and blockchain researcher. Expert in decentralized governance models and digital rights preservation.',
      avatar: '🟣',
      slogan: 'Decentralize Power, Protect Rights',
      position: 3,
      electionId: election._id,
    },
    {
      name: 'Elias Northgate',
      party: 'Sovereign Tech Republic',
      partyShortName: 'STR',
      partyColor: '#22C55E',
      bio: 'National security advisor and quantum computing researcher. Specializes in post-quantum cryptography policy and secure digital infrastructure.',
      avatar: '🟢',
      slogan: 'Strength in Security',
      position: 4,
      electionId: election._id,
    },
  ]);
  console.log(`👥 Created ${candidates.length} candidates`);

  // Create admin user
  const bcrypt = require('bcryptjs');
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  
  const admin = await Voter.create({
    email: 'admin@quantumvote.io',
    name: 'Election Administrator',
    password: adminPasswordHash,
    voterId: crypto.randomUUID(),
    role: 'admin',
    isVerified: true,
  });
  console.log('🔐 Admin created: admin@quantumvote.io');

  // Create demo voters
  const demoVoters = [
    { email: 'alice@demo.com', name: 'Alice Chen' },
    { email: 'bob@demo.com', name: 'Bob Williams' },
    { email: 'carol@demo.com', name: 'Carol Martinez' },
    { email: 'david@demo.com', name: 'David Singh' },
    { email: 'eve@demo.com', name: 'Eve Johnson' },
  ];

  for (const v of demoVoters) {
    await Voter.create({ ...v, voterId: crypto.randomUUID(), isVerified: false });
  }
  console.log(`👤 Created ${demoVoters.length} demo voters`);

  // Seed some audit logs
  await AuditLog.create([
    { event: 'Election system initialized', eventType: 'SYSTEM', severity: 'INFO', timestamp: new Date(Date.now() - 3600000) },
    { event: 'PQC key generation service started', eventType: 'SYSTEM', severity: 'INFO', timestamp: new Date(Date.now() - 3500000) },
    { event: 'Admin login: admin@quantumvote.io', eventType: 'AUTH', severity: 'INFO', timestamp: new Date(Date.now() - 3000000) },
    { event: 'Integrity verification completed: 0 anomalies', eventType: 'INTEGRITY', severity: 'INFO', timestamp: new Date(Date.now() - 1800000) },
  ]);

  // Seed demo security alerts
  await SecurityAlert.create([
    {
      type: 'SUSPICIOUS_TIMING',
      severity: 'LOW',
      title: 'Unusual Login Timing Detected',
      description: 'Multiple login attempts from same session in quick succession',
      timestamp: new Date(Date.now() - 7200000),
      resolved: true,
      resolvedAt: new Date(Date.now() - 7000000),
    },
    {
      type: 'RATE_LIMIT_EXCEEDED',
      severity: 'MEDIUM',
      title: 'Rate Limit Exceeded on OTP Endpoint',
      description: 'IP hash a3f9... exceeded 5 requests/min on /api/auth/send-otp',
      timestamp: new Date(Date.now() - 5400000),
      resolved: true,
    },
  ]);
  console.log('📝 Seeded audit logs and security alerts');

  console.log('\n✅ Seed complete!');
  console.log('━'.repeat(50));
  console.log('📋 Demo Credentials:');
  console.log('   Admin:  admin@quantumvote.io  (any OTP)');
  console.log('   Voters: alice@demo.com, bob@demo.com, etc.');
  console.log('   Election ID:', election._id.toString());
  console.log('━'.repeat(50));

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
