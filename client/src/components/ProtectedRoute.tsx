import React from "react";
import { Link } from "wouter";
import { ShieldAlert, ArrowRight, Lock, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AppFooter from "./AppFooter";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loading, login } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#010809", color: "#eef5f3" }}>
        <p style={{ fontFamily: "monospace", color: "var(--cyan)" }}>AUTHENTICATING WORKSPACE...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <nav className="top-nav" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(3, 7, 9, 0.75)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0, 245, 212, 0.15)" }}>
          <Link className="wordmark" href="/">
            <span className="mark">
              <svg viewBox="0 0 21 21" width="21" height="21" xmlns="http://www.w3.org/2000/svg">
                <text x="10.5" y="15" fill="#00f5d4" fontFamily="monospace" fontSize="14" textAnchor="middle">V</text>
              </svg>
            </span>
            <span>VOLT<span className="wordmark-muted">PASSPORT</span><b> AI</b></span>
          </Link>
          <div className="nav-right" style={{ display: "flex" }}>
            <Link className="nav-button" href="/sign-in" style={{ borderRadius: "4px", padding: "6px 14px", fontSize: "11px" }}>
              Sign In ↗
            </Link>
          </div>
        </nav>

        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "rgba(10, 23, 25, 0.95)",
              border: "1px solid rgba(0, 245, 212, 0.3)",
              borderRadius: "8px",
              padding: "36px 30px",
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(0, 245, 212, 0.1)",
                border: "1px solid var(--cyan)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                color: "var(--cyan)",
              }}
            >
              <Lock size={26}/>
            </div>

            <span className="signal-kicker" style={{ justifyContent: "center", marginBottom: "8px" }}>
              <i/> ACCESS RESTRICTED · AUTHENTICATION REQUIRED
            </span>
            <h1 style={{ fontSize: "24px", color: "#eef5f3", margin: "10px 0 12px", fontFamily: "Space Grotesk, sans-serif" }}>
              Private Battery Intelligence
            </h1>
            <p style={{ color: "#95adab", fontSize: "14px", lineHeight: "1.6", marginBottom: "28px" }}>
              Battery telemetry, ML health diagnostics, and digital passports are protected assets. Please sign in to access only your assigned battery records.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link className="button button-solid" href="/sign-in" style={{ justifyContent: "center", width: "100%" }}>
                Sign In to Workspace <ArrowRight size={15}/>
              </Link>
              <Link className="button button-outline" href="/register" style={{ justifyContent: "center", width: "100%" }}>
                Register New Operator Account
              </Link>
              <button
                type="button"
                onClick={() => login("demo@voltpassport.ai", "password123")}
                style={{
                  marginTop: "8px",
                  background: "none",
                  border: 0,
                  color: "var(--cyan)",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Quick Demo Sign-In (demo@voltpassport.ai)
              </button>
            </div>
          </div>
        </main>

        <AppFooter/>
      </div>
    );
  }

  return <>{children}</>;
}
