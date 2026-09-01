import { Link } from "wouter";

export default function NotFound() {
  return <main className="feature-page not-found-page"><section className="feature-hero"><span className="signal-kicker"><i/> ROUTE NOT FOUND</span><h1>Lost signal.</h1><p>The page you requested is not available in this local VoltPassport experience.</p><Link className="button button-solid" href="/">Return home</Link></section></main>;
}
