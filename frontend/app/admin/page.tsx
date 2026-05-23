"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getAuth, clearAuth } from "@/lib/api";

interface Stats {
  election: { title: string; status: string };
  totalVoters: number;
  totalVoted: number;
  totalVotes: number;
  turnoutPercentage: string;
  candidateResults: Array<{ id: string; name: string; party: string; partyColor: string; avatar: string; votes: number; percentage: string; partyShortName: string }>;
  security: { unresolvedAlerts: number; criticalAlerts: number; integrityStatus: string; quantumResistant: boolean };
}

interface Alert {
  _id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

interface AuditEntry {
  _id: string;
  event: string;
  eventType: string;
  severity: string;
  timestamp: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "results" | "alerts" | "audit" | "integrity">("overview");
  const [loading, setLoading] = useState(true);
  const [integrityData, setIntegrityData] = useState<Record<string, unknown> | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsData, alertsData, auditData] = await Promise.all([
        api.getAdminStats(),
        api.getAlerts("limit=10"),
        api.getAuditLog("limit=20"),
      ]);
      setStats(statsData);
      setAlerts(alertsData.alerts || []);
      setAuditLogs(auditData.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/"); return; }
    const voter = auth.voter as { role?: string };
    if (voter?.role !== "admin") { router.replace("/vote"); return; }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [router, loadData]);

  async function handleResolveAlert(id: string) {
    await api.resolveAlert(id);
    setAlerts((prev) => prev.map((a) => a._id === id ? { ...a, resolved: true } : a));
  }

  async function handleIntegrityCheck() {
    setIntegrityLoading(true);
    try {
      const data = await api.integrityCheck();
      setIntegrityData(data);
    } catch { } finally {
      setIntegrityLoading(false);
    }
  }

  async function handleFinalize() {
    if (!confirm("Finalize and seal this election? This cannot be undone.")) return;
    setFinalizing(true);
    try {
      await api.finalizeElection();
      await loadData();
    } catch { } finally {
      setFinalizing(false);
    }
  }

  const severityColors: Record<string, string> = { LOW: "#22c55e", MEDIUM: "#ffd700", HIGH: "#ef4444", CRITICAL: "#ff0040" };
  const eventTypeColors: Record<string, string> = { AUTH: "#00f5ff", VOTE: "#22c55e", ADMIN: "#ffd700", SECURITY: "#ef4444", SYSTEM: "#a855f7", INTEGRITY: "#00f5ff" };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "spin-slow 2s linear infinite" }}>⚛️</div>
          <div className="gradient-text" style={{ fontWeight: 700, fontSize: "1.1rem" }}>Loading Admin Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(168,85,247,0.06) 0%, transparent 60%)" }} />

      {/* Navbar */}
      <nav className="navbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: "1.2rem" }}>⚛️ QuantumVote</span>
          <span className="badge badge-purple">Admin Console</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {stats?.security.criticalAlerts ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: "0.85rem", fontWeight: 600 }}>
              <div className="animate-blink" style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
              {stats.security.criticalAlerts} CRITICAL
            </div>
          ) : (
            <div className="security-indicator"><div className="security-dot" />All Systems Nominal</div>
          )}
          <a href="/quantum-demo" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textDecoration: "none" }}>⚛️ Quantum Demo</a>
          <button onClick={() => { clearAuth(); router.push("/"); }} style={{ fontSize: "0.82rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 24px 60px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: 4 }}>Election Control Center</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{stats?.election.title}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-secondary" onClick={loadData} style={{ padding: "10px 20px", fontSize: "0.88rem" }}>🔄 Refresh</button>
            {stats?.election.status === "active" && (
              <button className="btn-danger" onClick={handleFinalize} disabled={finalizing} id="finalize-btn">
                {finalizing ? "Finalizing..." : "🔒 Finalize Election"}
              </button>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Voters", value: stats?.totalVoters || 0, icon: "👥", color: "#00f5ff" },
            { label: "Votes Cast", value: stats?.totalVoted || 0, icon: "🗳️", color: "#22c55e" },
            { label: "Turnout", value: `${stats?.turnoutPercentage || 0}%`, icon: "📊", color: "#ffd700" },
            { label: "Security Alerts", value: stats?.security.unresolvedAlerts || 0, icon: "🛡️", color: stats?.security.criticalAlerts ? "#ef4444" : "#22c55e" },
          ].map((s) => (
            <div key={s.label} className="stat-card animate-fade-in-up" style={{ opacity: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Security status bar */}
        <div className="glass-card" style={{ padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-green)", animation: "blink 2s ease-in-out infinite" }} />
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Quantum Encryption Active</span>
            </div>
            <span className="badge badge-cyan">Kyber-1024</span>
            <span className="badge badge-purple">Dilithium-3</span>
            <span className="badge badge-gold">AES-256-GCM</span>
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Integrity: <span style={{ color: "var(--accent-green)", fontWeight: 700 }}>{stats?.security.integrityStatus}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {(["overview", "results", "alerts", "audit", "integrity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: "0.88rem",
                fontWeight: activeTab === tab ? 700 : 500,
                background: activeTab === tab ? "rgba(255,255,255,0.1)" : "transparent",
                color: activeTab === tab ? "#fff" : "var(--text-secondary)",
                transition: "all 0.2s",
                textTransform: "capitalize",
              }}
              id={`tab-${tab}`}
            >
              {tab === "overview" ? "📊 Overview" : tab === "results" ? "🏆 Results" : tab === "alerts" ? `🚨 Alerts ${stats?.security.unresolvedAlerts ? `(${stats.security.unresolvedAlerts})` : ""}` : tab === "audit" ? "📋 Audit Log" : "🛡️ Integrity"}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Turnout visual */}
            <div className="glass-card" style={{ padding: 28 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: "1rem" }}>📊 Voter Turnout</h3>
              <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto 20px" }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="url(#turnoutGrad)" strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${Number(stats.turnoutPercentage)} ${100 - Number(stats.turnoutPercentage)}`}
                    style={{ transition: "stroke-dasharray 1s ease" }}
                  />
                  <defs>
                    <linearGradient id="turnoutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00f5ff" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div className="gradient-text" style={{ fontSize: "1.8rem", fontWeight: 900 }}>{stats.turnoutPercentage}%</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Turnout</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.85rem" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff" }}>{stats.totalVoted}</div>
                  <div style={{ color: "var(--text-muted)" }}>Voted</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{stats.totalVoters}</div>
                  <div style={{ color: "var(--text-muted)" }}>Registered</div>
                </div>
              </div>
            </div>

            {/* Quick results */}
            <div className="glass-card" style={{ padding: 28 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: "1rem" }}>🏆 Live Results</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[...stats.candidateResults].sort((a, b) => b.votes - a.votes).map((c, i) => (
                  <div key={c.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {i === 0 && stats.totalVotes > 0 && <span style={{ fontSize: "0.85rem" }}>🥇</span>}
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.name}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>({c.partyShortName})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: c.partyColor }}>{c.percentage}%</span>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{c.votes} votes</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${c.percentage}%`, background: `linear-gradient(90deg, ${c.partyColor}aa, ${c.partyColor})` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent alerts */}
            <div className="glass-card" style={{ padding: 28 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: "1rem" }}>🚨 Recent Alerts</h3>
              {alerts.filter(a => !a.resolved).slice(0, 4).length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "var(--accent-green)" }}>✅ No active security alerts</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alerts.filter(a => !a.resolved).slice(0, 4).map((alert) => (
                    <div key={alert._id} className={`alert-item severity-${alert.severity.toLowerCase()}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: 2 }}>{alert.title}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{new Date(alert.timestamp).toLocaleTimeString()}</div>
                        </div>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: severityColors[alert.severity] }}>{alert.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit snapshot */}
            <div className="glass-card" style={{ padding: 28 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: "1rem" }}>📋 Recent Audit Events</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {auditLogs.slice(0, 6).map((log) => (
                  <div key={log._id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: eventTypeColors[log.eventType] || "#888", width: 60, flexShrink: 0 }}>{log.eventType}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{log.event}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(log.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Results */}
        {activeTab === "results" && stats && (
          <div className="glass-card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 24 }}>Official Election Results</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[...stats.candidateResults].sort((a, b) => b.votes - a.votes).map((c, i) => (
                <div key={c.id} style={{ padding: 24, background: "rgba(255,255,255,0.03)", borderRadius: 14, border: `1px solid ${i === 0 && stats.totalVotes > 0 ? c.partyColor + "40" : "var(--border-subtle)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 36 }}>{c.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>{c.name}</h3>
                        {i === 0 && stats.totalVotes > 0 && <span className="badge badge-gold">🥇 Leading</span>}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: c.partyColor, fontWeight: 600 }}>{c.party}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "2rem", fontWeight: 900, color: c.partyColor }}>{c.percentage}%</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{c.votes} votes</div>
                    </div>
                  </div>
                  <div className="progress-bar" style={{ height: 12 }}>
                    <div className="progress-fill" style={{ width: `${c.percentage}%`, background: `linear-gradient(90deg, ${c.partyColor}80, ${c.partyColor})` }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(0,245,255,0.05)", borderRadius: 12, border: "1px solid rgba(0,245,255,0.15)" }}>
              <div style={{ fontSize: "0.82rem", color: "#fff" }}>🔐 All results are derived from quantum-encrypted ballots. Individual votes remain anonymous.</div>
            </div>
          </div>
        )}

        {/* Tab: Alerts */}
        {activeTab === "alerts" && (
          <div className="glass-card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 20 }}>Security Alerts</h2>
            {alerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--accent-green)" }}>✅ No security alerts recorded</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map((alert) => (
                  <div key={alert._id} className={`alert-item severity-${alert.severity.toLowerCase()}`} style={{ opacity: alert.resolved ? 0.5 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{alert.title}</span>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: severityColors[alert.severity] }}>{alert.severity}</span>
                          {alert.resolved && <span className="badge badge-green" style={{ fontSize: "0.68rem" }}>RESOLVED</span>}
                        </div>
                        <div style={{ fontSize: "0.83rem", color: "var(--text-secondary)", marginBottom: 4 }}>{alert.description}</div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{new Date(alert.timestamp).toLocaleString()}</div>
                      </div>
                      {!alert.resolved && (
                        <button onClick={() => handleResolveAlert(alert._id)} style={{ marginLeft: 12, padding: "6px 14px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, color: "var(--accent-green)", fontSize: "0.8rem", cursor: "pointer", flexShrink: 0 }}>
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Audit Log */}
        {activeTab === "audit" && (
          <div className="glass-card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 20 }}>Audit Trail</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log._id}>
                      <td>{log.event}</td>
                      <td><span style={{ color: eventTypeColors[log.eventType] || "#888", fontWeight: 600, fontSize: "0.82rem" }}>{log.eventType}</span></td>
                      <td><span style={{ color: log.severity === "CRITICAL" ? "#ef4444" : log.severity === "WARNING" ? "#ffd700" : "var(--accent-green)", fontSize: "0.82rem", fontWeight: 600 }}>{log.severity}</span></td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Integrity */}
        {activeTab === "integrity" && (
          <div>
            <div className="glass-card" style={{ padding: 32, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Vote Integrity Verification</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>Re-verify all encrypted votes on-demand</p>
                </div>
                <button className="btn-primary" onClick={handleIntegrityCheck} disabled={integrityLoading} id="integrity-check-btn">
                  {integrityLoading ? "⏳ Verifying..." : "🛡️ Run Full Integrity Check"}
                </button>
              </div>

              {!integrityData && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", border: "1px dashed var(--border-subtle)", borderRadius: 12 }}>
                  Click "Run Full Integrity Check" to verify all recorded votes
                </div>
              )}

              {integrityData && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Total Checked", value: (integrityData as { totalVotes: number }).totalVotes, color: "#fff" },
                      { label: "Valid", value: (integrityData as { validVotes: number }).validVotes, color: "#fff" },
                      { label: "Invalid", value: (integrityData as { invalidVotes: number }).invalidVotes, color: "var(--danger)" },
                      { label: "Integrity Rate", value: `${(integrityData as { integrityRate: string }).integrityRate}%`, color: "#fff" },
                    ].map((s) => (
                      <div key={s.label} className="stat-card" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 900, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>Receipt ID</th><th>Integrity</th><th>Timestamp</th></tr></thead>
                      <tbody>
                        {((integrityData as { results: Array<{ receiptId: string; valid: boolean; timestamp: string }> }).results || []).map((r) => (
                          <tr key={r.receiptId}>
                            <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{r.receiptId}</td>
                            <td><span style={{ color: r.valid ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>{r.valid ? "✅ Valid" : "❌ TAMPERED"}</span></td>
                            <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{new Date(r.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
