import type { CSSProperties } from "react";

const SPARK_COUNT = 22;

const SPARK_COLOURS = [
  "#fb923c",
  "#f97316",
  "#fbbf24",
  "#f87171",
  "#fdba74",
] as const;

/**
 * Deterministic stand-in for Math.random(). The spark layer renders on the
 * server and hydrates on the client, so genuinely random values would differ
 * between the two: every spark would jump to a new position on hydration and
 * React would warn about the mismatch. Same seed, same field, every time.
 */
function pseudoRandom(seed: number): number {
  const value = Math.sin(seed) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Each spark gets its own lane, size, speed and drift so the field never
 * reads as a repeating pattern. Delays are negative on purpose: the
 * animation starts mid-flight, so the page loads with embers already in the
 * air rather than an empty screen that slowly fills from the bottom.
 */
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, index) => ({
  left: `${(pseudoRandom(index * 1.1 + 0.5) * 100).toFixed(2)}%`,
  size: `${(2 + pseudoRandom(index * 2.3 + 1.5) * 3).toFixed(2)}px`,
  duration: `${(9 + pseudoRandom(index * 3.7 + 2.5) * 11).toFixed(2)}s`,
  delay: `${-(pseudoRandom(index * 4.9 + 3.5) * 20).toFixed(2)}s`,
  drift: `${((pseudoRandom(index * 5.5 + 4.5) - 0.5) * 120).toFixed(2)}px`,
  // Not every ember makes it to the top of the screen — the short-lived ones
  // burning out halfway up are what stops this looking like falling snow
  // played backwards.
  rise: `${(45 + pseudoRandom(index * 6.1 + 5.5) * 65).toFixed(2)}vh`,
  opacity: (0.22 + pseudoRandom(index * 7.3 + 6.5) * 0.38).toFixed(3),
  colour: SPARK_COLOURS[index % SPARK_COLOURS.length],
}));

/**
 * The site's background: the fire gradient every page used to carry itself,
 * plus a drifting ember field, as one fixed layer behind all content. Fixed
 * rather than per-page means the gradient no longer stretches to fit however
 * long a page happens to be, and long pages (the terms, an unlocked roast)
 * scroll over a steady backdrop instead of a gradient that races past.
 *
 * Purely decorative, so it's aria-hidden, non-interactive, and disabled
 * entirely under prefers-reduced-motion (see app/globals.css).
 */
export function SparkField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-950 to-orange-950"
    >
      {/* The glow the embers are rising off — keeps them anchored to
          something rather than appearing out of flat colour. */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_bottom,rgba(249,115,22,0.20),transparent_72%)]" />

      {SPARKS.map((spark, index) => (
        <span
          key={index}
          className="roast-spark"
          style={
            {
              "--spark-left": spark.left,
              "--spark-size": spark.size,
              "--spark-duration": spark.duration,
              "--spark-delay": spark.delay,
              "--spark-drift": spark.drift,
              "--spark-rise": spark.rise,
              "--spark-opacity": spark.opacity,
              "--spark-color": spark.colour,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
