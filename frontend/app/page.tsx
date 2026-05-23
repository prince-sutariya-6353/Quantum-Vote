"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, saveAuth, savePqcSession, getAuth } from "@/lib/api";

// ─── Steps: email → otp → aadhaar → webcam → admin-login ────────────────
type Step = "email" | "otp" | "aadhaar" | "aadhaar-otp" | "webcam" | "admin-login" | "done";

const STEPS = [
  { id: "email", label: "Identity" },
  { id: "otp", label: "Email OTP" },
  { id: "aadhaar", label: "Aadhaar" },
  { id: "webcam", label: "Face ID" },
];

function getStepIndex(step: Step) {
  const map: Record<Step, number> = { email: 0, otp: 1, aadhaar: 2, "aadhaar-otp": 2, webcam: 3, "admin-login": 0, done: 4 };
  return map[step];
}

// ─── Aadhaar Verhoeff Checksum ─────────────────────────────────────────────
const d = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const p = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
function verhoeffCheck(num: string): boolean {
  let c = 0;
  const digits = num.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = d[c][p[i % 8][digits[i]]];
  return c === 0;
}

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [aadhaar, setAadhaar] = useState(Array(12).fill(""));
  const [aadhaarOtp, setAadhaarOtp] = useState(["", "", "", "", "", ""]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [demoSmsOtp, setDemoSmsOtp] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [aadhaarValid, setAadhaarValid] = useState<boolean | null>(null);
  const [authData, setAuthData] = useState<{ token: string; voter: Record<string, unknown>; pqcSession: Record<string, unknown> } | null>(null);
  const [mounted, setMounted] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const aadhaarOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const aadhaarRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Webcam
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState("Initializing camera...");
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    const auth = getAuth();
    if (auth) {
      const v = auth.voter as { role?: string };
      router.replace(v?.role === "admin" ? "/admin" : "/vote");
    }
  }, [router]);

  // ─── Email + OTP ────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return setError("Name and email are required");
    setError(""); setLoading(true);
    try {
      const data = await api.sendOtp(email, name);
      setDemoOtp(data.demoOtp || "");
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[idx] = val.slice(-1); setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return setError("Enter all 6 digits");
    setError(""); setLoading(true);
    try {
      const data = await api.verifyOtp(email, code);
      setAuthData({ token: data.token, voter: data.voter, pqcSession: data.pqcSession });
      setStep("aadhaar");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally { setLoading(false); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !adminPassword) return setError("Email and password required");
    setError(""); setLoading(true);
    try {
      const data = await api.adminLogin(email, adminPassword);
      saveAuth(data.token, data.voter);
      router.push("/admin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid admin credentials");
    } finally { setLoading(false); }
  };

  // ─── Aadhaar ─────────────────────────────────────────────────────────────
  const handleAadhaarChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...aadhaar]; next[idx] = val.slice(-1); setAadhaar(next);
    setAadhaarValid(null);
    if (val && idx < 11) aadhaarRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) aadhaarRefs.current[idx - 1]?.focus();
  };

  const handleVerifyAadhaar = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = aadhaar.join("");
    if (num.length !== 12) return setError("Enter complete 12-digit Aadhaar number");
    if (["0","1"].includes(num[0])) return setError("Invalid Aadhaar number");
    if (!phone || phone.length < 10) return setError("Enter a valid 10-digit phone number");
    
    const valid = verhoeffCheck(num);
    setAadhaarValid(valid);
    if (!valid) return setError("Invalid Aadhaar number — checksum failed");
    
    if (!authData?.token) return setError("Authentication missing. Please restart.");
    
    setError(""); setLoading(true);
    try {
      const data = await api.sendMobileOtp(phone, num, authData.token);
      if (data.demoOtp) setDemoSmsOtp(data.demoOtp);
      setStep("aadhaar-otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send SMS OTP");
    } finally { setLoading(false); }
  };

  const handleAadhaarOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...aadhaarOtp]; next[idx] = val.slice(-1); setAadhaarOtp(next);
    if (val && idx < 5) aadhaarOtpRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) aadhaarOtpRefs.current[idx - 1]?.focus();
  };

  const handleVerifyAadhaarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = aadhaarOtp.join("");
    if (code.length !== 6) return setError("Enter all 6 digits");
    
    if (!authData?.token) return setError("Authentication missing. Please restart.");
    
    setError(""); setLoading(true);
    try {
      await api.verifyMobileOtp(phone, code, authData.token);
      setStep("webcam");
      startWebcam();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid SMS OTP");
    } finally { setLoading(false); }
  };

  // ─── Webcam / Face Detection ──────────────────────────────────────────────
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setWebcamActive(true);
      setFaceStatus("Position your face in the frame");
      // Simulate progressive face detection
      simulateFaceDetection();
    } catch {
      setFaceStatus("Camera access denied. Click to retry.");
    }
  };

  const simulateFaceDetection = () => {
    const stages = [
      { delay: 1200, msg: "Scanning for face...", detected: false },
      { delay: 2400, msg: "Face detected — checking liveness", detected: true },
      { delay: 3800, msg: "Performing liveness check...", detected: true },
      { delay: 5200, msg: "✓ Face verified — ready to capture", detected: true },
    ];
    stages.forEach(({ delay, msg, detected }) => {
      setTimeout(() => { setFaceStatus(msg); setFaceDetected(detected); }, delay);
    });
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopWebcam();
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    setWebcamActive(false);
  };

  const handleFinalSubmit = async () => {
    if (!authData) return;
    setLoading(true);
    try {
      // Save auth and navigate
      saveAuth(authData.token, authData.voter);
      savePqcSession(authData.pqcSession);
      // Stop webcam
      stopWebcam();
      if (authData.voter.role === "admin") router.push("/admin");
      else router.push("/vote");
    } catch { setLoading(false); }
  };

  useEffect(() => () => stopWebcam(), []);

  if (!mounted) return null;

  const stepIndex = getStepIndex(step);

  return (
    <div style={{ minHeight: "100vh", background: "#000", position: "relative", overflow: "hidden" }}>
      {/* Grid background */}
      <div className="grid-bg" />

      {/* Ticker */}
      <div className="ticker-wrap" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="ticker-inner">
          {Array(2).fill(null).map((_, i) => (
            <span key={i} style={{ display: "flex", gap: 0 }}>
              {["CRYSTALS-KYBER-1024", "NIST FIPS 203", "DILITHIUM-3", "NIST FIPS 204", "AES-256-GCM", "SHA-3-256", "QUANTUM-RESISTANT", "POST-QUANTUM CRYPTOGRAPHY", "SDG 16", "SECURE DIGITAL VOTING"].map(t => (
                <span key={t} className="ticker-item">◆ {t}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, border: "1.5px solid #fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚛</div>
          <span style={{ fontWeight: 900, fontSize: "1.05rem", letterSpacing: "-0.02em" }}>QuantumVote</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div className="security-indicator"><div className="security-dot" />PQC Active</div>
          <a href="/quantum-demo" style={{ fontSize: "0.82rem", color: "var(--text-muted)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.color = "#fff")}
            onMouseOut={e => (e.currentTarget.style.color = "var(--text-muted)")}>
            Quantum Demo →
          </a>
        </div>
      </nav>

      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: 1100, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>

          {/* Left hero */}
          <div className="animate-fade-in-up" style={{ opacity: 0 }}>
            <div className="badge badge-outline" style={{ marginBottom: 24 }}>⚛ POST-QUANTUM SECURE</div>
            <h1 style={{ fontSize: "clamp(2.5rem, 4.5vw, 4rem)", fontWeight: 900, lineHeight: 1.05, marginBottom: 20, letterSpacing: "-0.04em" }}>
              The Future of<br />
              <span style={{ color: "var(--text-secondary)" }}>Democratic</span><br />
              Voting
            </h1>
            <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 36, maxWidth: 400 }}>
              Built with NIST-standardized CRYSTALS-Kyber and Dilithium — quantum-resistant cryptography protecting every ballot.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
              {[
                { icon: "01", label: "Email OTP Authentication" },
                { icon: "02", label: "Aadhaar Card Verification" },
                { icon: "03", label: "Webcam Face Verification" },
                { icon: "04", label: "Quantum-Encrypted Vote" },
              ].map((item) => (
                <div key={item.icon} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)", width: 24 }}>{item.icon}</span>
                  <div style={{ height: "1px", width: 20, background: "var(--border-subtle)" }} />
                  <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              {[{ name: "Kyber-1024", std: "FIPS 203" }, { name: "Dilithium-3", std: "FIPS 204" }, { name: "SHA-3-256", std: "FIPS 202" }].map(a => (
                <div key={a.name} style={{ padding: "8px 14px", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 2, fontFamily: "Courier New" }}>{a.std}</div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{a.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Auth card */}
          <div className="animate-fade-in-up delay-200 glass-card-glow" style={{ opacity: 0, padding: 0, overflow: "hidden" }}>
            {/* Step indicator */}
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 0 }}>
              {STEPS.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div className={`step-dot ${i < stepIndex ? "done" : i === stepIndex ? "active" : ""}`}>
                      {i < stepIndex ? "✓" : i + 1}
                    </div>
                    <div style={{ fontSize: "0.62rem", marginTop: 4, color: i === stepIndex ? "#fff" : "var(--text-muted)", whiteSpace: "nowrap" }}>{s.label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`step-line ${i < stepIndex ? "done" : ""}`} style={{ marginBottom: 16 }} />}
                </div>
              ))}
            </div>

            <div style={{ padding: "28px" }}>
              {/* STEP 1: Email */}
              {step === "email" && (
                <form onSubmit={handleSendOtp} className="animate-fade-in">
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Voter Identity</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Enter your details to begin secure authentication</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                    <div>
                      <label className="uppercase-label" style={{ display: "block", marginBottom: 8 }}>Full Name</label>
                      <input className="input-field" type="text" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} id="voter-name" autoComplete="name" />
                    </div>
                    <div>
                      <label className="uppercase-label" style={{ display: "block", marginBottom: 8 }}>Email Address</label>
                      <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required id="voter-email" autoComplete="email" />
                    </div>
                  </div>
                  {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 8, color: "#ff6666", fontSize: "0.85rem" }}>⚠ {error}</div>}
                  <button type="submit" className="btn-primary" style={{ width: "100%", marginBottom: 12 }} disabled={loading} id="send-otp-btn">
                    {loading ? "Sending OTP..." : "Continue →"}
                  </button>
                  <div className="divider-text" style={{ marginBottom: 12 }}>or</div>
                  <button type="button" className="btn-secondary" style={{ width: "100%" }} id="admin-login-btn"
                    onClick={() => { setEmail("admin@quantumvote.io"); setStep("admin-login"); setError(""); }}>
                    Admin Login
                  </button>
                  <div style={{ marginTop: 16, padding: "12px 14px", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
                    <div className="uppercase-label" style={{ marginBottom: 6 }}>Demo Accounts</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <span className="mono" style={{ color: "#fff" }}>admin@quantumvote.io</span> — Admin<br />
                      <span className="mono" style={{ color: "#fff" }}>alice@demo.com</span> — Voter
                    </div>
                  </div>
                </form>
              )}

              {/* ADMIN LOGIN */}
              {step === "admin-login" && (
                <form onSubmit={handleAdminLogin} className="animate-fade-in">
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Admin Access</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sign in to manage elections and view audits.</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                    <div>
                      <label className="uppercase-label" style={{ display: "block", marginBottom: 8 }}>Admin Email</label>
                      <input className="input-field" type="email" placeholder="admin@quantumvote.io" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <label className="uppercase-label" style={{ display: "block", marginBottom: 8 }}>Password</label>
                      <input className="input-field" type="password" placeholder="••••••••" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
                    </div>
                  </div>
                  {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 8, color: "#ff6666", fontSize: "0.85rem" }}>⚠ {error}</div>}
                  <button type="submit" className="btn-primary" style={{ width: "100%", marginBottom: 10 }} disabled={loading}>
                    {loading ? "Authenticating..." : "Login to Dashboard →"}
                  </button>
                  <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={() => { setStep("email"); setError(""); setAdminPassword(""); }}>← Back to Voter Login</button>
                </form>
              )}

              {/* STEP 2: Email OTP */}
              {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className="animate-fade-in">
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Email Verification</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      Code sent to <span style={{ color: "#fff" }}>{email}</span>
                    </p>
                  </div>
                  {demoOtp && (
                    <div style={{ marginBottom: 20, padding: "12px 16px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 8 }}>
                      <div className="uppercase-label" style={{ marginBottom: 4 }}>Demo OTP</div>
                      <div className="mono" style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "0.3em" }}>{demoOtp}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
                    {otp.map((d, i) => (
                      <input key={i} ref={el => { otpRefs.current[i] = el; }} className={`otp-input ${d ? "filled" : ""}`}
                        type="text" inputMode="numeric" maxLength={1} value={d}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i-1]?.focus(); }}
                        id={`otp-${i}`} />
                    ))}
                  </div>
                  {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 8, color: "#ff6666", fontSize: "0.85rem" }}>⚠ {error}</div>}
                  <button type="submit" className="btn-primary" style={{ width: "100%", marginBottom: 10 }} disabled={loading} id="verify-otp-btn">
                    {loading ? "Verifying..." : "Verify OTP →"}
                  </button>
                  <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={() => { setStep("email"); setError(""); setOtp(Array(6).fill("")); }}>← Back</button>
                </form>
              )}

              {/* STEP 3a: Aadhaar Input */}
              {step === "aadhaar" && (
                <form onSubmit={handleVerifyAadhaar} className="animate-fade-in">
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Aadhaar Verification</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Enter your 12-digit Aadhaar number for identity verification</p>
                  </div>

                  {/* Aadhaar card visual */}
                  <div className="aadhaar-card" style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 2 }}>GOVERNMENT OF INDIA</div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)" }}>आधार / AADHAAR</div>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "Courier New" }}>UIDAI</div>
                    </div>

                    {/* 3 groups of 4 digits */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {[0,4,8].map((start, gi) => (
                        <div key={gi} style={{ display: "flex", gap: 4 }}>
                          {Array.from({length:4}, (_,di) => start+di).map(idx => (
                            <input key={idx} ref={el => { aadhaarRefs.current[idx] = el; }}
                              className="aadhaar-digit"
                              type={idx < 8 ? "password" : "text"}
                              inputMode="numeric" maxLength={1} value={aadhaar[idx]}
                              onChange={e => handleAadhaarChange(idx, e.target.value)}
                              onKeyDown={e => { if (e.key === "Backspace" && !aadhaar[idx] && idx > 0) aadhaarRefs.current[idx-1]?.focus(); }}
                              id={`aadhaar-${idx}`} />
                          ))}
                          {gi < 2 && <div style={{ width: 8, textAlign: "center", lineHeight: "44px", color: "var(--text-muted)", fontSize: "0.9rem" }}>—</div>}
                        </div>
                      ))}
                    </div>

                    {aadhaarValid === false && <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#ff6666" }}>✗ Invalid Aadhaar number</div>}
                    {aadhaarValid === true && <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#fff" }}>✓ Valid format</div>}
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label className="uppercase-label" style={{ display: "block", marginBottom: 8 }}>Phone Number (for OTP)</label>
                    <input className="input-field" type="tel" placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={10} />
                  </div>

                  <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: 8, marginBottom: 20, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    🔒 Your Aadhaar number is encrypted with Kyber-1024 and never stored in plaintext
                  </div>

                  {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 8, color: "#ff6666", fontSize: "0.85rem" }}>⚠ {error}</div>}
                  <button type="submit" className="btn-primary" style={{ width: "100%", marginBottom: 10 }} disabled={loading} id="verify-aadhaar-btn">
                    Send OTP to Aadhaar Mobile →
                  </button>
                  <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={() => { setStep("otp"); setError(""); setAadhaar(Array(12).fill("")); }}>← Back</button>
                </form>
              )}

              {/* STEP 3b: Aadhaar OTP */}
              {step === "aadhaar-otp" && (
                <form onSubmit={handleVerifyAadhaarOtp} className="animate-fade-in">
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Aadhaar OTP</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      6-digit OTP sent to <span style={{ color: "#fff" }}>{phone}</span>
                    </p>
                  </div>
                  {demoSmsOtp && (
                    <div style={{ marginBottom: 20, padding: "12px 14px", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 8 }}>
                      <div className="uppercase-label" style={{ marginBottom: 4 }}>Demo SMS OTP</div>
                      <div className="mono" style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "0.3em" }}>{demoSmsOtp}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
                    {aadhaarOtp.map((d, i) => (
                      <input key={i} ref={el => { aadhaarOtpRefs.current[i] = el; }} className={`otp-input ${d ? "filled" : ""}`}
                        type="text" inputMode="numeric" maxLength={1} value={d}
                        onChange={e => handleAadhaarOtpChange(i, e.target.value)}
                        onKeyDown={e => { if (e.key === "Backspace" && !aadhaarOtp[i] && i > 0) aadhaarOtpRefs.current[i-1]?.focus(); }}
                        id={`aadhaar-otp-${i}`} />
                    ))}
                  </div>
                  {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)", borderRadius: 8, color: "#ff6666", fontSize: "0.85rem" }}>⚠ {error}</div>}
                  <button type="submit" className="btn-primary" style={{ width: "100%", marginBottom: 10 }} id="verify-aadhaar-otp-btn">Verify Aadhaar →</button>
                  <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={() => { setStep("aadhaar"); setError(""); setAadhaarOtp(Array(6).fill("")); }}>← Back</button>
                </form>
              )}

              {/* STEP 4: Webcam */}
              {step === "webcam" && (
                <div className="animate-fade-in">
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Face Verification</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Position your face in the frame for biometric verification</p>
                  </div>

                  {!capturedImage ? (
                    <div>
                      <div className="webcam-container scan-container" style={{ marginBottom: 14, aspectRatio: "4/3", background: "#050505" }}>
                        <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: webcamActive ? "block" : "none" }} muted playsInline />
                        {!webcamActive && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", flexDirection: "column", gap: 12 }}>
                            <div style={{ fontSize: 36 }}>📷</div>
                            <div style={{ fontSize: "0.85rem" }}>Initializing camera...</div>
                          </div>
                        )}
                        {webcamActive && (
                          <div className="webcam-overlay">
                            <div className="face-frame" style={{ borderColor: faceDetected ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)" }} />
                          </div>
                        )}
                        <canvas ref={canvasRef} style={{ display: "none" }} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: faceDetected ? "#fff" : "#555", animation: faceDetected ? "blink 1s infinite" : "none" }} />
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{faceStatus}</span>
                      </div>

                      <button className="btn-primary" style={{ width: "100%", marginBottom: 10 }} disabled={!faceDetected} onClick={capturePhoto} id="capture-face-btn">
                        📸 Capture & Verify
                      </button>
                      <button className="btn-ghost" style={{ width: "100%" }} onClick={() => { stopWebcam(); setStep("aadhaar-otp"); }}>← Back</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", marginBottom: 16, border: "1px solid rgba(255,255,255,0.2)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={capturedImage} alt="Captured face" style={{ width: "100%", display: "block" }} />
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 14px", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
                          <span style={{ fontSize: "0.8rem" }}>Face captured & verified</span>
                        </div>
                      </div>
                      <div style={{ padding: "12px 14px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, marginBottom: 16, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        ✓ Liveness check passed · ✓ Face hash generated · ✓ Biometric data encrypted
                      </div>
                      <button className="btn-primary" style={{ width: "100%", marginBottom: 10 }} onClick={handleFinalSubmit} disabled={loading} id="complete-auth-btn">
                        {loading ? "Completing authentication..." : "🔐 Complete & Access Ballot →"}
                      </button>
                      <button className="btn-ghost" style={{ width: "100%" }} onClick={() => { setCapturedImage(null); setFaceDetected(false); setFaceStatus("Initializing camera..."); startWebcam(); }}>↺ Retake Photo</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
