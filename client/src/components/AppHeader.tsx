import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  ArrowUpRight,
  DatabaseZap,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";

export default function AppHeader() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { activeRecord, rfModel, rfModelLoaded } = useBatteryDataset();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCurrent = (path: string) => location === path;

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="top-nav header-responsive">
      <div className="header-brand-wrap">
        <Link className="wordmark" href="/" onClick={closeMenu}>
          <span className="mark">
            <svg viewBox="0 0 21 21" width="21" height="21" xmlns="http://www.w3.org/2000/svg">
              <text x="10.5" y="15" fill="#00f5d4" fontFamily="monospace" fontSize="14" textAnchor="middle">V</text>
            </svg>
          </span>
          <span>
            VOLT<span className="wordmark-muted">PASSPORT</span><b> AI</b>
          </span>
        </Link>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="nav-links desktop-only-nav">
        <Link href="/signal" className={isCurrent("/signal") ? "active-link" : ""}>
          Signal
        </Link>
        <Link href="/analyzer" className={isCurrent("/analyzer") ? "active-link" : ""}>
          Analyzer
        </Link>
        <Link href="/explainability" className={isCurrent("/explainability") ? "active-link" : ""}>
          Explainability
        </Link>
        <Link href="/passport" className={isCurrent("/passport") ? "active-link" : ""}>
          Passport
        </Link>
        <Link href="/dashboard" className={isCurrent("/dashboard") ? "active-link" : ""}>
          Workspace
        </Link>
      </nav>

      {/* Desktop Right Panel */}
      <div className="nav-right desktop-only-right">
        <span className="live-dot">
          <i></i> {rfModelLoaded ? (rfModel?.modelType === "GradientBoostingRegressor" ? "GBDT MODEL · 100 TREES" : "RF MODEL · 100 TREES") : "POCKETBASE DB"}
        </span>

        {isAuthenticated && user ? (
          <div className="header-user-badge">
            <span className="header-user-pill">
              <User size={12}/>
              <span className="header-user-name">{user.name}</span>
              {activeRecord && (
                <strong className="header-battery-tag">
                  {activeRecord.batteryId}
                </strong>
              )}
            </span>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className="header-exit-btn"
            >
              <LogOut size={12}/> Exit
            </button>
          </div>
        ) : (
          <Link className="nav-button header-signin-btn" href="/sign-in">
            Sign In <ArrowUpRight size={13}/>
          </Link>
        )}
      </div>

      {/* Mobile Menu Hamburger Button */}
      <div className="mobile-toggle-wrap">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={() => setMobileMenuOpen(open => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={closeMenu}>
          <div
            className="mobile-drawer-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            <div className="mobile-drawer-header">
              <span className="signal-kicker">
                <span className="signal-line"/> VOLTPASSPORT NAVIGATION
              </span>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={closeMenu}
                aria-label="Close menu"
              >
                <X size={18}/>
              </button>
            </div>

            {/* Model & Active Pack Status Strip */}
            <div className="mobile-status-card">
              <div className="mobile-status-row">
                <span className="live-dot">
                  <i></i> {rfModelLoaded ? "RF MODEL ACTIVE (100 TREES)" : "POCKETBASE DB"}
                </span>
                {activeRecord && (
                  <strong className="header-battery-tag">
                    <Zap size={10} style={{ display: "inline", marginRight: "2px" }}/>
                    {activeRecord.batteryId}
                  </strong>
                )}
              </div>
              {isAuthenticated && user && (
                <div className="mobile-user-status">
                  <User size={13} style={{ color: "var(--cyan)" }}/>
                  <span>Signed in as <b>{user.name}</b></span>
                </div>
              )}
            </div>

            {/* Nav links */}
            <nav className="mobile-nav-list">
              <Link
                href="/signal"
                onClick={closeMenu}
                className={`mobile-nav-item ${isCurrent("/signal") ? "active" : ""}`}
              >
                <span className="mobile-nav-icon"><Activity size={16}/></span>
                <div>
                  <strong>Signal</strong>
                  <small>Telemetry & cycle history</small>
                </div>
                {isCurrent("/signal") && <span className="mobile-nav-indicator">CURRENT</span>}
              </Link>

              <Link
                href="/analyzer"
                onClick={closeMenu}
                className={`mobile-nav-item ${isCurrent("/analyzer") ? "active" : ""}`}
              >
                <span className="mobile-nav-icon"><Gauge size={16}/></span>
                <div>
                  <strong>Analyzer</strong>
                  <small>Live health model & simulation</small>
                </div>
                {isCurrent("/analyzer") && <span className="mobile-nav-indicator">CURRENT</span>}
              </Link>

              <Link
                href="/explainability"
                onClick={closeMenu}
                className={`mobile-nav-item ${isCurrent("/explainability") ? "active" : ""}`}
              >
                <span className="mobile-nav-icon"><Sparkles size={16}/></span>
                <div>
                  <strong>Explainability</strong>
                  <small>Random Forest feature ranking</small>
                </div>
                {isCurrent("/explainability") && <span className="mobile-nav-indicator">CURRENT</span>}
              </Link>

              <Link
                href="/passport"
                onClick={closeMenu}
                className={`mobile-nav-item ${isCurrent("/passport") ? "active" : ""}`}
              >
                <span className="mobile-nav-icon"><ShieldCheck size={16}/></span>
                <div>
                  <strong>Digital Passport</strong>
                  <small>Verified battery certificate</small>
                </div>
                {isCurrent("/passport") && <span className="mobile-nav-indicator">CURRENT</span>}
              </Link>

              <Link
                href="/dashboard"
                onClick={closeMenu}
                className={`mobile-nav-item ${isCurrent("/dashboard") ? "active" : ""}`}
              >
                <span className="mobile-nav-icon"><LayoutDashboard size={16}/></span>
                <div>
                  <strong>Operator Workspace</strong>
                  <small>Claimed battery fleet & records</small>
                </div>
                {isCurrent("/dashboard") && <span className="mobile-nav-indicator">CURRENT</span>}
              </Link>
            </nav>

            {/* Footer / Auth Actions */}
            <div className="mobile-drawer-footer">
              {isAuthenticated && user ? (
                <button
                  type="button"
                  onClick={() => { logout(); closeMenu(); }}
                  className="button button-outline mobile-auth-btn"
                >
                  <LogOut size={14}/> Sign Out of Workspace
                </button>
              ) : (
                <div className="mobile-auth-actions">
                  <Link
                    href="/sign-in"
                    onClick={closeMenu}
                    className="button button-solid mobile-auth-btn"
                  >
                    Sign In to Workspace <ArrowUpRight size={14}/>
                  </Link>
                  <Link
                    href="/register"
                    onClick={closeMenu}
                    className="button button-outline mobile-auth-btn"
                  >
                    Register Battery <ArrowUpRight size={14}/>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

