/**
 * Tout le pixel art est peint ici, au moment de l'exécution : les décors et
 * les personnages n'ont besoin d'aucun fichier image. Chaque tuile et chaque
 * pose est rendue une fois dans un canevas hors écran, puis recopiée.
 */

import type { Dir, NpcSprite, TileKind } from "./world";

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
  joueur: { o: "#171a20", h: "#c0392b", H: "#7e2418", s: "#f0c49a", e: "#241d18", b: "#2f6db5", p: "#2b3a52", f: "#22262c" },
  prof: { o: "#171a20", h: "#8a6a4a", H: "#6b5138", s: "#f0c49a", e: "#241d18", b: "#eef2f6", p: "#5a6472", f: "#2a2f38" },
  maman: { o: "#171a20", h: "#a8562f", H: "#83411f", s: "#f0c49a", e: "#241d18", b: "#d2698f", p: "#4a5468", f: "#2a2f38" },
  infirmiere: { o: "#171a20", h: "#f2a3bd", H: "#d3819c", s: "#f0c49a", e: "#241d18", b: "#f6f8fa", p: "#e05a7a", f: "#dfe4ea" },
  gamin: { o: "#171a20", h: "#3b4a6b", H: "#2a3550", s: "#f0c49a", e: "#241d18", b: "#e0c04a", p: "#43506a", f: "#2a2f38" },
  exploratrice: { o: "#171a20", h: "#6b4a2f", H: "#503722", s: "#f0c49a", e: "#241d18", b: "#8fa84e", p: "#5a4a38", f: "#33291f" },
  villageois: { o: "#171a20", h: "#4a3a2a", H: "#35281c", s: "#f0c49a", e: "#241d18", b: "#7a8a9a", p: "#3a4450", f: "#2a2f38" },
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

/* --------------------------------------------------------------- décors */

type Painter = (ctx: CanvasRenderingContext2D, v: number) => void;

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
  grass: (ctx, v) => {
    fill(ctx, "#79b25e");
    px(ctx, "#8cc06d", 0, 0, 8, 8);
    px(ctx, "#8cc06d", 8, 8, 8, 8);
    for (let i = 0; i < 5; i++) {
      px(ctx, "#5f9a49", speck(v, i), speck(v, i + 3));
      px(ctx, "#5f9a49", speck(v, i + 1), speck(v, i + 5));
    }
  },
  tall: (ctx, v) => {
    fill(ctx, "#4e8c43");
    const sway = v % 2;
    for (let i = 0; i < 3; i++) {
      const bx = 1 + i * 5 + sway;
      px(ctx, "#2f6b34", bx, 9, 3, 6);
      px(ctx, "#6aa955", bx, 6, 1, 4);
      px(ctx, "#6aa955", bx + 2, 5, 1, 5);
      px(ctx, "#2a5c2d", bx, 14, 3, 2);
    }
    px(ctx, "#3b7539", 0, 15, 16, 1);
  },
  path: (ctx, v) => {
    fill(ctx, "#d6c49b");
    px(ctx, "#c9b489", 0, 0, 16, 1);
    for (let i = 0; i < 6; i++) px(ctx, "#c2ac80", speck(v, i), speck(v, i + 7));
  },
  flower: (ctx, v) => {
    fill(ctx, "#79b25e");
    px(ctx, "#8cc06d", 0, 0, 8, 8);
    px(ctx, "#8cc06d", 8, 8, 8, 8);
    const color = ["#e8615f", "#f0c24a", "#e5789f", "#c98ae8"][v % 4];
    // Deux touffes fleuries, assez larges pour se voir à l'échelle du jeu.
    for (const [fx, fy] of [
      [3, 4],
      [9, 9],
    ]) {
      px(ctx, "#4f8c43", fx + 2, fy + 3, 1, 3);
      px(ctx, color, fx + 1, fy + 1, 3, 1);
      px(ctx, color, fx + 2, fy, 1, 3);
      px(ctx, "#fff3c4", fx + 2, fy + 1);
    }
  },

  sign: (ctx, v) => {
    fill(ctx, "#79b25e");
    px(ctx, "#8cc06d", 0, 0, 8, 8);
    px(ctx, "#8cc06d", 8, 8, 8, 8);
    px(ctx, "#4a3520", 7, 10, 2, 6);
    px(ctx, "#4a3520", 2, 2, 12, 9);
    px(ctx, "#9a7248", 3, 3, 10, 7);
    px(ctx, "#b98f5e", 3, 3, 10, 2);
    px(ctx, "#5c4326", 4, 6, 8, 1);
    px(ctx, "#5c4326", 4, 8, v % 2 ? 5 : 8, 1);
  },
  tree: (ctx, v) => {
    fill(ctx, "#79b25e");
    px(ctx, "#6b4a2c", 7, 11, 2, 5);
    px(ctx, "#2f6b3a", 2, 1, 12, 11);
    px(ctx, "#3f8449", 3, 2, 10, 5);
    px(ctx, "#58a05c", 4, 2, 5, 3);
    px(ctx, "#22522c", 2, 9, 12, 3);
    px(ctx, "#22522c", 1, 3, 1, 6);
    px(ctx, "#22522c", 14, 3, 1, 6);
    if (v % 2) px(ctx, "#58a05c", 9, 4, 3, 2);
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

/** Quatre variantes par tuile : de quoi éviter l'effet damier. */
const tiles = new Map<TileKind, HTMLCanvasElement>();

function tileSheet(kind: TileKind): HTMLCanvasElement {
  const cached = tiles.get(kind);
  if (cached) return cached;

  const sheet = canvas(TILE * 4, TILE);
  const ctx = sheet.getContext("2d")!;
  for (let v = 0; v < 4; v++) {
    ctx.save();
    ctx.translate(v * TILE, 0);
    ctx.beginPath();
    ctx.rect(0, 0, TILE, TILE);
    ctx.clip();
    PAINTERS[kind](ctx, v);
    ctx.restore();
  }
  tiles.set(kind, sheet);
  return sheet;
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  variant: number,
  x: number,
  y: number,
): void {
  const sheet = tileSheet(kind);
  ctx.drawImage(sheet, (variant % 4) * TILE, 0, TILE, TILE, x, y, TILE, TILE);
}

/** Herbe et eau s'animent, le reste varie selon la position. */
export const variantFor = (kind: TileKind, x: number, y: number, frame: number) =>
  kind === "water" || kind === "tall" ? frame : (x * 3 + y * 5) % 4;
