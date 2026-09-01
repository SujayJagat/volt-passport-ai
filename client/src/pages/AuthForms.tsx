import { FormEvent, useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, CheckCircle2, Eye, EyeOff, Gauge, KeyRound, Loader2, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import AppFooter from "@/components/AppFooter";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";
import { useAuth } from "@/contexts/AuthContext";

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={event => onChange(event.target.value)}
          required
          autoComplete="new-password"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible(current => !current)}
        >
          {visible ? <EyeOff size={15}/> : <Eye size={15}/>}
        </button>
      </div>
    </label>
  );
}

function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: React.ReactNode; description: string; children: React.ReactNode }) {
  return (
    <main className="local-auth-page" style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      <div className="local-auth-atmosphere"/>
      <div className="hero-orb hero-orb-one" style={{ opacity: 0.35, pointerEvents: "none" }}/>
      <div className="hero-orb hero-orb-two" style={{ opacity: 0.25, pointerEvents: "none" }}/>

      <header className="top-nav" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(3, 7, 9, 0.75)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0, 245, 212, 0.15)" }}>
        <Link className="wordmark" href="/">
          <span className="mark">
            <svg viewBox="0 0 21 21" width="21" height="21" xmlns="http://www.w3.org/2000/svg">
              <text x="10.5" y="15" fill="#00f5d4" fontFamily="monospace" fontSize="14" textAnchor="middle">V</text>
            </svg>
          </span>
          <span>VOLT<span className="wordmark-muted">PASSPORT</span><b> AI</b></span>
        </Link>
        <Link href="/" className="nav-button" style={{ borderRadius: "4px", padding: "6px 14px", fontSize: "11px" }}>
          <ArrowLeft size={13}/> Back to Home
        </Link>
      </header>

      <section className="local-auth-layout">
        <div className="local-auth-intro">
          <span className="signal-kicker">
            <span className="signal-line"/> BATTERY WORKSPACE ACCESS
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="local-auth-badges">
            <span><Gauge size={14}/> Open Analyzer controls</span>
            <span><Activity size={14}/> Review battery signal</span>
            <span><CheckCircle2 size={14}/> Live Database</span>
          </div>
        </div>
        <article className="local-auth-card" style={{ borderRadius: "8px" }}>
          <span className="small-label">{eyebrow}</span>
          {children}
        </article>
      </section>
      <AppFooter/>
    </main>
  );
}

export function SignIn() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      setLocation("/dashboard");
    } else {
      setErrorMsg(result.error || "Invalid workspace email or password.");
    }
  };

  const handleDemoLogin = async () => {
    setEmail("demo@voltpassport.ai");
    setPassword("password123");
    setLoading(true);
    setErrorMsg("");
    const result = await login("demo@voltpassport.ai", "password123");
    setLoading(false);
    if (result.success) {
      setLocation("/dashboard");
    } else {
      setErrorMsg(result.error || "Demo login failed.");
    }
  };

  return (
    <AuthShell
      eyebrow="RETURNING BATTERY OPERATOR"
      title={<>Return to your<br/><em>battery workspace.</em></>}
      description="Sign in to your VoltPassport workspace powered by PocketBase to manage registered batteries, analyze live telemetry, and generate digital battery passports."
    >
      <h2>Sign in</h2>
      <p className="auth-form-copy">Use the email and password assigned to your VoltPassport workspace.</p>
      
      <form onSubmit={submit} className="local-auth-form">
        <label className="auth-field">
          <span>Workspace email</span>
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder="e.g. operator@voltpassport.ai"
          />
        </label>

        <PasswordField id="sign-in-password" label="Workspace password" value={password} onChange={setPassword}/>

        {errorMsg && (
          <p className="local-auth-notice is-error">
            {errorMsg}
          </p>
        )}

        <button className="button button-solid local-auth-submit" type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={15}/> : <ArrowUpRight size={15}/>}
          {loading ? "Signing in..." : "Open workspace"}
        </button>

        <div style={{ textAlign: "center", margin: "12px 0 4px" }}>
          <button
            type="button"
            className="button button-outline"
            style={{ width: "100%", justifyContent: "center", fontSize: "10px", padding: "8px 12px" }}
            onClick={handleDemoLogin}
            disabled={loading}
          >
            <KeyRound size={13}/> Quick Demo Login (demo@voltpassport.ai)
          </button>
        </div>
      </form>

      <p className="local-auth-switch">New battery workspace? <Link href="/register">Register a battery</Link></p>
    </AuthShell>
  );
}

export function Register() {
  const [, setLocation] = useLocation();
  const { register: authRegister, isAuthenticated } = useAuth();
  const { loading: datasetLoading, selectBatteryId } = useBatteryDataset();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedBatteryId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("battery")?.trim().toUpperCase() ?? "BAT0001"; } catch { return "BAT0001"; }
  });
  const [batteryId, setBatteryId] = useState(linkedBatteryId);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsError(false);
    setStatusMessage("");

    if (password !== confirmPassword) {
      setIsError(true);
      setStatusMessage("Passwords do not match. Please review both fields.");
      return;
    }

    if (password.length < 8) {
      setIsError(true);
      setStatusMessage("Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);

    // Verify or select battery in dataset / DB
    const selection = await selectBatteryId(batteryId);
    if (!selection.found) {
      setIsError(true);
      setSubmitting(false);
      setStatusMessage(`Battery ID ${batteryId.trim().toUpperCase() || "entered"} was not found. Please use a recognised ID such as BAT0001 through BAT2000.`);
      return;
    }

    const fullName = `${firstName} ${lastName}`.trim() || "Operator";
    const res = await authRegister({
      email,
      password,
      passwordConfirm: confirmPassword,
      name: fullName,
      activeBatteryId: selection.record?.batteryId || batteryId.toUpperCase(),
    });

    setSubmitting(false);

    if (res.success) {
      setStatusMessage(`Account created successfully! Active battery ${selection.record?.batteryId || batteryId} linked.`);
      setTimeout(() => {
        setLocation("/dashboard");
      }, 700);
    } else {
      setIsError(true);
      setStatusMessage(res.error || "Failed to register account in database.");
    }
  };

  return (
    <AuthShell
      eyebrow="NEW BATTERY REGISTRATION"
      title={<>Create a<br/><em>battery profile.</em></>}
      description="Register an operator account in PocketBase and connect a Battery ID from the dataset (e.g. BAT0001 to BAT2000) to create a verified, traceable battery health profile."
    >
      <h2>Register battery</h2>
      <p className="auth-form-copy">Add operator details and a recognized Battery ID to initialize your VoltPassport account in the database.</p>
      
      <form onSubmit={submit} className="local-auth-form">
        <div className="auth-name-row">
          <label className="auth-field">
            <span>First name</span>
            <input
              type="text"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="e.g. Sujay"
            />
          </label>
          <label className="auth-field">
            <span>Last name</span>
            <input
              type="text"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="e.g. Jagat"
            />
          </label>
        </div>

        <label className="auth-field">
          <span>Battery ID (from Database/Dataset)</span>
          <input
            type="text"
            required
            value={batteryId}
            onChange={event => {
              setBatteryId(event.target.value.toUpperCase());
              setIsError(false);
              setStatusMessage("");
            }}
            placeholder="e.g. BAT0001"
            autoCapitalize="characters"
          />
          <small>Available range: BAT0001–BAT2000 (Seeded in PocketBase)</small>
        </label>

        <label className="auth-field">
          <span>Workspace email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. operator@company.com"
          />
        </label>

        <PasswordField id="register-password" label="Create password (min 8 chars)" value={password} onChange={setPassword}/>
        <PasswordField id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword}/>

        {statusMessage && (
          <div className={`auth-dataset-match ${isError ? "is-error" : ""}`}>
            <strong>{isError ? "Registration notice" : "Registration successful"}</strong>
            <br/>{statusMessage}
          </div>
        )}

        <button className="button button-solid local-auth-submit" type="submit" disabled={submitting || datasetLoading}>
          {submitting ? <Loader2 className="animate-spin" size={15}/> : <UserPlus size={15}/>}
          {submitting ? "Registering in Database..." : "Match & register battery"} <ArrowUpRight size={15}/>
        </button>
      </form>

      <p className="local-auth-switch">Already have a battery workspace? <Link href="/sign-in">Sign in</Link></p>
    </AuthShell>
  );
}
