"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AttackStep {
  step: number;
  action: string;
  duration: number;
  status: "progress" | "broken" | "safe";
}

interface AlgorithmInfo {
  name: string;
  type: string;
  standardization: string;
  securityLevel: string;
  description: string;
  quantumResistant: boolean;
  usedFor: string;
  keySize?: Record<string, number>;
}

export default function QuantumDemoPage() {
  const router = useRouter();
  const [algorithms, setAlgorithms] = useState<AlgorithmInfo[]>([]);
  const [classicalAttack, setClassicalAttack] = useState<{ steps: AttackStep[]; vulnerable: boolean; timeToBreak: string; algorithm: string; qubitCount: number } | null>(null);
  const [pqcAttack, setPqcAttack] = useState<{ steps: AttackStep[]; vulnerable: boolean; timeToBreak: string; algorithm: string } | null>(null);
  const [classicalProgress, setClassicalProgress] = useState(-1);
  const [pqcProgress, setPqcProgress] = useState(-1);
  const [simRunning, setSimRunning] = useState(false);
  const [simDone, setSimDone] = useState(false);
  const [demoKeys, setDemoKeys] = useState<Record<string, unknown> | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [activeAlgo, setActiveAlgo] = useState(0);

  useEffect(() => {
    api.getAlgorithms().then((d) => setAlgorithms(d.algorithms)).catch(() => { });
  }, []);

  const runSimulation = useCallback(async () => {
    setSimRunning(true);
    setSimDone(false);
    setClassicalProgress(-1);
    setPqcProgress(-1);

    const data = await api.simulateAttack();
    setClassicalAttack(data.classical);
    setPqcAttack(data.pqc);

    // Animate classical attack (fast, breaks)
    for (let i = 0; i < data.classical.steps.length; i++) {
      await new Promise((r) => setTimeout(r, data.classical.steps[i].duration));
      setClassicalProgress(i);
    }

    // Small pause
    await new Promise((r) => setTimeout(r, 300));

    // Animate PQC defense (slower, survives)
    for (let i = 0; i < data.pqc.steps.length; i++) {
      await new Promise((r) => setTimeout(r, data.pqc.steps[i].duration + 200));
      setPqcProgress(i);
    }

    setSimRunning(false);
    setSimDone(true);
  }, []);

  async function loadDemoKeys() {
    setLoadingKeys(true);
    try {
      const d = await api.demoKeygen();
      setDemoKeys(d);
    } catch { } finally {
      setLoadingKeys(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(168,85,247,0.1) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 90% 90%, rgba(0,245,255,0.06) 0%, transparent 50%)" }} />

      {/* Navbar */}
      <nav className="navbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.88rem" }}>← Back</button>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: "1.2rem" }}>⚛️ QuantumVote</span>
        </div>
        <div className="security-indicator"><div className="security-dot" />Quantum Demo Mode</div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px 60px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56, opacity: 0 }} className="animate-fade-in-up">
          <div className="badge badge-purple" style={{ marginBottom: 16 }}>⚛️ POST-QUANTUM CRYPTOGRAPHY</div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, marginBottom: 16, lineHeight: 1.1 }}>
            Quantum Threat <span className="gradient-text">Simulation Lab</span>
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)", maxWidth: 600, margin: "0 auto" }}>
            See how a future quantum computer breaks classical cryptography — and why CRYSTALS-Kyber & Dilithium remain secure
          </p>
        </div>

        {/* Attack Simulation */}
        <div className="glass-card-glow" style={{ padding: 36, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 4 }}>⚡ Quantum Attack Simulator</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Watch Shor's Algorithm break RSA-2048 while Kyber-1024 stands firm</p>
            </div>
            <button className="btn-primary" onClick={runSimulation} disabled={simRunning} id="run-sim-btn" style={{ padding: "12px 28px" }}>
              {simRunning ? "⚛️ Simulation Running..." : simDone ? "🔄 Run Again" : "▶ Start Attack Simulation"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Classical */}
            <div style={{ padding: 24, borderRadius: 16, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
                <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>Classical: RSA-2048</h3>
                <span className="badge badge-red" style={{ fontSize: "0.7rem" }}>VULNERABLE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(classicalAttack?.steps || Array(5).fill(null)).map((step, i) => (
                  <div key={i} className={`attack-step ${i <= classicalProgress ? (i === (classicalAttack?.steps.length ?? 0) - 1 ? "broken" : "active") : ""}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        background: i <= classicalProgress && i < (classicalAttack?.steps.length ?? 0) - 1 ? "#00f5ff" : i === classicalProgress && i === (classicalAttack?.steps.length ?? 0) - 1 ? "#ef4444" : "rgba(255,255,255,0.1)",
                        fontSize: "0.68rem", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {i < classicalProgress ? "✓" : i === classicalProgress ? (i === (classicalAttack?.steps.length ?? 0) - 1 ? "✗" : "⟳") : ""}
                      </div>
                      <span style={{ fontSize: "0.82rem", color: i <= classicalProgress ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {step ? step.action : `Step ${i + 1}...`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {simDone && (
                <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10 }}>
                  <div style={{ fontWeight: 800, color: "#ef4444", marginBottom: 4 }}>💥 RSA-2048 BROKEN</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Shor's algorithm factored the 2048-bit modulus. All votes encrypted with RSA are compromised.
                  </div>
                </div>
              )}
            </div>

            {/* PQC */}
            <div style={{ padding: 24, borderRadius: 16, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--accent-green)" }} />
                <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>PQC: CRYSTALS-Kyber-1024</h3>
                <span className="badge badge-green" style={{ fontSize: "0.7rem" }}>QUANTUM-SAFE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(pqcAttack?.steps || Array(5).fill(null)).map((step, i) => (
                  <div key={i} className={`attack-step ${i <= pqcProgress ? (i === (pqcAttack?.steps.length ?? 0) - 1 ? "safe" : "active") : ""}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        background: i < pqcProgress ? "#00f5ff" : i === pqcProgress && i === (pqcAttack?.steps.length ?? 0) - 1 ? "#22c55e" : i === pqcProgress ? "#00f5ff" : "rgba(255,255,255,0.1)",
                        fontSize: "0.68rem", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {i < pqcProgress ? "✓" : i === pqcProgress ? "⟳" : ""}
                      </div>
                      <span style={{ fontSize: "0.82rem", color: i <= pqcProgress ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {step ? step.action : `Step ${i + 1}...`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {simDone && (
                <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 10 }}>
                  <div style={{ fontWeight: 800, color: "var(--accent-green)", marginBottom: 4 }}>🛡️ Kyber-1024 SURVIVED</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Lattice-based hardness (LWE) makes this infeasible. 2^256 operations required — computationally impossible.
                  </div>
                </div>
              )}
            </div>
          </div>

          {simDone && (
            <div style={{ marginTop: 24, padding: "16px 20px", background: "linear-gradient(135deg, rgba(0,245,255,0.06), rgba(168,85,247,0.06))", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
                ⚛️ QuantumVote uses <span className="gradient-text">NIST-standardized PQC</span> — ready for the quantum era
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>FIPS 203 (Kyber) + FIPS 204 (Dilithium) are approved post-quantum standards</div>
            </div>
          )}
        </div>

        {/* Algorithm Details */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 20 }}>🔐 Cryptographic Algorithm Stack</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {algorithms.map((algo, i) => (
              <button key={i} onClick={() => setActiveAlgo(i)}
                style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${activeAlgo === i ? "#fff" : "var(--border-subtle)"}`, background: activeAlgo === i ? "rgba(255,255,255,0.1)" : "transparent", color: activeAlgo === i ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: "0.85rem", fontWeight: activeAlgo === i ? 700 : 500, transition: "all 0.2s" }}>
                {algo.name}
              </button>
            ))}
          </div>

          {algorithms[activeAlgo] && (
            <div className="glass-card-glow animate-fade-in" style={{ padding: 32 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: 900 }}>{algorithms[activeAlgo].name}</h3>
                    {algorithms[activeAlgo].quantumResistant && <span className="badge badge-green">Quantum-Safe</span>}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600, marginBottom: 8 }}>{algorithms[activeAlgo].type}</div>
                  <div style={{ marginBottom: 12 }}>
                    <span className="badge badge-gold">{algorithms[activeAlgo].standardization}</span>
                  </div>
                  <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16, fontSize: "0.9rem" }}>{algorithms[activeAlgo].description}</p>
                  <div style={{ padding: "12px 16px", background: "rgba(0,245,255,0.06)", border: "1px solid rgba(0,245,255,0.12)", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>USED FOR</div>
                    <div style={{ fontSize: "0.88rem" }}>{algorithms[activeAlgo].usedFor}</div>
                  </div>
                </div>
                <div style={{ minWidth: 200 }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>SECURITY LEVEL</div>
                    <div style={{ fontWeight: 700, color: "var(--accent-green)" }}>{algorithms[activeAlgo].securityLevel}</div>
                  </div>
                  {algorithms[activeAlgo].keySize && (
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8 }}>KEY SIZES (bytes)</div>
                      {Object.entries(algorithms[activeAlgo].keySize!).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "0.85rem" }}>
                          <span style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>{k}</span>
                          <span style={{ fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{v} B</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Key Generation Demo */}
        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 4 }}>🔑 Live PQC Key Generation</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>Generate real Kyber-1024 & Dilithium-3 keys using actual cryptographic entropy</p>
            </div>
            <button className="btn-primary" onClick={loadDemoKeys} disabled={loadingKeys} id="keygen-btn">
              {loadingKeys ? "⚛️ Generating..." : "Generate Keypairs"}
            </button>
          </div>

          {demoKeys && (
            <div className="animate-fade-in">
              {["kyber", "dilithium"].map((algo) => {
                const k = (demoKeys as Record<string, Record<string, unknown>>)[algo];
                if (!k) return null;
                const demo = k.demo as Record<string, string> | undefined;
                const keySize = k.keySize as Record<string, number> | undefined;
                return (
                  <div key={algo} style={{ marginBottom: 20, padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 12, color: "#fff" }}>
                      {algo === "kyber" ? "🔵 CRYSTALS-Kyber-1024" : "🟣 CRYSTALS-Dilithium-3"} — {k.algorithm as string}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>PUBLIC KEY (truncated)</div>
                        <div className="hash-display" style={{ fontSize: "0.72rem" }}>{(k.publicKey as string).substring(0, 80)}...</div>
                      </div>
                      {algo === "kyber" && demo && (
                        <div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>SHARED SECRET (after encapsulation)</div>
                          <div className="hash-display" style={{ fontSize: "0.72rem" }}>{demo.sharedSecret}</div>
                        </div>
                      )}
                      {algo === "dilithium" && demo && (
                        <div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>SIGNATURE (truncated)</div>
                          <div className="hash-display" style={{ fontSize: "0.72rem" }}>{demo.signature}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <span className="badge badge-cyan" style={{ fontSize: "0.7rem" }}>
                        Public: {keySize?.public} bytes
                      </span>
                      <span className="badge badge-purple" style={{ fontSize: "0.7rem" }}>
                        Private: {keySize?.private} bytes
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SDG note */}
        <div style={{ marginTop: 32, padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
            <strong style={{ color: "#fff" }}>SDG 16 — Peace, Justice & Strong Institutions</strong><br />
            QuantumVote promotes transparent elections, secure democratic systems, and trustworthy digital governance.<br />
            Built with NIST-standardized post-quantum cryptography for a quantum-era future.
          </div>
        </div>
      </div>
    </div>
  );
}
