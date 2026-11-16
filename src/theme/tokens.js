// Single source of truth for colors. Plain JS so tailwind.config.js can require it.
// Dark, high-contrast creator UI: true black canvas, white text, red for recording,
// electric lime for primary actions.
const colors = {
  canvas: '#000000',
  surface: '#111113',
  raised: '#1C1C1F',
  line: '#2C2C31',
  ink: '#FFFFFF',
  muted: '#A1A1AA',
  record: '#FF3B30',
  accent: '#D4FF3A',
  'accent-ink': '#000000',
  danger: '#FF453A',
};

module.exports = { colors };
