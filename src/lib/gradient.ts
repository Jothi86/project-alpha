// Deterministic colorful "thumbnail" gradient per item, since real cover art
// isn't always available yet. Picks from a fixed vivid palette so the grid
// reads as a lively mosaic (Roblox-style) instead of flat placeholder boxes.
const PALETTE: [string, string][] = [
  ['#335fff', '#7c3aed'], // cobalt -> violet
  ['#df281f', '#ff6a3d'], // alert red -> orange
  ['#0ea5a3', '#22d3ee'], // teal -> cyan
  ['#f59e0b', '#df281f'], // amber -> red
  ['#7c3aed', '#db2777'], // violet -> pink
  ['#16a34a', '#0ea5a3'], // green -> teal
  ['#335fff', '#0ea5a3'], // cobalt -> teal
  ['#db2777', '#f59e0b'], // pink -> amber
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function gradientFor(seed: string): string {
  const [a, b] = PALETTE[hash(seed) % PALETTE.length];
  const angle = 135;
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
}
