/**
 * Tout le pixel art est peint ici, au moment de l'exécution : les décors et
 * les personnages n'ont besoin d'aucun fichier image. Chaque tuile et chaque
 * pose est rendue une fois dans un canevas hors écran, puis recopiée.
 */

import type { Biome, Dir, NpcSprite, TileKind } from "./world";

/** Une case du décor à l'écran (16 px de la DS, doublés). */
export const TILE = 32;
const PX = 2; // un pixel de sprite = 2 pixels d'écran

type Palette = Record<string, string>;

function paint(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Palette,
  ox: number,
  oy: number,
): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * PX, oy + y * PX, PX, PX);
    }
  });
}

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/* ---------------------------------------------------------- personnages */

// Le buste change avec la direction, les jambes avec la frame de marche :
// trois hauts et trois bas suffisent pour toute l'animation.
const BODY: Record<"down" | "up" | "side", string[]> = {
  down: [
    "................",
    "....oooooooo....",
    "...ohhhhhhhho...",
    "...oHHHHHHHHo...",
    "....osssssso....",
    "....osesseso....",
    "....osssssso....",
    ".....oooooo.....",
    "...obbbbbbbbo...",
    "..obsbbbbbbsbo..",
    "..obsbbbbbbsbo..",
    "...obbbbbbbbo...",
  ],
  up: [
    "................",
    "....oooooooo....",
    "...ohhhhhhhho...",
    "...oHHHHHHHHo...",
    "....ohhhhhho....",
    "....ohhhhhho....",
    "....ohhhhhho....",
    ".....oooooo.....",
    "...obbbbbbbbo...",
    "..obsbbbbbbsbo..",
    "..obsbbbbbbsbo..",
    "...obbbbbbbbo...",
  ],
  side: [
    "................",
    "....oooooooo....",
    "...ohhhhhhhho...",
    "...oHHHHHHHHHo..",
    "....osssssso....",
    "....osssseso....",
    "....osssssso....",
    ".....oooooo.....",
    "...obbbbbbbbo...",
    "...obbbbbbbsbo..",
    "...obbbbbbbsbo..",
    "...obbbbbbbbo...",
  ],
};

const LEGS: string[][] = [
  [
    "....oppppppo....",
    "....opp..ppo....",
    "....off..ffo....",
    ".....oo..oo.....",
  ],
  [
    "....oppppppo....",
    ".....opp..ppo...",
    ".....off..ffo...",
    "......oo..oo....",
  ],
  [
    "....oppppppo....",
    "...opp..ppo.....",
    "...off..ffo.....",
    "....oo..oo......",
  ],
];

const PALETTES: Record<NpcSprite | "joueur", Palette> = {
  joueur: { o: "#171a20", h: "#c0392b", H: "#7e2418", s: "#f0c49a", e: "#241d18", b: "#2f6db5", B: "#1f5290", p: "#2b3a52", f: "#22262c" },
  prof: { o: "#171a20", h: "#8a6a4a", H: "#6b5138", s: "#f0c49a", e: "#241d18", b: "#eef2f6", B: "#cdd6de", p: "#5a6472", f: "#2a2f38" },
  maman: { o: "#171a20", h: "#a8562f", H: "#83411f", s: "#f0c49a", e: "#241d18", b: "#d2698f", B: "#b04f73", p: "#4a5468", f: "#2a2f38" },
  infirmiere: { o: "#171a20", h: "#f2a3bd", H: "#d3819c", s: "#f0c49a", e: "#241d18", b: "#f6f8fa", B: "#d8dee6", p: "#e05a7a", f: "#dfe4ea" },
  vendeur: { o: "#171a20", h: "#2f3a4a", H: "#212a36", s: "#f0c49a", e: "#241d18", b: "#3f7fbf", B: "#2d5f92", p: "#2a3648", f: "#22262c" },
  gamin: { o: "#171a20", h: "#3b4a6b", H: "#2a3550", s: "#f0c49a", e: "#241d18", b: "#e0c04a", B: "#bd9d31", p: "#43506a", f: "#2a2f38" },
  exploratrice: { o: "#171a20", h: "#6b4a2f", H: "#503722", s: "#f0c49a", e: "#241d18", b: "#8fa84e", B: "#6f8639", p: "#5a4a38", f: "#33291f" },
  championne: { o: "#171a20", h: "#2b2b33", H: "#17171d", s: "#f0c49a", e: "#241d18", b: "#8f4fd0", B: "#6d37a6", p: "#2b2b3a", f: "#1e2028" },
  villageois: { o: "#171a20", h: "#4a3a2a", H: "#35281c", s: "#f0c49a", e: "#241d18", b: "#7a8a9a", B: "#5f6d7b", p: "#3a4450", f: "#2a2f38" },
};

/** Planche 3 poses × 3 frames, construite une seule fois par personnage. */
const sheets = new Map<string, HTMLCanvasElement>();

function sheetFor(who: NpcSprite | "joueur"): HTMLCanvasElement {
  const cached = sheets.get(who);
  if (cached) return cached;

  const sheet = canvas(TILE * 3, TILE * 3);
  const ctx = sheet.getContext("2d")!;
  const palette = PALETTES[who];

  (["down", "up", "side"] as const).forEach((dir, row) => {
    LEGS.forEach((legs, frame) => {
      const ox = frame * TILE;
      const oy = row * TILE;
      paint(ctx, BODY[dir], palette, ox, oy);
      paint(ctx, legs, palette, ox, oy);
    });
  });

  sheets.set(who, sheet);
  return sheet;
}

/**
 * Dessine un personnage. Le sprite déborde d'un peu vers le haut pour que les
 * pieds reposent sur la case, comme dans les jeux d'origine.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  who: NpcSprite | "joueur",
  dir: Dir,
  frame: number,
  x: number,
  y: number,
): void {
  const sheet = sheetFor(who);
  const row = dir === "up" ? 1 : dir === "down" ? 0 : 2;
  const sx = (frame % 3) * TILE;
  const sy = row * TILE;
  const dy = y - 6;

  if (dir === "left") {
    ctx.save();
    ctx.translate(x + TILE, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
    ctx.restore();
    return;
  }
  ctx.drawImage(sheet, sx, sy, TILE, TILE, x, dy, TILE, TILE);
}

/* ------------------------------------------- sprite de combat (dresseur) */

/**
 * Le grand portrait affiché à l'ouverture d'un combat de Dresseurs, avant
 * qu'il n'envoie son premier Pokémon. Vingt-quatre pixels de large.
 */
const TRAINER = [
  "........................",
  ".......oooooooo.........",
  "......ohhhhhhhhho.......",
  ".....ohhhhhhhhhhho......",
  ".....oHHHHHHHHHHHo......",
  "......osssssssso........",
  "......oseessseeso.......",
  "......ossssssssso.......",
  ".......ossssssso........",
  "........ooooooo.........",
  ".....obbbbbbbbbbbo......",
  "....obbbbbbbbbbbbbo.....",
  "...obsbbbbbbbbbbbbso....",
  "...obsbbbbBBBbbbbbso....",
  "...obsbbbbBBBbbbbbso....",
  "...obsbbbbbbbbbbbbso....",
  "....obbbbbbbbbbbbbo.....",
  ".....obbbbbbbbbbbo......",
  "......oooooooooooo......",
  "......oppppppppppo......",
  "......oppppppppppo......",
  "......oppppppppppo......",
  "......oppppo.oppppo.....",
  "......oppppo.oppppo.....",
  "......oppppo.oppppo.....",
  "......offffo.offffo.....",
  "......offffo.offffo.....",
  ".....offfffo.offfffo....",
  ".....ooooooo.ooooooo....",
  "........................",
];

const portraits = new Map<string, string>();

/** Image du dresseur, prête pour une balise `img` : rendue une seule fois. */
export function trainerPortrait(who: NpcSprite | "joueur"): string {
  if (typeof document === "undefined") return "";
  const cached = portraits.get(who);
  if (cached) return cached;

  const scale = 4;
  const sheet = canvas(TRAINER[0].length * scale, TRAINER.length * scale);
  const ctx = sheet.getContext("2d")!;
  const palette = PALETTES[who];

  TRAINER.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });

  const url = sheet.toDataURL();
  portraits.set(who, url);
  return url;
}

/* ------------------------------------------------- le car des lignes */

/** L'autocar, pour l'animation de voyage : trente-deux pixels de long. */
const COACH = [
  "................................",
  "....oooooooooooooooooooooooo....",
  "...owwwwwwwwwwwwwwwwwwwwwwwwo...",
  "..owgggowgggowgggowgggowwwwwwo..",
  "..owgggowgggowgggowgggowwwwwwo..",
  "..owgggowgggowgggowgggowwwwwwo..",
  "..owwwwwwwwwwwwwwwwwwwwwwwwwwo..",
  "..obbbbbbbbbbbbbbbbbbbbbbbbbbo..",
  "..owwwwwwwwwwwwwwwwwwwwwwwwwwo..",
  "..oooooooooooooooooooooooooooo..",
  "....okko..............okko......",
  "....okko..............okko......",
  ".....oo................oo.......",
  "................................",
];

const COACH_COLORS: Palette = {
  o: "#1b2029",
  w: "#f4f6f8",
  g: "#8fd2f0",
  b: "#1f5aa8",
  k: "#3a4150",
};

let coach: string | null = null;

/** Image de l'autocar, prête pour une balise `img`. */
export function coachSprite(): string {
  if (typeof document === "undefined") return "";
  if (coach) return coach;

  const scale = 3;
  const sheet = canvas(COACH[0].length * scale, COACH.length * scale);
  const ctx = sheet.getContext("2d")!;
  COACH.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = COACH_COLORS[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });

  coach = sheet.toDataURL();
  return coach;
}

/* ------------------------------------------------------------ le vélo */

const BIKE = [
  "................",
  "......kkkk......",
  "....kkkkkkkk....",
  "..wwww....wwww..",
  ".ww..ww..ww..ww.",
  ".ww..ww..ww..ww.",
  "..wwww....wwww..",
  "................",
];

const BIKE_COLORS: Palette = { k: "#e0483a", w: "#22262c" };

/** Le vélo, glissé sous le héros quand il roule. */
export function drawBike(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  paint(ctx, BIKE, BIKE_COLORS, x, y + 8);
}

/* --------------------------------------------------------------- décors */

/**
 * Chaque région a sa gamme : le sol, les herbes hautes, les arbres et les
 * chemins prennent les couleurs du biome traversé. Le bâti, lui, ne change
 * pas — une maison reste une maison.
 */
type Ground = {
  base: string;
  alt: string;
  speck: string;
  tallBase: string;
  tallBlade: string;
  tallDark: string;
  tallEdge: string;
  trunk: string;
  canopy: string;
  canopyLight: string;
  canopyHigh: string;
  canopyDark: string;
  path: string;
  pathEdge: string;
  pathSpeck: string;
};

const BIOMES: Record<Biome, Ground> = {
  plaine: {
    base: "#79b25e", alt: "#8cc06d", speck: "#5f9a49",
    tallBase: "#4e8c43", tallBlade: "#6aa955", tallDark: "#2f6b34", tallEdge: "#3b7539",
    trunk: "#6b4a2c", canopy: "#2f6b3a", canopyLight: "#3f8449",
    canopyHigh: "#58a05c", canopyDark: "#22522c",
    path: "#d6c49b", pathEdge: "#c9b489", pathSpeck: "#c2ac80",
  },
  foret: {
    base: "#4e7a45", alt: "#5c8a4f", speck: "#3c6236",
    tallBase: "#33602f", tallBlade: "#4a8040", tallDark: "#1f4322", tallEdge: "#27512a",
    trunk: "#4a3520", canopy: "#1f4d2a", canopyLight: "#2c6236",
    canopyHigh: "#3f7a45", canopyDark: "#143a1e",
    path: "#a08a63", pathEdge: "#907a55", pathSpeck: "#87724f",
  },
  desert: {
    base: "#e0cd9a", alt: "#ead9ad", speck: "#cbb480",
    tallBase: "#c4a86a", tallBlade: "#d8bd80", tallDark: "#a68b52", tallEdge: "#b09660",
    trunk: "#6b5a3a", canopy: "#4f8c53", canopyLight: "#62a464",
    canopyHigh: "#7dbb7a", canopyDark: "#376b3c",
    path: "#d9bb84", pathEdge: "#c9a870", pathSpeck: "#bf9d66",
  },
  montagne: {
    base: "#9aa79b", alt: "#a9b5a8", speck: "#7f8d82",
    tallBase: "#6f8470", tallBlade: "#8aa08a", tallDark: "#55684f", tallEdge: "#5f7359",
    trunk: "#4a3f34", canopy: "#2c4a3a", canopyLight: "#3a5c48",
    canopyHigh: "#e8eef0", canopyDark: "#1f3529",
    path: "#b0aca0", pathEdge: "#9c988c", pathSpeck: "#928e83",
  },
  neige: {
    base: "#e4ecf1", alt: "#f2f7fa", speck: "#cbd8e0",
    tallBase: "#c6d4dc", tallBlade: "#f2f7fa", tallDark: "#a3b4c0", tallEdge: "#b4c3cd",
    trunk: "#4a3f34", canopy: "#27473a", canopyLight: "#35594a",
    canopyHigh: "#fbfdff", canopyDark: "#1a3229",
    path: "#cfd8de", pathEdge: "#b9c3ca", pathSpeck: "#adb8bf",
  },
};

type Painter = (ctx: CanvasRenderingContext2D, v: number, g: Ground) => void;

/** Tuiles dont la teinte suit la région ; les autres sont identiques partout. */
const REGIONAL = new Set<TileKind>(["grass", "tall", "path", "tree", "flower", "sign"]);

const px = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, w * PX, h * PX);
};

const fill = (ctx: CanvasRenderingContext2D, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE, TILE);
};

/** Motif pseudo-aléatoire mais stable, pour semer les détails. */
const speck = (v: number, i: number) => (v * 7 + i * 13) % 16;

const PAINTERS: Record<TileKind, Painter> = {
  grass: (ctx, v, g) => {
    fill(ctx, g.base);
    px(ctx, g.alt, 0, 0, 8, 8);
    px(ctx, g.alt, 8, 8, 8, 8);
    for (let i = 0; i < 5; i++) {
      px(ctx, g.speck, speck(v, i), speck(v, i + 3));
      px(ctx, g.speck, speck(v, i + 1), speck(v, i + 5));
    }
  },
  tall: (ctx, v, g) => {
    fill(ctx, g.tallBase);
    const sway = v % 2;
    for (let i = 0; i < 3; i++) {
      const bx = 1 + i * 5 + sway;
      px(ctx, g.tallDark, bx, 9, 3, 6);
      px(ctx, g.tallBlade, bx, 6, 1, 4);
      px(ctx, g.tallBlade, bx + 2, 5, 1, 5);
      px(ctx, g.tallDark, bx, 14, 3, 2);
    }
    px(ctx, g.tallEdge, 0, 15, 16, 1);
  },
  path: (ctx, v, g) => {
    fill(ctx, g.path);
    px(ctx, g.pathEdge, 0, 0, 16, 1);
    for (let i = 0; i < 6; i++) px(ctx, g.pathSpeck, speck(v, i), speck(v, i + 7));
  },
  flower: (ctx, v, g) => {
    fill(ctx, g.base);
    px(ctx, g.alt, 0, 0, 8, 8);
    px(ctx, g.alt, 8, 8, 8, 8);
    const color = ["#e8615f", "#f0c24a", "#e5789f", "#c98ae8"][v % 4];
    // Deux touffes fleuries, assez larges pour se voir à l'échelle du jeu.
    for (const [fx, fy] of [
      [3, 4],
      [9, 9],
    ]) {
      px(ctx, g.speck, fx + 2, fy + 3, 1, 3);
      px(ctx, color, fx + 1, fy + 1, 3, 1);
      px(ctx, color, fx + 2, fy, 1, 3);
      px(ctx, "#fff3c4", fx + 2, fy + 1);
    }
  },

  sign: (ctx, v, g) => {
    fill(ctx, g.base);
    px(ctx, g.alt, 0, 0, 8, 8);
    px(ctx, g.alt, 8, 8, 8, 8);
    px(ctx, "#4a3520", 7, 10, 2, 6);
    px(ctx, "#4a3520", 2, 2, 12, 9);
    px(ctx, "#9a7248", 3, 3, 10, 7);
    px(ctx, "#b98f5e", 3, 3, 10, 2);
    px(ctx, "#5c4326", 4, 6, 8, 1);
    px(ctx, "#5c4326", 4, 8, v % 2 ? 5 : 8, 1);
  },
  tree: (ctx, v, g) => {
    fill(ctx, g.base);
    px(ctx, g.trunk, 7, 11, 2, 5);
    px(ctx, g.canopy, 2, 1, 12, 11);
    px(ctx, g.canopyLight, 3, 2, 10, 5);
    px(ctx, g.canopyHigh, 4, 2, 5, 3);
    px(ctx, g.canopyDark, 2, 9, 12, 3);
    px(ctx, g.canopyDark, 1, 3, 1, 6);
    px(ctx, g.canopyDark, 14, 3, 1, 6);
    if (v % 2) px(ctx, g.canopyHigh, 9, 4, 3, 2);
  },
  water: (ctx, v) => {
    fill(ctx, "#3b78c4");
    px(ctx, "#4f8ed8", 0, 0, 16, 6);
    const o = v % 4;
    px(ctx, "#a8d4f2", 2 + o, 4, 4, 1);
    px(ctx, "#a8d4f2", 10 - o, 9, 4, 1);
    px(ctx, "#2f63a8", 0, 12, 16, 4);
    px(ctx, "#a8d4f2", 4 + o, 14, 3, 1);
  },
  wall: (ctx, v) => {
    fill(ctx, "#ddd6c6");
    px(ctx, "#c9c1ae", 0, 14, 16, 2);
    px(ctx, "#f0ebe0", 0, 0, 16, 1);
    if (v % 2 === 0) {
      px(ctx, "#2b3a52", 4, 4, 8, 7);
      px(ctx, "#7fc4e8", 5, 5, 6, 5);
      px(ctx, "#b9e2f5", 5, 5, 3, 2);
    }
  },
  // Mur intérieur : papier peint et plinthe, sans fenêtre.
  inwall: (ctx, v) => {
    fill(ctx, "#e0d5c0");
    px(ctx, "#eee5d4", 0, 0, 16, 2);
    for (let x = v % 2; x < 16; x += 4) px(ctx, "#d6c9b0", x, 2, 1, 10);
    px(ctx, "#b8a98f", 0, 12, 16, 4);
    px(ctx, "#9c8e75", 0, 15, 16, 1);
  },

  roof: (ctx, v) => {
    fill(ctx, "#b8503f");
    px(ctx, "#cf6350", 0, 0, 16, 3);
    for (let y = 3; y < 16; y += 4) {
      px(ctx, "#963d31", 0, y, 16, 1);
      px(ctx, "#a8483a", (y % 8 === 3 ? 4 : 0) + (v % 2), y + 1, 1, 3);
      px(ctx, "#a8483a", (y % 8 === 3 ? 12 : 8) + (v % 2), y + 1, 1, 3);
    }
  },
  door: (ctx) => {
    fill(ctx, "#ddd6c6");
    px(ctx, "#4a3520", 3, 1, 10, 15);
    px(ctx, "#6b4a2c", 4, 2, 8, 14);
    px(ctx, "#8a6540", 5, 3, 6, 5);
    px(ctx, "#f0c24a", 10, 9, 1, 2);
  },
  floor: (ctx, v) => {
    fill(ctx, "#e8dfd0");
    px(ctx, "#d8ccb8", 0, 15, 16, 1);
    px(ctx, "#d8ccb8", 15, 0, 1, 16);
    if (v % 2) px(ctx, "#dfd4c2", 2, 2, 3, 3);
  },
  counter: (ctx) => {
    fill(ctx, "#c79a62");
    px(ctx, "#e0b87e", 0, 0, 16, 4);
    px(ctx, "#a87e4c", 0, 12, 16, 4);
    px(ctx, "#8a6540", 0, 15, 16, 1);
  },
  // Arrêt des Cars Faure : un poteau, un panneau bleu, un car dessus.
  bus: (ctx, v, g) => {
    fill(ctx, g.base);
    px(ctx, g.alt, 0, 0, 8, 8);
    px(ctx, g.alt, 8, 8, 8, 8);
    px(ctx, "#3a4150", 7, 9, 2, 7);
    px(ctx, "#152a52", 2, 1, 12, 9);
    px(ctx, "#2f5aa8", 3, 2, 10, 7);
    px(ctx, "#f2f4f6", 4, 3, 8, 4);
    px(ctx, "#7fc4e8", 5, 4, 2, 2);
    px(ctx, "#7fc4e8", 8, 4, 2, 2);
    px(ctx, "#e8c25a", 4, 7, 8, 1);
    px(ctx, "#1f2430", 5, 7, 1, 1);
    px(ctx, "#1f2430", 10, 7, 1, 1);
    if (v % 2) px(ctx, "#8fa6c8", 3, 8, 10, 1);
  },

  /* -------------------------------------------------------- les arènes */

  // Terrain de combat : argile battue et lignes blanches réglementaires.
  arena: (ctx, v) => {
    fill(ctx, "#c98f5e");
    px(ctx, "#d49b68", 0, 0, 16, 8);
    for (let i = 0; i < 4; i++) px(ctx, "#b87f50", speck(v, i), speck(v, i + 5));
    px(ctx, "#f4efe4", 0, 0, 16, 1);
    px(ctx, "#f4efe4", 0, 0, 1, 16);
  },

  // Gradins : rangées de sièges et taches de public.
  stands: (ctx, v) => {
    fill(ctx, "#3a4150");
    for (let y = 0; y < 16; y += 5) {
      px(ctx, "#4c5567", 0, y, 16, 3);
      px(ctx, "#262c38", 0, y + 3, 16, 2);
      const tint = ["#e0655c", "#e8c25a", "#5fa8e0", "#7ecb84"];
      for (let i = 0; i < 3; i++) {
        px(ctx, tint[(v + i + y) % 4], 1 + i * 5 + (v % 2), y, 3, 2);
      }
    }
  },

  furniture: (ctx, v) => {
    fill(ctx, "#e8dfd0");
    if (v % 2) {
      px(ctx, "#6b4a2c", 2, 6, 12, 10);
      px(ctx, "#8a6540", 3, 7, 10, 8);
      px(ctx, "#c94f4f", 4, 8, 2, 6);
      px(ctx, "#4f7fc9", 7, 8, 2, 6);
      px(ctx, "#4fa05f", 10, 8, 2, 6);
    } else {
      px(ctx, "#8a6540", 6, 12, 4, 4);
      px(ctx, "#3f8449", 3, 3, 10, 9);
      px(ctx, "#58a05c", 5, 4, 5, 4);
    }
  },
};

/**
 * Quatre variantes par tuile, de quoi éviter l'effet damier. Les tuiles de
 * décor sont déclinées par région ; le bâti n'est peint qu'une fois.
 */
const tiles = new Map<string, HTMLCanvasElement>();

function tileSheet(kind: TileKind, biome: Biome): HTMLCanvasElement {
  const key = REGIONAL.has(kind) ? `${kind}:${biome}` : kind;
  const cached = tiles.get(key);
  if (cached) return cached;

  const sheet = canvas(TILE * 4, TILE);
  const ctx = sheet.getContext("2d")!;
  for (let v = 0; v < 4; v++) {
    ctx.save();
    ctx.translate(v * TILE, 0);
    ctx.beginPath();
    ctx.rect(0, 0, TILE, TILE);
    ctx.clip();
    PAINTERS[kind](ctx, v, BIOMES[biome]);
    ctx.restore();
  }
  tiles.set(key, sheet);
  return sheet;
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  variant: number,
  x: number,
  y: number,
  biome: Biome = "plaine",
): void {
  const sheet = tileSheet(kind, biome);
  ctx.drawImage(sheet, (variant % 4) * TILE, 0, TILE, TILE, x, y, TILE, TILE);
}

/** Herbe et eau s'animent, le reste varie selon la position. */
export const variantFor = (kind: TileKind, x: number, y: number, frame: number) =>
  kind === "water" || kind === "tall" ? frame : (x * 3 + y * 5) % 4;
