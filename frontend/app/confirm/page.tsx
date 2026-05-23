"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, clearAuth } from "@/lib/api";
import { Suspense } from "react";

interface Receipt {
  receiptId: string;
  timestamp: string;
  integrityHash: string;
  integrityValid: boolean;
  candidate: { name: string; party: string; partyColor: string; avatar: string };
  election: { title: string; status: string };
  encryptionMetadata: {
    kemAlgorithm: string;
    symmetricAlgorithm: string;
    signatureAlgorithm: string;
    quantumSecurityBits: number;
  };
  verificationCount: number;
}

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const receiptId = searchParams.get("receipt");
  const alreadyVoted = searchParams.get("alreadyVoted");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (receiptId) {
      api.confirmReceipt(receiptId)
        .then((d) => setReceipt(d.receipt))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [receiptId]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyHash.trim()) return;
    setVerifying(true);
    try {
      const r = await api.verifyHash(verifyHash.trim());
      setVerifyResult(r);
    } catch {
      setVerifyResult({ valid: false, error: "Hash not found in ledger" });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", padding: "80px 24px 60px" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(34,197,94,0.06) 0%, transparent 60%)" }} />

      {/* Navbar */}
      <nav className="navbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="gradient-text" style={{ fontWeight: 800, fontSize: "1.2rem" }}>⚛️ QuantumVote</span>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" style={{ padding: "8px 20px", fontSize: "0.88rem" }} onClick={() => router.push("/")}>Home</button>
          <button className="btn-secondary" style={{ padding: "8px 20px", fontSize: "0.88rem" }} onClick={() => { clearAuth(); router.push("/"); }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {alreadyVoted && !receiptId && (
          <div className="glass-card-glow animate-fade-in" style={{ padding: 40, textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: 8 }} className="gradient-text">You've Already Voted</h1>
            <p style={{ color: "var(--text-secondary)" }}>Your ballot has been securely recorded. Each voter may only cast one vote.</p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚛️</div>
            <div className="gradient-text" style={{ fontWeight: 700 }}>Loading receipt...</div>
          </div>
        )}

        {!loading && receipt && (
          <div className="animate-fade-in-up" style={{ opacity: 0 }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "2px solid var(--accent-green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px" }}>✅</div>
              <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: 8 }}>Vote Receipt</h1>
              <p style={{ color: "var(--text-secondary)" }}>Your vote has been permanently recorded and verified</p>
            </div>

            {/* Receipt card */}
            <div className="glass-card-glow" style={{ padding: 36, marginBottom: 24 }}>
              {/* Integrity status */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: receipt.integrityValid ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${receipt.integrityValid ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 24 }}>{receipt.integrityValid ? "🛡️" : "⚠️"}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: receipt.integrityValid ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {receipt.integrityValid ? "Integrity Verified" : "Integrity Warning"}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>No tampering detected</div>
                  </div>
                </div>
                <div className="badge badge-green">VERIFIED</div>
              </div>

              {/* Candidate */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 24 }}>
                <div style={{ fontSize: 40 }}>{receipt.candidate?.avatar}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{receipt.candidate?.name}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>{receipt.candidate?.party}</div>
                </div>
              </div>

              {/* Details grid */}
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Receipt ID</div>
                  <div className="hash-display">{receipt.receiptId}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>SHA-3-256 Integrity Hash</div>
                  <div className="hash-display">{receipt.integrityHash}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>TIMESTAMP</div>
                    <div style={{ fontSize: "0.83rem" }}>{new Date(receipt.timestamp).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>ELECTION</div>
                    <div style={{ fontSize: "0.83rem" }}>{receipt.election?.title?.slice(0, 30)}...</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>VERIFIED</div>
                    <div style={{ fontSize: "0.83rem" }}>{receipt.verificationCount}x</div>
                  </div>
                </div>
                {receipt.encryptionMetadata && (
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Encryption Details</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-cyan">{receipt.encryptionMetadata.kemAlgorithm}</span>
                      <span className="badge badge-gold">{receipt.encryptionMetadata.symmetricAlgorithm}</span>
                      <span className="badge badge-purple">{receipt.encryptionMetadata.signatureAlgorithm}</span>
                      <span className="badge badge-green">{receipt.encryptionMetadata.quantumSecurityBits}-bit quantum secure</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verify hash tool */}
        <div className="glass-card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>🔍 Verify Any Vote Hash</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 16 }}>Enter any integrity hash to verify it exists on the secure ledger</p>
          <form onSubmit={handleVerify} style={{ display: "flex", gap: 10 }}>
            <input
              className="input-field"
              placeholder="Paste SHA-3-256 hash..."
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
              style={{ flex: 1, fontSize: "0.85rem" }}
              id="verify-hash-input"
            />
            <button type="submit" className="btn-primary" disabled={verifying} id="verify-hash-btn">
              {verifying ? "⏳" : "Verify"}
            </button>
          </form>

          {verifyResult && (
            <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: (verifyResult as { valid: boolean }).valid ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${(verifyResult as { valid: boolean }).valid ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
              <div style={{ fontWeight: 700, color: (verifyResult as { valid: boolean }).valid ? "var(--accent-green)" : "var(--accent-red)", marginBottom: 4 }}>
                {(verifyResult as { valid: boolean }).valid ? "✅ Vote verified — no tampering detected" : "❌ " + ((verifyResult as { error?: string }).error || "Verification failed")}
              </div>
              {(verifyResult as { receiptId?: string }).receiptId && <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Receipt: {(verifyResult as { receiptId: string }).receiptId}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}><div className="gradient-text" style={{ fontSize: "1.2rem" }}>Loading...</div></div>}>
      <ConfirmContent />
    </Suspense>
  );
}
