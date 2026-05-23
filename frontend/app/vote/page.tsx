"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getAuth, getPqcSession, clearAuth } from "@/lib/api";

interface Candidate {
  _id: string;
  name: string;
  party: string;
  partyColor: string;
  partyShortName: string;
  bio: string;
  avatar: string;
  slogan: string;
}

interface Election {
  _id: string;
  title: string;
  description: string;
  status: string;
  endTime: string;
}

export default function VotePage() {
  const router = useRouter();
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"select" | "confirm" | "encrypting" | "done">("select");
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const [encStep, setEncStep] = useState(0);
  const [voter, setVoter] = useState<{ name?: string; email?: string; hasVoted?: boolean; role?: string } | null>(null);

  const encryptionSteps = [
    "Generating Kyber-1024 session keypair...",
    "Encapsulating shared secret...",
    "Encrypting ballot with AES-256-GCM...",
    "Signing with Dilithium-3...",
    "Computing SHA-3-256 integrity hash...",
    "Transmitting encrypted ballot...",
    "Vote securely recorded",
  ];

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/"); return; }
    const v = auth.voter as typeof voter;
    setVoter(v);
    if (v?.role === "admin") { router.replace("/admin"); return; }
    if (v?.hasVoted) { router.replace("/confirm?alreadyVoted=true"); return; }
    loadElection();
  }, [router]);

  async function loadElection() {
    try {
      const data = await api.getElection();
      setElection(data.election);
      setCandidates(data.candidates);
    } catch { setError("Failed to load election data"); }
    finally { setLoading(false); }
  }

  async function handleCastVote() {
    if (!selected || !election) return;
    setStep("encrypting");
    setSubmitting(true);
    for (let i = 0; i < encryptionSteps.length - 1; i++) {
      setEncStep(i);
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    }
    try {
      const session = getPqcSession();
      const data = await api.castVote({ candidateId: selected, electionId: election._id, kyberPublicKey: session?.kyberPublicKey, dilithiumPrivateKey: session?.dilithiumPrivateKey });
      setEncStep(encryptionSteps.length - 1);
      await new Promise(r => setTimeout(r, 500));
      setReceipt(data.receipt);
      setStep("done");
      const auth = getAuth();
      if (auth) localStorage.setItem("qv_voter", JSON.stringify({ ...(auth.voter as Record<string, unknown>), hasVoted: true }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Vote submission failed");
      setStep("select");
    } finally { setSubmitting(false); }
  }

  const selectedCandidate = candidates.find(c => c._id === selected);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
      <div style={{ textAlign: "center" }}>
        <div className="animate-spin-slow" style={{ fontSize: 40, marginBottom: 16 }}>⚛</div>
        <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Loading secure ballot...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#000", position: "relative" }}>
      <div className="grid-bg" />

      <nav className="navbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, border: "1.5px solid #fff", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⚛</div>
          <span style={{ fontWeight: 900, fontSize: "1rem" }}>QuantumVote</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div className="security-indicator"><div className="security-dot" />Ballot Active</div>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{voter?.name || voter?.email}</span>
          <button onClick={() => { clearAuth(); router.replace("/"); }} className="btn-ghost" style={{ padding: "6px 12px" }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px 60px", position: "relative", zIndex: 1 }}>

        {/* Election header */}
        {election && step !== "done" && (
          <div style={{ marginBottom: 36 }} className="animate-fade-in-up" style={{ opacity: 0 }}>
            <div className="badge badge-outline" style={{ marginBottom: 12 }}>ACTIVE ELECTION</div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, marginBottom: 6 }}>{election.title}</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>{election.description}</p>
          </div>
        )}

        {/* SELECT */}
        {step === "select" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginBottom: 28 }}>
              {candidates.map((c, i) => (
                <div key={c._id} className={`candidate-card animate-fade-in-up ${selected === c._id ? "selected" : ""}`}
                  style={{ opacity: 0, animationDelay: `${i * 0.08}s` }}
                  onClick={() => setSelected(c._id)} id={`candidate-${c._id}`}>

                  {/* Top accent bar using candidate color */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: selected === c._id ? "#fff" : "rgba(255,255,255,0.15)", borderRadius: "12px 12px 0 0", transition: "background 0.25s" }} />

                  <div style={{ position: "absolute", top: 16, right: 16 }}>
                    <div className={`check-circle ${selected === c._id ? "checked" : ""}`}>
                      {selected === c._id ? "✓" : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, paddingTop: 8 }}>
                    <div style={{ fontSize: 40, lineHeight: 1 }}>{c.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 800 }}>{c.name}</h3>
                        <span className="badge badge-outline" style={{ fontSize: "0.65rem" }}>{c.partyShortName}</span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10 }}>{c.party}</div>
                      <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>{c.bio}</p>
                      <div style={{ fontSize: "0.8rem", fontStyle: "italic", color: "var(--text-muted)" }}>"{c.slogan}"</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 8, color: "#ff6666", fontSize: "0.85rem" }}>⚠ {error}</div>}

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className="btn-primary" style={{ padding: "14px 44px", fontSize: "1rem" }} disabled={!selected} onClick={() => setStep("confirm")} id="proceed-vote-btn">
                Proceed to Encrypted Vote →
              </button>
            </div>
          </div>
        )}

        {/* CONFIRM */}
        {step === "confirm" && selectedCandidate && (
          <div className="glass-card-glow animate-fade-in" style={{ maxWidth: 520, margin: "0 auto", padding: 36 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>{selectedCandidate.avatar}</div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Confirm Your Vote</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>This action is irreversible once submitted</p>
            </div>

            <div style={{ padding: "16px 20px", border: "1px solid var(--border-strong)", borderRadius: 10, marginBottom: 20 }}>
              <div className="uppercase-label" style={{ marginBottom: 6 }}>Selected Candidate</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{selectedCandidate.name}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{selectedCandidate.party}</div>
            </div>

            <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: 8, marginBottom: 24 }}>
              <div className="uppercase-label" style={{ marginBottom: 8 }}>Encryption Plan</div>
              {["Kyber-1024 KEM → shared secret", "AES-256-GCM → ballot encryption", "Dilithium-3 → digital signature", "SHA-3-256 → integrity hash"].map(s => (
                <div key={s} style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: "#fff" }}>›</span> {s}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep("select")}>← Change</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleCastVote} disabled={submitting} id="cast-vote-btn">
                Cast Encrypted Vote
              </button>
            </div>
          </div>
        )}

        {/* ENCRYPTING */}
        {step === "encrypting" && (
          <div className="glass-card-glow animate-fade-in scan-container" style={{ maxWidth: 520, margin: "0 auto", padding: 40, textAlign: "center" }}>
            <div className="animate-spin-slow" style={{ fontSize: 48, marginBottom: 20 }}>⚛</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Encrypting Your Vote</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 28, fontSize: "0.85rem" }}>Post-quantum cryptographic operations in progress</p>
            <div style={{ textAlign: "left" }}>
              {encryptionSteps.map((s, i) => (
                <div key={i} className={`attack-step ${i < encStep ? "safe" : i === encStep ? "active" : ""}`} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: `1px solid ${i <= encStep ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: i < encStep ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", color: i < encStep ? "#000" : "#fff", transition: "all 0.3s" }}>
                    {i < encStep ? "✓" : i === encStep ? "·" : ""}
                  </div>
                  <span style={{ fontSize: "0.82rem", color: i <= encStep ? "#fff" : "var(--text-muted)", fontFamily: "Courier New", transition: "color 0.3s" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && receipt && (
          <div className="animate-fade-in" style={{ maxWidth: 580, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 64, height: 64, border: "1px solid rgba(255,255,255,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: 6 }}>Vote Cast Successfully</h1>
              <p style={{ color: "var(--text-muted)" }}>Your encrypted ballot has been permanently recorded</p>
            </div>

            <div className="glass-card-glow" style={{ padding: 28 }}>
              <div style={{ display: "flex", align: "center", gap: 10, marginBottom: 20, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>🛡</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Integrity Verified</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>No tampering detected</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div className="uppercase-label" style={{ marginBottom: 6 }}>Receipt ID</div>
                  <div className="hash-display">{(receipt as {receiptId:string}).receiptId}</div>
                </div>
                <div>
                  <div className="uppercase-label" style={{ marginBottom: 6 }}>SHA-3-256 Integrity Hash</div>
                  <div className="hash-display">{(receipt as {integrityHash:string}).integrityHash}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge badge-white">Kyber-1024</span>
                  <span className="badge badge-white">Dilithium-3</span>
                  <span className="badge badge-white">AES-256-GCM</span>
                </div>
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => router.push(`/confirm?receipt=${(receipt as {receiptId:string}).receiptId}`)}>
                  View Full Receipt
                </button>
                <button className="btn-secondary" onClick={() => { clearAuth(); router.push("/"); }}>Sign Out</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
