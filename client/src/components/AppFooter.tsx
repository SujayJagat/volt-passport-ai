import { Link } from "wouter";

export default function AppFooter() {
  return <footer className="site-footer">
    <div className="footer-brand">VOLT<span>PASSPORT</span> <b>AI</b></div>
    <nav aria-label="Footer navigation"><Link href="/signal">Signal</Link><Link href="/analyzer">Analyzer</Link><Link href="/explainability">Explainability</Link><Link href="/passport">Passport</Link><Link href="/dashboard">Workspace</Link></nav>
    <p>© 2026 · EXPLAINABLE EV BATTERY INTELLIGENCE</p>
  </footer>;
}
