import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Gauge, Pause, Play, ShieldCheck, Sparkles, Thermometer } from "lucide-react";
import { Link } from "wouter";
import { FRAME_PATHS } from "@/lib/framePaths";
import { MEASURE_FRAME_PATHS } from "@/lib/measureFramePaths";
import { useLocalBattery } from "@/lib/battery";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

type SequenceState = "loading" | "ready" | "unavailable";

function FrameCanvas({ progress, paused }: { progress: number; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<SequenceState>("loading");
  const [loaded, setLoaded] = useState(0);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const images: HTMLImageElement[] = [];
    let raf = 0; let stopped = false; let drawFrame = 0; let loadedCount = 0; let errorCount = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const closestLoadedIndex = (target: number) => {
      if (images[target]?.complete && images[target].naturalWidth) return target;
      for (let offset = 1; offset < images.length; offset++) {
        const before = target - offset; const after = target + offset;
        if (before >= 0 && images[before]?.complete && images[before].naturalWidth) return before;
        if (after < images.length && images[after]?.complete && images[after].naturalWidth) return after;
      }
      return -1;
    };
    const draw = () => {
      const target = Math.round(progressRef.current * (FRAME_PATHS.length - 1));
      const index = closestLoadedIndex(target); const image = index >= 0 ? images[index] : undefined;
      if (!image) return;
      const context = canvas.getContext("2d"); if (!context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2); const width = window.innerWidth; const height = window.innerHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const imgW = image.naturalWidth || 640; const imgH = image.naturalHeight || 360;
      const scale = Math.max(width / imgW, height / imgH);
      const drawWidth = imgW * scale; const drawHeight = imgH * scale;
      context.clearRect(0, 0, width, height);
      try { context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight); } catch { /* SVG taint fallback */ }
      drawFrame = index;
    };
    const loop = () => { if (!pausedRef.current || drawFrame === 0) draw(); raf = requestAnimationFrame(loop); };
    const onResize = () => draw();
    FRAME_PATHS.forEach((source, index) => {
      const image = new Image(); image.decoding = "async"; image.fetchPriority = index < 8 ? "high" : "low";
      image.onload = () => { if (stopped) return; loadedCount += 1; if (loadedCount === 1) setState("ready"); if (loadedCount === 1 || loadedCount % 12 === 0) setLoaded(loadedCount); draw(); };
      image.onerror = () => { errorCount += 1; if (errorCount === FRAME_PATHS.length) setState("unavailable"); };
      image.src = source; images[index] = image;
    });
    addEventListener("resize", onResize); loop();
    return () => { stopped = true; cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
  }, []);
  return <div className={`hero-sequence state-${state}`}><div className="hero-frame-fallback"/><canvas ref={canvasRef} className="sequence-canvas" aria-label="Cinematic EV battery reveal"/><div className="frame-loader" aria-live="polite"><i/><span>{state === "loading" ? `LOADING CINEMATIC / ${loaded || 1} FRAMES` : state === "ready" ? "CINEMATIC LINKED" : "ATMOSPHERE MODE"}</span></div></div>;
}

function MeasureFrameBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stopped = false;
    let raf = 0;
    let currentFrame = 0;
    let lastTime = 0;
    const fps = 28;
    const frameInterval = 1000 / fps;

    const totalFrames = MEASURE_FRAME_PATHS.length;
    const images: (HTMLImageElement | null)[] = new Array(totalFrames).fill(null);

    // Preloader helper
    const preloadBatch = (start: number, count: number) => {
      for (let i = start; i < Math.min(start + count, totalFrames); i++) {
        if (!images[i]) {
          const img = new Image();
          img.decoding = "async";
          img.src = MEASURE_FRAME_PATHS[i];
          images[i] = img;
        }
      }
    };

    // Preload initial frames immediately
    preloadBatch(0, 30);

    // Background streaming of remaining frames
    let streamIdx = 30;
    const streamTimer = setInterval(() => {
      if (streamIdx < totalFrames) {
        preloadBatch(streamIdx, 30);
        streamIdx += 30;
      } else {
        clearInterval(streamTimer);
      }
    }, 120);

    const render = (time: number) => {
      if (stopped) return;

      if (!lastTime) lastTime = time;
      const elapsed = time - lastTime;

      if (elapsed >= frameInterval) {
        lastTime = time - (elapsed % frameInterval);

        // Find current or nearest loaded frame
        let img = images[currentFrame];
        if (!img || !img.complete || !img.naturalWidth) {
          for (let offset = 1; offset < 25; offset++) {
            const before = (currentFrame - offset + totalFrames) % totalFrames;
            const after = (currentFrame + offset) % totalFrames;
            if (images[before]?.complete && images[before]!.naturalWidth) {
              img = images[before];
              break;
            }
            if (images[after]?.complete && images[after]!.naturalWidth) {
              img = images[after];
              break;
            }
          }
        }

        if (img && img.complete && img.naturalWidth) {
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = rect.width;
          const h = rect.height;

          if (w > 0 && h > 0) {
            if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
              canvas.width = w * dpr;
              canvas.height = h * dpr;
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const scale = Math.max(w / imgW, h / imgH);
            const drawW = imgW * scale;
            const drawH = imgH * scale;
            const drawX = (w - drawW) / 2;
            const drawY = (h - drawH) / 2;

            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
        }

        currentFrame = (currentFrame + 1) % totalFrames;
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearInterval(streamTimer);
    };
  }, []);

  return (
    <div className="measure-sequence" aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          filter: "brightness(1.12) contrast(1.1) saturate(1.15)",
          opacity: 0.95,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(2, 6, 7, 0.65) 0%, rgba(2, 6, 7, 0.2) 40%, rgba(2, 6, 7, 0.45) 100%), linear-gradient(0deg, rgba(2, 6, 7, 0.75) 0%, transparent 40%, rgba(2, 6, 7, 0.6) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function Signal({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="signal-item"><span>{icon}</span><div><b>{label}</b><small>{note}</small></div><strong>{value}</strong></div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-card good"><span>{label}</span><strong>{value}</strong><i/></div>; }

export default function Home() {
  const { telemetry, result } = useLocalBattery();
  const [progress, setProgress] = useState(0); const [paused, setPaused] = useState(false);
  useEffect(() => { const onScroll = () => setProgress(Math.max(0, Math.min(1, scrollY / (innerHeight * 3.6)))); addEventListener("scroll", onScroll, { passive: true }); onScroll(); return () => removeEventListener("scroll", onScroll); }, []);

  return (
    <div className={`app-shell grade-${result.grade}`}>
      <AppHeader/>
    <main id="top">
      <section className="hero-scroll"><div className="hero-sticky"><FrameCanvas progress={progress} paused={paused}/><div className="hero-vignette"/><div className="hero-grid"/><div className="hero-orb hero-orb-one"/><div className="hero-orb hero-orb-two"/><div className="hero-signal-trace" aria-hidden="true"><span>LOCAL FRAME PROVENANCE</span><i/><b style={{ height: `${Math.max(12, progress * 100)}%` }}/><span>VPA / 0300</span></div><div className="hero-content"><div className="signal-kicker"><span className="signal-line"/> VOLTPASSPORT AI · LOCAL BATTERY INTELLIGENCE</div><h1>Know your battery.<br/><em>Before it knows its limits.</em></h1><p>Turn telemetry into explainable health intelligence, safety insights, and a browser-local digital battery passport.</p><div className="hero-actions"><Link className="button button-solid" href="/analyzer">Analyze battery <ArrowUpRight size={15}/></Link><Link className="button button-outline" href="/passport">View digital passport <ArrowUpRight size={15}/></Link></div><div className="hero-proof"><span><ShieldCheck size={14}/> LOCAL-FIRST</span><span><Activity size={14}/> EXPLAINABLE</span><span><Gauge size={14}/> LIVE MODEL</span></div></div><div className="hero-status"><span>SEQUENCE / 300 FRAMES</span><button onClick={() => setPaused(value => !value)}>{paused ? <Play size={12}/> : <Pause size={12}/>} {paused ? "PLAY" : "PAUSE"}</button></div><div className="scroll-rail"><span>SCROLL TO REVEAL</span><div><i style={{ height: `${Math.max(8, progress * 100)}%` }}/></div><span>04</span></div></div></section>
      <section className="story-section"><div className="section-marker">01 / UNDERSTAND</div><div className="story-grid"><div><h2>Every battery<br/><em>tells a story.</em></h2><p className="section-lede">The local model reads your cycle count, temperature, resistance, and charge profile directly in the browser.</p></div><div className="signal-list"><Signal icon={<Gauge size={17}/>} label="State of health" value={`${result.soh.toFixed(1)}%`} note="Capacity remaining"/><Signal icon={<ArrowDownRight size={17}/>} label="Cycle history" value={telemetry.cycles.toString()} note="Charge-discharge events"/><Signal icon={<Thermometer size={17}/>} label="Thermal behavior" value={result.thermal} note={`${telemetry.temp} °C operating profile`}/></div></div><Link className="text-link section-route-link" href="/signal">Read the signal <ArrowUpRight size={14}/></Link></section>
      <section id="measure" className="telemetry-section"><MeasureFrameBackdrop/><div className="section-marker">02 / MEASURE</div><div className="telemetry-head"><div><h2>From raw telemetry<br/><em>to intelligence.</em></h2><p className="section-lede">A local live model recalculates health, safety, and next-life potential as you change the inputs.</p></div></div><div className="workspace-grid"><div className="control-panel"><div className="panel-head"><span>LOCAL WORKSPACE</span><span>BROWSER STORAGE</span></div><p className="section-lede">Use the dedicated analyzer to change telemetry and retain it on this device.</p><Link className="button button-solid analyzer-cta" href="/analyzer">Open analyzer <ArrowUpRight size={15}/></Link></div><div className="metrics-panel"><div className="metric-grid"><Metric label="STATE OF HEALTH" value={`${result.soh.toFixed(1)}%`}/><Metric label="SAFETY SCORE" value={`${result.safety.toFixed(0)}/100`}/><Metric label="CYCLE COUNT" value={telemetry.cycles.toString()}/><Metric label="THERMAL STRESS" value={result.thermal}/></div></div></div></section>
      <section className="explain-section"><div className="section-marker">03 / EXPLAIN</div><div className="explain-grid"><div><h2>Don’t just predict.<br/><em>Explain it.</em></h2><p className="section-lede">Each factor is ranked, weighted, and connected to a decision you can understand.</p><div className="advisory"><Sparkles size={18}/><div><span>SMART ADVISORY</span><p>{result.grade === "A" ? "Suitable for continued EV operation and premium resale." : result.grade === "B" ? "Consider a second life in stationary storage while monitoring thermal load." : "Route to certified recycling for safe handling."}</p></div></div></div><div className="factor-card"><div className="panel-head"><span>LOCAL DIAGNOSIS</span><span className="verified-label"><ShieldCheck size={13}/> ON-DEVICE</span></div>{result.factors.map((factor, index) => <div className="factor" key={factor.label}><div className="factor-meta"><span><b>{String(index + 1).padStart(2, "0")}</b> {factor.label}</span><strong>-{factor.value.toFixed(1)}%</strong></div><div className="factor-track"><i className={`tone-${factor.tone}`} style={{ width: `${Math.min(100, factor.value * 5 + 8)}%` }}/></div></div>)}</div></div><Link className="text-link section-route-link" href="/explainability">Explore explanation <ArrowUpRight size={14}/></Link></section>
      <section className="passport-section"><div className="section-marker">04 / DECIDE</div><div className="passport-grid"><div><h2>Every battery<br/><em>deserves a next life.</em></h2><p className="section-lede">A transparent local record makes current battery value readable without sending data anywhere.</p></div><div className="passport-card"><div className="passport-top"><span><span className="stamp-mark">V</span> VOLT / PASSPORT / AI</span><span className="verified-label"><ShieldCheck size={12}/> LOCAL</span></div><div className="passport-score"><div className="score-ring" style={{ background: `conic-gradient(var(--cyan) ${result.soh * 3.6}deg, #1a2528 0deg)` }}><div><b>{result.soh.toFixed(0)}</b><small>/100</small></div></div><div><span className="small-label">BATTERY HEALTH</span><strong>{result.grade === "A" ? "Excellent" : result.grade === "B" ? "Serviceable" : "Intervention"}</strong><small>Browser-local model</small></div></div><Link className="passport-open" href="/passport">Open full passport <ArrowUpRight size={15}/></Link></div></div></section>
    </main>
    <AppFooter/>
  </div>
  );
}
