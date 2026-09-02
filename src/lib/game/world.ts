/**
 * Le monde : quatre cartes en mode texte, un caractère par case. Les PNJ, les
 * passages et les tables de rencontre vivent à côté de la grille.
 */

export type Dir = "up" | "down" | "left" | "right";

export type MapId =
  | "bourg" | "maison" | "route1" | "route2" | "centre"
  | "route3" | "maillard" | "centre2" | "arene" | "velo" | "maison2";

export type TileKind =
  | "grass" | "tall" | "path" | "flower" | "tree" | "water"
  | "wall" | "inwall" | "roof" | "door" | "floor" | "counter" | "furniture" | "sign";

type Tile = { kind: TileKind; solid: boolean; encounter?: boolean };

export const TILES: Record<string, Tile> = {
  ".": { kind: "grass", solid: false },
  ",": { kind: "tall", solid: false, encounter: true },
  "=": { kind: "path", solid: false },
  F: { kind: "flower", solid: false },
  "#": { kind: "tree", solid: true },
  "~": { kind: "water", solid: true },
  W: { kind: "wall", solid: true },
  X: { kind: "inwall", solid: true },
  T: { kind: "roof", solid: true },
  D: { kind: "door", solid: false },
  "-": { kind: "floor", solid: false },
  C: { kind: "counter", solid: true },
  B: { kind: "furniture", solid: true },
  S: { kind: "sign", solid: true },
};

export type NpcSprite =
  | "prof" | "maman" | "infirmiere" | "vendeur" | "championne"
  | "gamin" | "exploratrice" | "villageois";

export type TrainerSpec = {
  title: string;
  name: string;
  /** Portée du regard, en cases. */
  sight: number;
  team: { id: number; level: number }[];
  reward: number;
  intro: string[];
  defeat: string[];
  after: string[];
  /** Son dernier Pokémon contre le starter du joueur, comme à l'Arène d'Unys. */
  mirror?: boolean;
  /** Récompense l'insigne d'Arène. */
  badge?: string;
};

export type NpcSpec = {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  sprite: NpcSprite;
  lines: string[];
  trainer?: TrainerSpec;
  /** Soigne l'équipe après la réplique. */
  heals?: boolean;
  /** Déclenche le choix du starter. */
  starter?: boolean;
  /** Ouvre la boutique après la réplique. */
  shop?: boolean;
  /** Vend le vélo, une fois pour toutes. */
  bike?: boolean;
};

export type Warp = { x: number; y: number; to: MapId; tx: number; ty: number; dir?: Dir };

export type Encounter = { id: number; min: number; max: number; weight: number };

export type MapSpec = {
  name: string;
  indoor?: boolean;
  tiles: string[];
  npcs: NpcSpec[];
  warps: Warp[];
  signs: { x: number; y: number; text: string[] }[];
  encounters?: Encounter[];
};

/* ----------------------------------------------------------- les cartes */

export const MAPS: Record<MapId, MapSpec> = {
  bourg: {
    name: "Renouet Bourg",
    tiles: [
      "#########==#########",
      "#########==#########",
      "##.......==.......##",
      "##..TTTT.==.TTTT..##",
      "##..TTTT.==.TTTT..##",
      "##..WWDW.==.WWDW..##",
      "##.......==.......##",
      "##..F....==....F..##",
      "##.......==.......##",
      "##.TTTTTT==.......##",
      "##.TTTTTT==....~~~##",
      "##.WWWDWW==....~~~##",
      "##.......==....~~~##",
      "##..S..F.==.......##",
      "##.......==.......##",
      "##..F....==....F..##",
      "##.......==.......##",
      "####################",
    ],
    npcs: [
      {
        id: "prof",
        x: 6,
        y: 12,
        dir: "down",
        sprite: "prof",
        starter: true,
        lines: [],
      },
      {
        id: "voisin",
        x: 15,
        y: 7,
        dir: "left",
        sprite: "villageois",
        lines: [
          "Les hautes herbes grouillent de Pokémon sauvages.",
          "Ne t'y aventure jamais sans un Pokémon avec toi !",
        ],
      },
    ],
    warps: [
      { x: 9, y: 0, to: "route1", tx: 9, ty: 18, dir: "up" },
      { x: 10, y: 0, to: "route1", tx: 10, ty: 18, dir: "up" },
      { x: 6, y: 5, to: "maison", tx: 4, ty: 6, dir: "up" },
    ],
    signs: [
      {
        x: 4,
        y: 13,
        text: [
          "RENOUET BOURG",
          "Une bourgade balayée par le vent, où tout commence.",
        ],
      },
      { x: 14, y: 5, text: ["C'est fermé à clé. Les voisins sont sortis."] },
    ],
  },

  maison: {
    name: "Votre maison",
    indoor: true,
    tiles: [
      "XXXXXXXXXX",
      "X-BB----BX",
      "X--------X",
      "X-B------X",
      "X--------X",
      "X--------X",
      "X--------X",
      "XXXXDDXXXX",
    ],
    npcs: [
      {
        id: "maman",
        x: 3,
        y: 3,
        dir: "down",
        sprite: "maman",
        heals: true,
        lines: [
          "Bonjour mon poussin ! Le Professeur Keteleeria te cherchait.",
          "Tiens, laisse-moi remettre tes Pokémon d'aplomb.",
        ],
      },
    ],
    warps: [
      { x: 4, y: 7, to: "bourg", tx: 6, ty: 6, dir: "down" },
      { x: 5, y: 7, to: "bourg", tx: 6, ty: 6, dir: "down" },
    ],
    signs: [],
  },

  route1: {
    name: "Route 1",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##...,,,,==,,,,...##",
      "##...,,,,==,,,,...##",
      "##.......==.......##",
      "##.###...==...###.##",
      "##.###...==...###.##",
      "##.......==.......##",
      "##,,,,...==...,,,,##",
      "##,,,,...==...,,,,##",
      "##.......==.......##",
      "##S......==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        // Il garde l'accès aux herbes hautes, pas le chemin principal :
        // on ne tombe sur lui qu'en allant s'entraîner.
        id: "gamin-timmy",
        x: 6,
        y: 13,
        dir: "up",
        sprite: "gamin",
        lines: ["Les Pokémon de la Route 1 sont parfaits pour s'entraîner !"],
        trainer: {
          title: "Gamin",
          name: "Timmy",
          sight: 3,
          reward: 200,
          team: [{ id: 504, level: 4 }],
          intro: ["Hé ! Toi là-bas ! Tu veux te battre ?", "Mon Pokémon est super fort !"],
          defeat: ["Aaah ! J'ai perdu…"],
          after: ["Il faut que je m'entraîne encore et encore."],
        },
      },
      {
        id: "promeneur",
        x: 13,
        y: 5,
        dir: "down",
        sprite: "villageois",
        lines: [
          "Tu cherches à capturer des Pokémon ?",
          "Affaiblis-les d'abord, puis lance une Poké Ball. C'est la base !",
        ],
      },
    ],
    warps: [
      { x: 9, y: 19, to: "bourg", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 19, to: "bourg", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "route2", tx: 9, ty: 16, dir: "up" },
      { x: 10, y: 0, to: "route2", tx: 10, ty: 16, dir: "up" },
    ],
    signs: [
      {
        x: 2,
        y: 18,
        text: ["ROUTE 1", "Renouet Bourg au sud — Route 2 au nord."],
      },
    ],
    encounters: [
      { id: 504, min: 2, max: 4, weight: 50 },
      { id: 506, min: 2, max: 4, weight: 50 },
    ],
  },

  route2: {
    name: "Route 2",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##..TTTT.==.......##",
      "##..WWDW.==....,,,##",
      "##.......==....,,,##",
      "##,,,....==....,,,##",
      "##,,,....==.......##",
      "##,,,....==.......##",
      "##.......==.......##",
      "##..####.==.####..##",
      "##..####.==.####..##",
      "##.......==.......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==.......##",
      "##...S...==.......##",
      "##.......==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "exploratrice-lea",
        x: 13,
        y: 11,
        dir: "left",
        sprite: "exploratrice",
        lines: ["Le Centre Pokémon soigne toute ton équipe. Gratuitement !"],
        trainer: {
          title: "Exploratrice",
          name: "Léa",
          sight: 3,
          reward: 320,
          team: [
            { id: 509, level: 6 },
            { id: 519, level: 6 },
          ],
          intro: ["Une nouvelle tête ! Montre-moi ce que tu vaux."],
          defeat: ["Bien joué. Tu as l'étoffe d'un Dresseur."],
          after: ["Va donc soigner ton équipe au Centre, juste au nord."],
        },
      },
    ],
    warps: [
      { x: 9, y: 17, to: "route1", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 17, to: "route1", tx: 10, ty: 1, dir: "down" },
      { x: 6, y: 3, to: "centre", tx: 6, ty: 8, dir: "up" },
      { x: 9, y: 0, to: "route3", tx: 9, ty: 16, dir: "up" },
      { x: 10, y: 0, to: "route3", tx: 10, ty: 16, dir: "up" },
    ],
    signs: [
      {
        x: 5,
        y: 15,
        text: ["ROUTE 2", "Le Centre Pokémon est au bout du chemin."],
      },
    ],
    encounters: [
      { id: 504, min: 4, max: 6, weight: 30 },
      { id: 506, min: 4, max: 6, weight: 30 },
      { id: 509, min: 4, max: 6, weight: 20 },
      { id: 519, min: 4, max: 6, weight: 20 },
    ],
  },

  centre: {
    name: "Centre Pokémon",
    indoor: true,
    // Comme à Unys, le comptoir de la Boutique partage la salle du Centre.
    tiles: [
      "XXXXXXXXXXXX",
      "X-CCC--CCC-X",
      "X-CCC--CCC-X",
      "X----------X",
      "X-B------B-X",
      "X----------X",
      "X----------X",
      "X----------X",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "infirmiere",
        x: 3,
        y: 3,
        dir: "down",
        sprite: "infirmiere",
        heals: true,
        lines: [
          "Bienvenue au Centre Pokémon !",
          "Nous allons soigner vos Pokémon. Un instant, je vous prie…",
        ],
      },
      {
        id: "vendeur",
        x: 8,
        y: 3,
        dir: "down",
        sprite: "vendeur",
        shop: true,
        lines: ["Bienvenue à la Boutique ! Que puis-je vous servir ?"],
      },
    ],
    warps: [
      { x: 5, y: 9, to: "route2", tx: 6, ty: 4, dir: "down" },
      { x: 6, y: 9, to: "route2", tx: 6, ty: 4, dir: "down" },
    ],
    signs: [],
  },

  route3: {
    name: "Route 3",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##.,,,,..==..,,,,.##",
      "##.,,,,..==..,,,,.##",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##~~~~...==...~~~~##",
      "##~~~~...==...~~~~##",
      "##.......==.......##",
      "##..,,,,,==,,,,,..##",
      "##..,,,,,==,,,,,..##",
      "##.......==.......##",
      "##.###...==...###.##",
      "##.###...==...###.##",
      "##..S....==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "ecolier-marc",
        x: 12,
        y: 10,
        dir: "left",
        sprite: "gamin",
        lines: ["Maillard est juste au nord. L'Arène t'attend !"],
        trainer: {
          title: "Écolier",
          name: "Marc",
          sight: 3,
          reward: 440,
          team: [
            { id: 506, level: 10 },
            { id: 519, level: 11 },
          ],
          intro: ["Tu montes vers l'Arène ? Prouve-moi que tu es prêt !"],
          defeat: ["Tu es plus fort que je ne le pensais."],
          after: ["La Championne de Maillard ne fera qu'une bouchée de moi."],
        },
      },
      {
        id: "pecheur",
        x: 6,
        y: 7,
        dir: "down",
        sprite: "villageois",
        lines: [
          "L'étang de la Route 3 est calme aujourd'hui.",
          "Au nord, la ville de Maillard : Centre Pokémon, Arène et même un marchand de vélos !",
        ],
      },
    ],
    warps: [
      { x: 9, y: 17, to: "route2", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 17, to: "route2", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "maillard", tx: 9, ty: 16, dir: "up" },
      { x: 10, y: 0, to: "maillard", tx: 10, ty: 16, dir: "up" },
    ],
    signs: [
      { x: 4, y: 16, text: ["ROUTE 3", "Maillard au nord — Route 2 au sud."] },
    ],
    encounters: [
      { id: 504, min: 8, max: 11, weight: 25 },
      { id: 506, min: 8, max: 11, weight: 25 },
      { id: 509, min: 9, max: 12, weight: 25 },
      { id: 519, min: 9, max: 12, weight: 25 },
    ],
  },

  maillard: {
    name: "Maillard",
    tiles: [
      "####################",
      "##..TTTT..TTTTTT..##",
      "##..TTTT..TTTTTT..##",
      "##..WWDW..WWWDWW..##",
      "##................##",
      "##.......==.......##",
      "##..TTTT.==.TTTT..##",
      "##..TTTT.==.TTTT..##",
      "##..WWDW.==.WWDW..##",
      "##.......==.......##",
      "##..TTT..==..TTT..##",
      "##..WDW..==..WDW..##",
      "##.......==.......##",
      "##..S....==....F..##",
      "##.......==.......##",
      "##..~~~..==..~~~..##",
      "##..~~~..==..~~~..##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "guide-arene",
        x: 11,
        y: 4,
        dir: "down",
        sprite: "villageois",
        lines: [
          "Bienvenue à Maillard ! L'Arène est le grand bâtiment de droite.",
          "La Championne adapte son dernier Pokémon au tien. Prépare-toi !",
        ],
      },
      {
        id: "habitante",
        x: 4,
        y: 12,
        dir: "right",
        sprite: "maman",
        lines: [
          "Le marchand de vélos vient d'ouvrir, à droite du Centre Pokémon.",
          "Avec un vélo, on file deux fois plus vite sur les routes !",
        ],
      },
    ],
    warps: [
      { x: 9, y: 17, to: "route3", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 17, to: "route3", tx: 10, ty: 1, dir: "down" },
      { x: 6, y: 3, to: "maison2", tx: 4, ty: 6, dir: "up" },
      { x: 13, y: 3, to: "arene", tx: 6, ty: 8, dir: "up" },
      { x: 6, y: 8, to: "centre2", tx: 6, ty: 8, dir: "up" },
      { x: 14, y: 8, to: "velo", tx: 4, ty: 6, dir: "up" },
    ],
    signs: [
      {
        x: 4,
        y: 13,
        text: ["MAILLARD", "La ville où l'on croise plus de Dresseurs que d'habitants."],
      },
      { x: 5, y: 11, text: ["C'est fermé. Les habitants sont à l'Arène."] },
      { x: 14, y: 11, text: ["Une odeur de gâteau s'échappe de la maison. Personne ne répond."] },
    ],
  },

  centre2: {
    name: "Centre Pokémon",
    indoor: true,
    tiles: [
      "XXXXXXXXXXXX",
      "X-CCC--CCC-X",
      "X-CCC--CCC-X",
      "X----------X",
      "X-B------B-X",
      "X----------X",
      "X----------X",
      "X----------X",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "infirmiere2",
        x: 3,
        y: 3,
        dir: "down",
        sprite: "infirmiere",
        heals: true,
        lines: [
          "Bienvenue au Centre Pokémon de Maillard !",
          "Nous allons soigner vos Pokémon. Un instant, je vous prie…",
        ],
      },
      {
        id: "vendeur2",
        x: 8,
        y: 3,
        dir: "down",
        sprite: "vendeur",
        shop: true,
        lines: ["Bienvenue à la Boutique ! Que puis-je vous servir ?"],
      },
    ],
    warps: [
      { x: 5, y: 9, to: "maillard", tx: 6, ty: 9, dir: "down" },
      { x: 6, y: 9, to: "maillard", tx: 6, ty: 9, dir: "down" },
    ],
    signs: [],
  },

  arene: {
    name: "Arène de Maillard",
    indoor: true,
    tiles: [
      "XXXXXXXXXXXX",
      "X----------X",
      "X----------X",
      "X-CC----CC-X",
      "X----------X",
      "X----------X",
      "X-CC----CC-X",
      "X----------X",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "championne-maelys",
        x: 6,
        y: 1,
        dir: "down",
        sprite: "championne",
        lines: ["L'insigne Trio est à toi. Porte-le fièrement !"],
        trainer: {
          title: "Championne",
          name: "Maëlys",
          sight: 2,
          reward: 1800,
          badge: "trio",
          mirror: true,
          team: [
            { id: 509, level: 12 },
            { id: 495, level: 14 },
          ],
          intro: [
            "Je suis Maëlys, Championne de l'Arène de Maillard.",
            "Ici, on choisit toujours le Pokémon qui met l'adversaire en difficulté.",
            "Voyons si ton équipe tient debout !",
          ],
          defeat: ["Magnifique. Tu as su renverser le rapport de force."],
          after: [
            "Reçois l'insigne Trio, la preuve de ta victoire.",
            "Les Dresseurs jusqu'au niveau 30 t'obéiront désormais.",
          ],
        },
      },
      {
        id: "serveur-theo",
        x: 4,
        y: 4,
        dir: "right",
        sprite: "gamin",
        lines: ["La Championne t'attend au fond de la salle."],
        trainer: {
          title: "Serveur",
          name: "Théo",
          sight: 3,
          reward: 320,
          team: [{ id: 505, level: 11 }],
          intro: ["Pas si vite ! On ne passe pas sans m'affronter."],
          defeat: ["Bien joué. La Championne sera un autre morceau."],
          after: ["Bonne chance contre Maëlys !"],
        },
      },
    ],
    warps: [
      { x: 5, y: 9, to: "maillard", tx: 13, ty: 4, dir: "down" },
      { x: 6, y: 9, to: "maillard", tx: 13, ty: 4, dir: "down" },
    ],
    signs: [],
  },

  velo: {
    name: "Cycles Maillard",
    indoor: true,
    tiles: [
      "XXXXXXXXXX",
      "X-CCCC---X",
      "X-CCCC---X",
      "X--------X",
      "X-B----B-X",
      "X--------X",
      "X--------X",
      "XXXXDDXXXX",
    ],
    npcs: [
      {
        id: "marchand-velo",
        x: 3,
        y: 3,
        dir: "down",
        sprite: "vendeur",
        bike: true,
        lines: ["Cycles Maillard, bonjour ! Nos vélos filent comme le vent."],
      },
    ],
    warps: [
      { x: 4, y: 7, to: "maillard", tx: 14, ty: 9, dir: "down" },
      { x: 5, y: 7, to: "maillard", tx: 14, ty: 9, dir: "down" },
    ],
    signs: [],
  },

  maison2: {
    name: "Maison de Maillard",
    indoor: true,
    tiles: [
      "XXXXXXXXXX",
      "X-BB---B-X",
      "X--------X",
      "X--------X",
      "X-B------X",
      "X--------X",
      "X--------X",
      "XXXXDDXXXX",
    ],
    npcs: [
      {
        id: "habitant2",
        x: 6,
        y: 2,
        dir: "down",
        sprite: "villageois",
        lines: [
          "Vous montez à l'Arène ? Prenez des Potions, croyez-moi.",
          "Maëlys ne fait aucun cadeau aux Dresseurs de passage.",
        ],
      },
    ],
    warps: [
      { x: 4, y: 7, to: "maillard", tx: 6, ty: 4, dir: "down" },
      { x: 5, y: 7, to: "maillard", tx: 6, ty: 4, dir: "down" },
    ],
    signs: [],
  },
};

/* --------------------------------------------------------------- accès */

export const mapWidth = (map: MapSpec) => map.tiles[0].length;
export const mapHeight = (map: MapSpec) => map.tiles.length;

export function tileAt(map: MapSpec, x: number, y: number): Tile | null {
  if (y < 0 || y >= map.tiles.length) return null;
  const row = map.tiles[y];
  if (x < 0 || x >= row.length) return null;
  return TILES[row[x]] ?? null;
}

export const tileChar = (map: MapSpec, x: number, y: number): string =>
  map.tiles[y]?.[x] ?? "#";

/** Une case est franchissable si elle existe, n'est pas solide et est libre. */
export function walkable(
  map: MapSpec,
  x: number,
  y: number,
  npcs: { x: number; y: number; hidden?: boolean }[],
): boolean {
  const tile = tileAt(map, x, y);
  if (!tile || tile.solid) return false;
  return !npcs.some((n) => !n.hidden && n.x === x && n.y === y);
}

export const warpAt = (map: MapSpec, x: number, y: number) =>
  map.warps.find((w) => w.x === x && w.y === y) ?? null;

export const signAt = (map: MapSpec, x: number, y: number) =>
  map.signs.find((s) => s.x === x && s.y === y) ?? null;

export const STEP: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** Tire une rencontre dans les hautes herbes selon les poids de la carte. */
export function rollEncounter(map: MapSpec): { id: number; level: number } | null {
  if (!map.encounters?.length) return null;
  const total = map.encounters.reduce((sum, e) => sum + e.weight, 0);
  let pick = Math.random() * total;
  for (const e of map.encounters) {
    pick -= e.weight;
    if (pick <= 0) {
      return {
        id: e.id,
        level: e.min + Math.floor(Math.random() * (e.max - e.min + 1)),
      };
    }
  }
  return null;
}

/**
 * Un dresseur repère le joueur s'il est dans son axe de regard, à portée,
 * sans obstacle entre eux.
 */
export function seesPlayer(
  map: MapSpec,
  npc: NpcSpec,
  px: number,
  py: number,
): boolean {
  if (!npc.trainer) return false;
  const { dx, dy } = STEP[npc.dir];
  for (let i = 1; i <= npc.trainer.sight; i++) {
    const x = npc.x + dx * i;
    const y = npc.y + dy * i;
    if (x === px && y === py) return true;
    const tile = tileAt(map, x, y);
    if (!tile || tile.solid) return false;
  }
  return false;
}
