import React from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, LogOut, ShieldCheck, User, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";

export default function AppHeader() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { activeRecord, rfModel, rfModelLoaded } = useBatteryDataset();

  const isCurrent = (path: string) => location === path;

  return (
    <header className="top-nav" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(3, 7, 9, 0.75)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0, 245, 212, 0.15)" }}>
      <Link className="wordmark" href="/">
        <span className="mark">
          <svg viewBox="0 0 21 21" width="21" height="21" xmlns="http://www.w3.org/2000/svg">
            <text x="10.5" y="15" fill="#00f5d4" fontFamily="monospace" fontSize="14" textAnchor="middle">V</text>
          </svg>
        </span>
        <span>
          VOLT<span className="wordmark-muted">PASSPORT</span><b> AI</b>
        </span>
      </Link>

      <nav className="nav-links" style={{ display: "flex", gap: "24px", alignItems: "center" }}>
        <Link href="/signal" style={{ color: isCurrent("/signal") ? "var(--cyan)" : undefined, fontWeight: isCurrent("/signal") ? "bold" : "normal" }}>
          Signal
        </Link>
        <Link href="/analyzer" style={{ color: isCurrent("/analyzer") ? "var(--cyan)" : undefined, fontWeight: isCurrent("/analyzer") ? "bold" : "normal" }}>
          Analyzer
        </Link>
        <Link href="/explainability" style={{ color: isCurrent("/explainability") ? "var(--cyan)" : undefined, fontWeight: isCurrent("/explainability") ? "bold" : "normal" }}>
          Explainability
        </Link>
        <Link href="/passport" style={{ color: isCurrent("/passport") ? "var(--cyan)" : undefined, fontWeight: isCurrent("/passport") ? "bold" : "normal" }}>
          Passport
        </Link>
        <Link href="/dashboard" style={{ color: isCurrent("/dashboard") ? "var(--cyan)" : undefined, fontWeight: isCurrent("/dashboard") ? "bold" : "normal" }}>
          Workspace
        </Link>
      </nav>

      <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <span className="live-dot" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <i></i> {rfModelLoaded ? (rfModel?.modelType === "GradientBoostingRegressor" ? "GBDT MODEL · 100 TREES" : "RF MODEL · 100 TREES") : "POCKETBASE DB"}
        </span>

        {isAuthenticated && user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                background: "rgba(0, 245, 212, 0.08)",
                border: "1px solid rgba(0, 245, 212, 0.25)",
                borderRadius: "4px",
                fontSize: "11px",
                fontFamily: "monospace",
                color: "var(--cyan)",
              }}
            >
              <User size={12}/>
              {user.name}
              {activeRecord && (
                <strong style={{ marginLeft: "4px", padding: "1px 5px", background: "rgba(0, 245, 212, 0.2)", borderRadius: "3px" }}>
                  {activeRecord.batteryId}
                </strong>
              )}
            </span>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "none",
                border: "1px solid rgba(180, 224, 220, 0.15)",
                borderRadius: "4px",
                padding: "4px 8px",
                color: "#8fa5a1",
                fontSize: "11px",
                fontFamily: "monospace",
                cursor: "pointer",
              }}
            >
              <LogOut size={12}/> Exit
            </button>
          </div>
        ) : (
          <Link className="nav-button" href="/sign-in" style={{ borderRadius: "4px", padding: "6px 14px", fontSize: "11px" }}>
            Sign In <ArrowUpRight size={13}/>
          </Link>
        )}
      </div>
    </header>
  );
}
