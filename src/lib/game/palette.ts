/**
 * La palette du suiveur. Les sprites de la PokéAPI comptent des centaines de
 * nuances ; les personnages peints à la main dans `sprites.ts` en comptent
 * sept. Ces fonctions font le pont : elles posent chaque couleur sur des
 * paliers, puis ne gardent qu'une poignée de teintes par sprite.
 *
 * Tout est pur et sans DOM, pour se vérifier sans navigateur.
 */

/**
 * Nombre de teintes gardées par sprite. Au-delà, un suiveur redevient une
 * photo réduite plutôt qu'un dessin.
 */
export const MON_COLORS = 6;

/** En deçà de cet écart, deux teintes se valent et la plus fréquente gagne. */
const TROP_PROCHE = 900;

/**
 * Ramène une couleur sur des paliers : teinte par crans de trente degrés,
 * saturation relevée sur trois marches et clarté sur quatre. C'est le premier
 * dégrossissage ; `reduce` finit le travail en ne gardant qu'une poignée de
 * teintes, comme sur les palettes peintes à la main.
 */
export function poster(r: number, g: number, b: number): number {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  if (d > 0.001) {
    h =
      max === rr
        ? ((gg - bb) / d + 6) % 6
        : max === gg
          ? (bb - rr) / d + 2
          : (rr - gg) / d + 4;
    h *= 60;
  }
  const s = d < 0.001 ? 0 : d / (1 - Math.abs(2 * l - 1));

  const teinte = (Math.round(h / 30) * 30) % 360;
  const sat = Math.round(Math.min(1, s * 1.25) * 3) / 3;
  // Quatre marches, sans jamais toucher au blanc ni au noir : le liseré
  // reste la seule valeur vraiment sombre du sprite.
  const clarte = [0.28, 0.45, 0.62, 0.79][Math.min(3, Math.max(0, Math.floor(l * 4)))];
  return hslToRgb(teinte, sat, clarte);
}

/** Une couleur tenue sur un entier, pour se compter et se comparer vite. */
function hslToRgb(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return (
    (Math.round((r + m) * 255) << 16) |
    (Math.round((g + m) * 255) << 8) |
    Math.round((b + m) * 255)
  );
}

export const hex = (rgb: number) => `#${rgb.toString(16).padStart(6, "0")}`;

const distance = (a: number, b: number) => {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
  const db = (a & 255) - (b & 255);
  // Pondération à l'œil : le vert pèse plus que le bleu dans la perception.
  return 3 * dr * dr + 6 * dg * dg + db * db;
};

/**
 * Ne garde que les `MON_COLORS` teintes les plus présentes et rabat toutes
 * les autres sur la plus proche. Sans cela, un sprite garde une centaine de
 * nuances et ressemble à une photo réduite, pas à un dessin.
 */
export function reduce(pixels: number[]): Map<number, number> {
  const compte = new Map<number, number>();
  for (const c of pixels) compte.set(c, (compte.get(c) ?? 0) + 1);

  const gardees: number[] = [];
  for (const [couleur] of [...compte].sort((a, b) => b[1] - a[1])) {
    if (gardees.length >= MON_COLORS) break;
    // Deux teintes trop voisines n'apportent rien : on garde la plus fréquente.
    if (gardees.every((k) => distance(k, couleur) > TROP_PROCHE)) gardees.push(couleur);
  }
  if (!gardees.length) return new Map();

  const table = new Map<number, number>();
  for (const couleur of compte.keys()) {
    let proche = gardees[0];
    for (const k of gardees) if (distance(k, couleur) < distance(proche, couleur)) proche = k;
    table.set(couleur, proche);
  }
  return table;
}
