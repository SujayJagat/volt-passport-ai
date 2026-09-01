/**
 * Continuous running frame sequence for the Measure / Telemetry section.
 * Sourced from the newly provided frames2.0 archive (300 frames).
 */
export const MEASURE_FRAME_PATHS = Array.from({ length: 300 }, (_, i) => {
  const num = String(i + 1).padStart(3, "0");
  return `/frames2/ezgif-frame-${num}.webp`;
}) as readonly string[];
