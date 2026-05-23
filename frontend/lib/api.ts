const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('qv_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { 
    ...options, 
    headers,
    cache: 'no-store'
  });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  adminLogin: (email: string, password: string) =>
    request('/api/auth/admin-login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  sendOtp: (email: string, name?: string) =>
    request('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ email, name }) }),
  verifyOtp: (email: string, otp: string) =>
    request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  sendMobileOtp: (phone: string, aadhaar: string, token: string) =>
    request('/api/auth/send-mobile-otp', { method: 'POST', body: JSON.stringify({ phone, aadhaar }), headers: { Authorization: `Bearer ${token}` } }),
  verifyMobileOtp: (phone: string, otp: string, token: string) =>
    request('/api/auth/verify-mobile-otp', { method: 'POST', body: JSON.stringify({ phone, otp }), headers: { Authorization: `Bearer ${token}` } }),
  getMe: () => request('/api/auth/me'),

  // Voting
  getElection: () => request('/api/votes/election'),
  getCandidates: (electionId: string) => request(`/api/votes/candidates/${electionId}`),
  castVote: (data: object) => request('/api/votes/cast', { method: 'POST', body: JSON.stringify(data) }),
  confirmReceipt: (receiptId: string) => request(`/api/votes/confirm/${receiptId}`),
  verifyHash: (hash: string) => request(`/api/votes/verify/${hash}`),

  // Admin
  getAdminStats: () => request('/api/admin/stats'),
  getAlerts: (params?: string) => request(`/api/admin/alerts${params ? '?' + params : ''}`),
  resolveAlert: (id: string) => request(`/api/admin/alerts/${id}/resolve`, { method: 'PATCH' }),
  getAuditLog: (params?: string) => request(`/api/admin/audit${params ? '?' + params : ''}`),
  getAdminVotes: (params?: string) => request(`/api/admin/votes${params ? '?' + params : ''}`),
  finalizeElection: () => request('/api/admin/finalize', { method: 'POST' }),
  integrityCheck: () => request('/api/admin/integrity-check'),

  // Quantum
  getAlgorithms: () => request('/api/quantum/algorithms'),
  simulateAttack: () => request('/api/quantum/simulate-attack'),
  demoKeygen: () => request('/api/quantum/demo-keygen'),
  health: () => request('/api/health'),
};

export function saveAuth(token: string, voter: object) {
  localStorage.setItem('qv_token', token);
  localStorage.setItem('qv_voter', JSON.stringify(voter));
}

export function getAuth() {
  if (typeof window === 'undefined') return null;
  const voter = localStorage.getItem('qv_voter');
  const token = localStorage.getItem('qv_token');
  if (!token || !voter) return null;
  return { token, voter: JSON.parse(voter) };
}

export function clearAuth() {
  localStorage.removeItem('qv_token');
  localStorage.removeItem('qv_voter');
  localStorage.removeItem('qv_pqc_session');
}

export function savePqcSession(session: object) {
  localStorage.setItem('qv_pqc_session', JSON.stringify(session));
}

export function getPqcSession() {
  if (typeof window === 'undefined') return null;
  const s = localStorage.getItem('qv_pqc_session');
  return s ? JSON.parse(s) : null;
}
