export const FRAME_PATHS = Array.from({ length: 300 }, (_, i) => {
  const num = String(i + 1).padStart(3, "0");
  return `/frames/ezgif-frame-${num}.jpg`;
}) as readonly string[];
