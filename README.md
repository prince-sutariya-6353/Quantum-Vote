# ⚛️ QuantumVote — Post-Quantum Secure Digital Voting Platform

> A future-ready election system resistant to quantum-era cyber threats, built with CRYSTALS-Kyber-1024 and CRYSTALS-Dilithium-3.

[![NIST PQC](https://img.shields.io/badge/NIST-FIPS%20203%2F204-blue)](https://csrc.nist.gov/pubs/fips/203/final)
[![SDG 16](https://img.shields.io/badge/SDG-16%20Peace%20%26%20Justice-green)](https://sdgs.un.org/goals/goal16)

---

## 🚀 Quick Start (3 Commands)

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`)

### 1. Start MongoDB
```bash
mongod
```

### 2. Seed the database
```bash
npm run seed
```

### 3. Start the backend
```bash
npm run dev
# Backend: http://localhost:5000
```

### 4. Start the frontend
```bash
cd frontend
npm run dev
# Frontend: http://localhost:3000
```

---

## 🔑 Demo Credentials

| Role | Email | OTP |
|------|-------|-----|
| **Admin** | `admin@quantumvote.io` | *shown on screen* |
| **Voter** | `alice@demo.com` | *shown on screen* |
| **Voter** | `bob@demo.com` | *shown on screen* |
| **Voter** | `carol@demo.com` | *shown on screen* |

---

## 🏗️ Architecture

```
Frontend (Next.js :3000)
    ↓ REST API
Backend (Express :5000)
    ↓ PQC Layer
    CRYSTALS-Kyber-1024 (KEM)
    CRYSTALS-Dilithium-3 (Signatures)
    AES-256-GCM (Symmetric)
    SHA-3-256 (Integrity)
    ↓
MongoDB (quantumvote DB)
```

---

## 🔐 Cryptographic Stack

| Algorithm | Standard | Purpose | Security Level |
|-----------|----------|---------|----------------|
| CRYSTALS-Kyber-1024 | NIST FIPS 203 | Key Encapsulation | NIST Level 5 (256-bit quantum) |
| CRYSTALS-Dilithium-3 | NIST FIPS 204 | Digital Signatures | NIST Level 3 (192-bit quantum) |
| AES-256-GCM | NIST FIPS 197 | Vote Encryption | 128-bit quantum (Grover) |
| SHA-3-256 | NIST FIPS 202 | Integrity Hash | 128-bit quantum (Grover) |

---

## 📋 Demo Flow

### Voter Flow
1. Go to `http://localhost:3000`
2. Enter email → click "Send Secure OTP"
3. Enter the OTP shown on screen
4. Select your candidate
5. Click "Proceed to Encrypted Vote"
6. Watch the PQC encryption animation
7. Receive your secure receipt with integrity hash

### Admin Flow
1. Login with `admin@quantumvote.io`
2. View live results, turnout charts
3. Monitor security alerts
4. Browse audit trail
5. Run integrity check on all votes
6. Finalize election when done

### Quantum Demo
- Navigate to `/quantum-demo`
- Click "Start Attack Simulation"
- Watch Shor's Algorithm break RSA-2048 instantly
- Watch Kyber-1024 survive the quantum attack
- Generate live keypairs
- Explore algorithm technical details

---

## 📁 Project Structure

```
e:\Voting\
├── backend\              # Node.js/Express API
│   ├── index.js          # Server entry point
│   ├── pqcService.js     # PQC simulation (Kyber + Dilithium)
│   ├── seed.js           # Database seeder
│   ├── models\           # MongoDB schemas
│   ├── routes\           # API routes
│   ├── services\         # Business logic
│   └── middleware\       # Auth + tamper detection
│
├── frontend\             # Next.js app
│   ├── app\
│   │   ├── page.tsx      # Login page
│   │   ├── vote\         # Vote casting
│   │   ├── confirm\      # Receipt + verification
│   │   ├── admin\        # Admin dashboard
│   │   └── quantum-demo\ # Quantum attack simulator
│   └── lib\api.ts        # API client
│
└── README.md
```

---

## 🌍 SDG Alignment

**SDG 16 — Peace, Justice & Strong Institutions**

QuantumVote promotes:
- Transparent democratic elections
- Secure digital governance infrastructure
- Trustworthy institutional processes
- Future-proof quantum-resistant security

---

## 🔭 Future Scope

- [ ] Real liboqs integration (actual CRYSTALS algorithms)
- [ ] Blockchain vote ledger
- [ ] National ID / Aadhaar integration
- [ ] Biometric authentication
- [ ] Decentralized election infrastructure
- [ ] Multi-country election support
- [ ] Zero-Knowledge Proof anonymous voting
- [ ] n8n automation workflows

---

*Built for hackathon demo — PQC is simulated using real cryptographic primitives (AES-256-GCM, SHA-3) with accurate Kyber/Dilithium behavioral simulation.*
