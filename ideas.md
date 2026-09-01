# VoltPassport AI — Design Direction

## Three stylistic approaches

### Theme Name: Spectral Instrument
Very dark, cinematic, and data-dense: a precision instrument for seeing what is usually hidden beneath an EV. Cyan signal lines and restrained amber/red states create tension without turning the interface into a neon poster.
Probability: 0.07

### Theme Name: Mineral Ledger
A tactile editorial direction built from graphite, oxidized metal, warm paper, and archival certificate details. The battery passport feels like a collectible technical record with measured, museum-like pacing.
Probability: 0.03

### Theme Name: Quiet Voltage
A bright laboratory aesthetic with off-white surfaces, cobalt annotations, and translucent technical diagrams. The interface would feel calm, clinical, and trustworthy rather than cinematic.
Probability: 0.08

## Chosen approach: Spectral Instrument

**Design Movement:** Contemporary digital brutalism crossed with cinematic product storytelling and control-room instrumentation.

**Core Principles:**
1. Make hidden battery intelligence feel physically present through depth, scanlines, and the preserved scroll-sequence reveal.
2. Use asymmetry and editorial pacing so the story feels authored rather than dashboard-templated.
3. Treat every data point as a decision signal: clear labels, strong hierarchy, and visible provenance.
4. Reserve color for state and meaning: cyan for verified signal, emerald for healthy flow, amber for attention, red for intervention.

**Color Philosophy:** The black field is not decorative; it creates a controlled environment in which the battery signal can be read. Electric cyan (#00F5D4) is the ownable signature color for verified intelligence. Emerald indicates continuation, amber indicates a battery that deserves a second look, and red indicates a route change. Glow is kept close to the source so the interface remains premium and legible.

**Layout Paradigm:** A vertical narrative spine with an asymmetric split: cinematic sequence and editorial copy share the first viewport, while later content shifts between left-anchored statements, right-side telemetry instruments, and passport surfaces that feel like artifacts pulled from the system. Avoid a generic centered dashboard wall.

**Signature Elements:**
- A thin cyan "signal rail" that appears beside major sections and acts as a visual progress trace.
- Smoked-glass passport cards with micro-labels, verification marks, and fine technical rules.
- A quiet, responsive battery field: scanline texture, grain, and small data pulses that react to health state.

**Interaction Philosophy:** Interactions should feel like operating a serious instrument. Sliders respond immediately, presets are legible state changes, and actions explain their consequence. Hover states reveal signal rather than decoration; buttons compress slightly and clarify their destination.

**Animation:** Preserve the 300-frame scroll-driven battery reveal and improve it with canvas fallback, loading state, reduced-motion handling, and gentle frame interpolation. UI entrances use 180–260ms transform/opacity transitions. Telemetry changes update number transitions and state accents without layout jumps. Live simulation uses bounded drift rather than noise. Avoid perpetual glow and respect prefers-reduced-motion.

**Typography System:** Use Space Grotesk for headings and instrumentation labels, IBM Plex Mono for telemetry values and hashes, and Instrument Serif for a sparse editorial emphasis. Headings are compact and slightly tracked negative; body text is neutral and readable; technical values are monospaced and tabular.

**Brand Essence:** VoltPassport AI is explainable EV battery intelligence for buyers, fleets, dealers, and service teams who need to understand the asset before deciding its next life. Personality: forensic, assured, consequential.

**Brand Voice:** Headlines are direct and slightly cinematic. CTAs name an action and its outcome. Microcopy is concise, specific, and never overpromises.

Example lines:
- “Know the battery before it knows its limits.”
- “Trace the signal. Verify the next life.”

**Wordmark & Logo:** A compact VOLT / PASSPORT / AI lockup paired with a custom angular V-shaped energy stamp: two offset chevrons create a passport notch while a central gap suggests a live electrical path. The mark must work without text and remain recognizable at small sizes.

**Signature Brand Color:** Electric Cyan — #00F5D4.

**Style Decisions:**
- Preserve the original frame sequence as the cinematic storytelling engine.
- Replace the original gray/green palette with a near-black instrument field and semantic signal colors.
- Use generated brand assets sparingly; the sequence remains the hero visual, while atmosphere and passport textures support depth.
