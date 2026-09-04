/**
 * Le monde : des cartes en mode texte, un caractère par case. Les PNJ, les
 * passages et les tables de rencontre vivent à côté de la grille.
 */

import { WILD_POOL } from "./dex";

export type Dir = "up" | "down" | "left" | "right";

/** Gamme de couleurs du décor traversé. */
export type Biome = "plaine" | "foret" | "desert" | "montagne" | "neige";

export type MapId =
  | "bourg" | "maison" | "route1" | "route2" | "centre"
  | "route3" | "maillard" | "centre2" | "arene" | "velo" | "maison2"
  | "route4" | "aigueperse" | "centre3" | "arene2" | "maison3"
  | "route5" | "route6" | "mions" | "centre4" | "arene3" | "maison4"
  | "route7" | "route8" | "ligue" | "centre5"
  | "ligue1" | "ligue2" | "ligue3" | "ligue4" | "ligue5";

export type TileKind =
  | "grass" | "tall" | "path" | "flower" | "tree" | "water"
  | "wall" | "inwall" | "roof" | "door" | "floor" | "counter" | "furniture" | "sign"
  | "arena" | "stands" | "bus";

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
  A: { kind: "arena", solid: false },
  E: { kind: "stands", solid: true },
  U: { kind: "bus", solid: true },
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

export type Warp = {
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
  dir?: Dir;
  /** Marqueurs exigés pour franchir la porte : insignes, victoires… */
  needs?: string[];
  /** Ce que l'on entend quand il en manque un. */
  refusal?: string[];
};

export type Encounter = { id: number; min: number; max: number; weight: number };

export type MapSpec = {
  name: string;
  indoor?: boolean;
  /** Gamme de couleurs du décor : plaine par défaut. */
  biome?: Biome;
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
      "##.......==U......##",
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
      // On ne quitte pas le bourg les mains vides : le Professeur attend
      // devant son laboratoire tant que le starter n'a pas été choisi.
      {
        x: 9,
        y: 0,
        to: "route1",
        tx: 9,
        ty: 18,
        dir: "up",
        needs: ["starter"],
        refusal: [
          "Attends ! Les hautes herbes grouillent de Pokémon sauvages.",
          "Va d'abord voir le Professeur Keteleeria, devant son laboratoire au sud.",
        ],
      },
      {
        x: 10,
        y: 0,
        to: "route1",
        tx: 10,
        ty: 18,
        dir: "up",
        needs: ["starter"],
        refusal: [
          "Attends ! Les hautes herbes grouillent de Pokémon sauvages.",
          "Va d'abord voir le Professeur Keteleeria, devant son laboratoire au sud.",
        ],
      },
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
      "##.......==U......##",
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
      "##.......==U......##",
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
      "##.......==U......##",
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
      "#########==#########",
      "##..TTT..==..TTTT.##",
      "##..TTT..==..TTTT.##",
      "##..WDW..==..WWDW.##",
      "##.......==.......##",
      "##.......==U......##",
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
      { x: 9, y: 0, to: "route4", tx: 9, ty: 24, dir: "up" },
      { x: 10, y: 0, to: "route4", tx: 10, ty: 24, dir: "up" },
      { x: 5, y: 3, to: "maison2", tx: 4, ty: 6, dir: "up" },
      { x: 15, y: 3, to: "arene", tx: 6, ty: 12, dir: "up" },
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
      { x: 16, y: 4, text: ["Porte close. On entend une télévision à l'intérieur."] },
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
    // Gradins au fond et sur les flancs, terrain d'argile au centre : on
    // traverse la piste pour rejoindre le maître des lieux.
    tiles: [
      "XXXXXXXXXXXX",
      "XEEEEEEEEEEX",
      "XEEEEEEEEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "championne-maelys",
        x: 6,
        y: 3,
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
        x: 3,
        y: 7,
        dir: "right",
        sprite: "gamin",
        lines: ["La Championne t'attend au bout de la piste."],
        trainer: {
          title: "Serveur",
          name: "Théo",
          sight: 3,
          reward: 320,
          team: [{ id: 505, level: 11 }],
          intro: ["Pas si vite ! On ne traverse pas ma piste sans m'affronter."],
          defeat: ["Bien joué. La Championne sera un autre morceau."],
          after: ["Bonne chance contre Maëlys !"],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "maillard", tx: 15, ty: 4, dir: "down" },
      { x: 6, y: 13, to: "maillard", tx: 15, ty: 4, dir: "down" },
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
      { x: 4, y: 7, to: "maillard", tx: 5, ty: 4, dir: "down" },
      { x: 5, y: 7, to: "maillard", tx: 5, ty: 4, dir: "down" },
    ],
    signs: [],
  },

  /* ================================================ le nord de la région */

  route4: {
    name: "Route 4",
    biome: "foret",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==U......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##...,,,,==,,,,...##",
      "##...,,,,==,,,,...##",
      "##.......==.......##",
      "##.#####.==.#####.##",
      "##.#####.==.#####.##",
      "##.......==.......##",
      "##,,,,...==...,,,,##",
      "##,,,,...==...,,,,##",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##..,,,,,==,,,,,..##",
      "##..,,,,,==,,,,,..##",
      "##.......==.......##",
      "##..S....==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "bucheronne-alix",
        x: 12,
        y: 17,
        dir: "left",
        sprite: "exploratrice",
        lines: ["La forêt étouffe les bruits. Ouvre l'œil dans les fougères."],
        trainer: {
          title: "Bûcheronne",
          name: "Alix",
          sight: 3,
          reward: 620,
          team: [
            { id: 507, level: 14 },
            { id: 496, level: 15 },
          ],
          intro: ["Personne ne traverse ma forêt sans se mesurer à moi !"],
          defeat: ["Tu connais tes classiques, je te l'accorde."],
          after: ["Aigueperse est au nord. Son Arène ne fait pas de cadeau."],
        },
      },
      {
        id: "scout-remi",
        x: 7,
        y: 8,
        dir: "right",
        sprite: "gamin",
        lines: ["Les Pokémon d'ici sont bien plus coriaces qu'à Renouet."],
        trainer: {
          title: "Scout",
          name: "Rémi",
          sight: 3,
          reward: 540,
          team: [{ id: 519, level: 15 }],
          intro: ["Halte ! On ne passe pas sans un petit combat."],
          defeat: ["Rapide et bien joué…"],
          after: ["Bonne route sous les branches !"],
        },
      },
      {
        id: "herboriste",
        x: 14,
        y: 11,
        dir: "down",
        sprite: "villageois",
        lines: [
          "Je cueille des baies sous les grands arbres.",
          "Attention : plus on monte au nord, plus les Pokémon sont forts.",
        ],
      },
    ],
    warps: [
      { x: 9, y: 25, to: "maillard", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 25, to: "maillard", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "aigueperse", tx: 9, ty: 18, dir: "up" },
      { x: 10, y: 0, to: "aigueperse", tx: 10, ty: 18, dir: "up" },
    ],
    signs: [
      { x: 4, y: 24, text: ["ROUTE 4 — LA HÊTRAIE", "Maillard au sud, Aigueperse au nord."] },
    ],
    encounters: [
      { id: 506, min: 13, max: 16, weight: 25 },
      { id: 509, min: 13, max: 16, weight: 20 },
      { id: 519, min: 14, max: 17, weight: 25 },
      { id: 557, min: 14, max: 17, weight: 30 },
    ],
  },

  aigueperse: {
    name: "Aigueperse",
    biome: "foret",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##..TTTT.==.TTTT..##",
      "##..TTTT.==.TTTT..##",
      "##..WWDW.==.WWDW..##",
      "##.......==.......##",
      "##..F....==U...F..##",
      "##.......==.......##",
      "##.TTTTT.==.TTTTT.##",
      "##.TTTTT.==.TTTTT.##",
      "##.WWDWW.==.WWDWW.##",
      "##.......==.......##",
      "##..S....==.......##",
      "##.......==.......##",
      "##..TTT..==..TTT..##",
      "##..WDW..==..WDW..##",
      "##.......==.......##",
      "##..,,,..==..,,,..##",
      "##..,,,..==..,,,..##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "guide-aigueperse",
        x: 12,
        y: 11,
        dir: "left",
        sprite: "villageois",
        lines: [
          "Bienvenue à Aigueperse, la ville sous les frondaisons.",
          "L'Arène est le grand bâtiment de droite. Steven n'y aligne qu'un Pokémon… et ça suffit.",
        ],
      },
      {
        id: "fillette-aigueperse",
        x: 5,
        y: 6,
        dir: "right",
        sprite: "maman",
        lines: ["Mon frère dit qu'un Pokémon de type Feu ferait des merveilles à l'Arène."],
      },
    ],
    warps: [
      { x: 9, y: 19, to: "route4", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 19, to: "route4", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "route5", tx: 9, ty: 24, dir: "up" },
      { x: 10, y: 0, to: "route5", tx: 10, ty: 24, dir: "up" },
      { x: 6, y: 4, to: "maison3", tx: 4, ty: 6, dir: "up" },
      { x: 5, y: 10, to: "centre3", tx: 6, ty: 8, dir: "up" },
      { x: 14, y: 10, to: "arene2", tx: 6, ty: 12, dir: "up" },
    ],
    signs: [
      {
        x: 4,
        y: 12,
        text: ["AIGUEPERSE", "Ici, les maisons poussent entre les arbres."],
      },
      { x: 14, y: 4, text: ["Fermé. Un panneau annonce : « parti cueillir »."] },
      { x: 5, y: 15, text: ["Personne ne répond. Un chien aboie derrière la porte."] },
      { x: 14, y: 15, text: ["La porte est bloquée par une pile de bûches."] },
    ],
  },

  centre3: {
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
        id: "infirmiere3",
        x: 3,
        y: 3,
        dir: "down",
        sprite: "infirmiere",
        heals: true,
        lines: [
          "Bienvenue au Centre Pokémon d'Aigueperse !",
          "Nous allons soigner vos Pokémon. Un instant, je vous prie…",
        ],
      },
      {
        id: "vendeur3",
        x: 8,
        y: 3,
        dir: "down",
        sprite: "vendeur",
        shop: true,
        lines: ["Bienvenue à la Boutique ! Que puis-je vous servir ?"],
      },
    ],
    warps: [
      { x: 5, y: 9, to: "aigueperse", tx: 5, ty: 11, dir: "down" },
      { x: 6, y: 9, to: "aigueperse", tx: 5, ty: 11, dir: "down" },
    ],
    signs: [],
  },

  arene2: {
    name: "Arène d'Aigueperse",
    indoor: true,
    tiles: [
      "XXXXXXXXXXXX",
      "XEEEEEEEEEEX",
      "XEEEEEEEEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "champion-steven",
        x: 6,
        y: 3,
        dir: "down",
        sprite: "championne",
        lines: ["L'insigne Sylve est à toi. La forêt te reconnaît."],
        trainer: {
          title: "Champion",
          name: "Steven",
          sight: 2,
          reward: 2600,
          badge: "sylve",
          team: [{ id: 384, level: 12 }],
          intro: [
            "Je suis Steven, Champion d'Aigueperse.",
            "On me dit excentrique de n'aligner qu'un seul Pokémon.",
            "Vous comprendrez vite pourquoi il me suffit.",
          ],
          defeat: ["Vous avez fait tomber le ciel. Je m'incline."],
          after: [
            "Reçois l'insigne Sylve, taillé dans un hêtre centenaire.",
            "Au nord commence le désert. Prends des Potions, beaucoup.",
          ],
        },
      },
      {
        id: "sylvicultrice-jade",
        x: 3,
        y: 7,
        dir: "right",
        sprite: "exploratrice",
        lines: ["Le Champion attend au bout de la piste."],
        trainer: {
          title: "Sylvicultrice",
          name: "Jade",
          sight: 3,
          reward: 720,
          team: [{ id: 557, level: 17 }],
          intro: ["On ne traverse pas cette piste sans se battre."],
          defeat: ["Solide. Vraiment solide."],
          after: ["Steven t'attend. Bonne chance, tu vas en avoir besoin."],
        },
      },
      {
        id: "apprenti-noe",
        x: 8,
        y: 5,
        dir: "left",
        sprite: "gamin",
        lines: ["Moi aussi je veux devenir Champion un jour !"],
        trainer: {
          title: "Apprenti",
          name: "Noé",
          sight: 3,
          reward: 640,
          team: [{ id: 507, level: 16 }],
          intro: ["Deuxième obstacle ! Prêt ?"],
          defeat: ["Aïe. Encore raté."],
          after: ["Tu es vraiment fort…"],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "aigueperse", tx: 14, ty: 11, dir: "down" },
      { x: 6, y: 13, to: "aigueperse", tx: 14, ty: 11, dir: "down" },
    ],
    signs: [],
  },

  maison3: {
    name: "Maison d'Aigueperse",
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
        id: "habitant3",
        x: 6,
        y: 2,
        dir: "down",
        sprite: "villageois",
        lines: [
          "Vous montez vers le désert ? Emportez de quoi soigner.",
          "Les Mascaïman s'enfouissent dans le sable et surgissent sans prévenir.",
        ],
      },
    ],
    warps: [
      { x: 4, y: 7, to: "aigueperse", tx: 6, ty: 5, dir: "down" },
      { x: 5, y: 7, to: "aigueperse", tx: 6, ty: 5, dir: "down" },
    ],
    signs: [],
  },

  route5: {
    name: "Route 5",
    biome: "desert",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==U......##",
      "##..#.#..==..#.#..##",
      "##.......==.......##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##,,,,,,,==,,,,,,,##",
      "##,,,,,,,==,,,,,,,##",
      "##.......==.......##",
      "##.#...#.==.#...#.##",
      "##.......==.......##",
      "##..,,,..==..,,,..##",
      "##..,,,..==..,,,..##",
      "##.......==.......##",
      "##.#.#.#.==.#.#.#.##",
      "##.......==.......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==.......##",
      "##..#.#..==..#.#..##",
      "##.......==.......##",
      "##..S....==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "nomade-sofia",
        x: 12,
        y: 13,
        dir: "left",
        sprite: "exploratrice",
        lines: ["Le sable brûle et les Pokémon mordent. Bienvenue."],
        trainer: {
          title: "Nomade",
          name: "Sofia",
          sight: 3,
          reward: 880,
          team: [
            { id: 551, level: 19 },
            { id: 505, level: 20 },
          ],
          intro: ["Un visage nouveau dans mon désert ! Voyons ce que tu vaux."],
          defeat: ["Le sable ne t'a pas ralenti. Impressionnant."],
          after: ["La montagne t'attend au nord. Couvre-toi."],
        },
      },
      {
        id: "chercheur-ali",
        x: 7,
        y: 6,
        dir: "right",
        sprite: "prof",
        lines: ["J'étudie les Mascaïman. Fascinants, ces petits carnassiers."],
        trainer: {
          title: "Chercheur",
          name: "Ali",
          sight: 3,
          reward: 760,
          team: [{ id: 551, level: 20 }],
          intro: ["Une donnée de plus pour mes travaux : affrontons-nous !"],
          defeat: ["Résultat noté. Tu es au-dessus de la moyenne."],
          after: ["Reviens me voir si tu captures un Mascaïman."],
        },
      },
    ],
    warps: [
      { x: 9, y: 25, to: "aigueperse", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 25, to: "aigueperse", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "route6", tx: 9, ty: 22, dir: "up" },
      { x: 10, y: 0, to: "route6", tx: 10, ty: 22, dir: "up" },
    ],
    signs: [
      { x: 4, y: 24, text: ["ROUTE 5 — LES SABLES", "Ni ombre, ni eau. Avancez vite."] },
    ],
    encounters: [
      { id: 551, min: 18, max: 21, weight: 40 },
      { id: 557, min: 18, max: 21, weight: 25 },
      { id: 505, min: 19, max: 22, weight: 20 },
      { id: 510, min: 19, max: 22, weight: 15 },
    ],
  },

  route6: {
    name: "Route 6",
    biome: "montagne",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==U......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==.......##",
      "##.#####.==.#####.##",
      "##.#####.==.#####.##",
      "##.......==.......##",
      "##..,,,,,==,,,,,..##",
      "##..,,,,,==,,,,,..##",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##,,,,...==...,,,,##",
      "##,,,,...==...,,,,##",
      "##.......==.......##",
      "##.#####.==.#####.##",
      "##.......==.......##",
      "##..S....==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "alpiniste-yann",
        x: 12,
        y: 19,
        dir: "left",
        sprite: "gamin",
        lines: ["L'air se raréfie mais la vue est splendide."],
        trainer: {
          title: "Alpiniste",
          name: "Yann",
          sight: 3,
          reward: 1080,
          team: [
            { id: 529, level: 23 },
            { id: 508, level: 24 },
          ],
          intro: ["On ne monte pas plus haut sans passer par moi !"],
          defeat: ["Tu grimpes vite, dans tous les sens du terme."],
          after: ["Mions est juste au-dessus. Le froid y mord."],
        },
      },
      {
        id: "guide-montagne",
        x: 7,
        y: 10,
        dir: "right",
        sprite: "exploratrice",
        lines: ["Le sentier est balisé jusqu'à Mions. Ne t'en écarte pas."],
        trainer: {
          title: "Guide",
          name: "Maud",
          sight: 3,
          reward: 960,
          team: [{ id: 521, level: 24 }],
          intro: ["Un dernier test avant le sommet !"],
          defeat: ["Le sommet est à toi."],
          after: ["Bon courage contre le Champion de Mions."],
        },
      },
    ],
    warps: [
      { x: 9, y: 23, to: "route5", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 23, to: "route5", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "mions", tx: 9, ty: 18, dir: "up" },
      { x: 10, y: 0, to: "mions", tx: 10, ty: 18, dir: "up" },
    ],
    signs: [
      { x: 4, y: 22, text: ["ROUTE 6 — LA CRÊTE", "Mions au nord. Attention au verglas."] },
    ],
    encounters: [
      { id: 529, min: 23, max: 26, weight: 35 },
      { id: 557, min: 23, max: 26, weight: 25 },
      { id: 508, min: 24, max: 27, weight: 20 },
      { id: 521, min: 24, max: 27, weight: 20 },
    ],
  },

  mions: {
    name: "Mions",
    biome: "montagne",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##..TTTT.==.TTTT..##",
      "##..TTTT.==.TTTT..##",
      "##..WWDW.==.WWDW..##",
      "##.......==.......##",
      "##..F....==U...F..##",
      "##.......==.......##",
      "##.TTTTT.==.TTTTT.##",
      "##.TTTTT.==.TTTTT.##",
      "##.WWDWW.==.WWDWW.##",
      "##.......==.......##",
      "##..S....==.......##",
      "##.......==.......##",
      "##..TTT..==..TTT..##",
      "##..WDW..==..WDW..##",
      "##.......==.......##",
      "##..,,,..==..,,,..##",
      "##..,,,..==..,,,..##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "guide-mions",
        x: 12,
        y: 11,
        dir: "left",
        sprite: "villageois",
        lines: [
          "Mions, dernier village avant les cimes.",
          "L'Arène d'Anthony est à droite. Il ouvre au feu et il finit à la foudre.",
        ],
      },
      {
        id: "ancienne-mions",
        x: 5,
        y: 6,
        dir: "right",
        sprite: "maman",
        lines: [
          "Trois insignes, et te voilà Dresseur accompli.",
          "Repose-toi au Centre avant d'affronter Anthony.",
        ],
      },
    ],
    warps: [
      { x: 9, y: 19, to: "route6", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 19, to: "route6", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "route7", tx: 9, ty: 22, dir: "up" },
      { x: 10, y: 0, to: "route7", tx: 10, ty: 22, dir: "up" },
      { x: 6, y: 4, to: "maison4", tx: 4, ty: 6, dir: "up" },
      { x: 5, y: 10, to: "centre4", tx: 6, ty: 8, dir: "up" },
      { x: 14, y: 10, to: "arene3", tx: 6, ty: 12, dir: "up" },
    ],
    signs: [
      {
        x: 4,
        y: 12,
        text: ["MIONS", "Le village le plus haut de la région."],
      },
      { x: 14, y: 4, text: ["Les volets sont clos pour l'hiver."] },
      { x: 5, y: 15, text: ["Une cheminée fume, mais personne n'ouvre."] },
      { x: 14, y: 15, text: ["Fermé. Une paire de skis est plantée dans la neige."] },
    ],
  },

  centre4: {
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
        id: "infirmiere4",
        x: 3,
        y: 3,
        dir: "down",
        sprite: "infirmiere",
        heals: true,
        lines: [
          "Bienvenue au Centre Pokémon de Mions !",
          "Nous allons soigner vos Pokémon. Un instant, je vous prie…",
        ],
      },
      {
        id: "vendeur4",
        x: 8,
        y: 3,
        dir: "down",
        sprite: "vendeur",
        shop: true,
        lines: ["Bienvenue à la Boutique ! Que puis-je vous servir ?"],
      },
    ],
    warps: [
      { x: 5, y: 9, to: "mions", tx: 5, ty: 11, dir: "down" },
      { x: 6, y: 9, to: "mions", tx: 5, ty: 11, dir: "down" },
    ],
    signs: [],
  },

  arene3: {
    name: "Arène de Mions",
    indoor: true,
    tiles: [
      "XXXXXXXXXXXX",
      "XEEEEEEEEEEX",
      "XEEEEEEEEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "champion-anthony",
        x: 6,
        y: 3,
        dir: "down",
        sprite: "championne",
        lines: ["L'insigne Roc t'appartient. La montagne t'a adopté."],
        trainer: {
          title: "Champion",
          name: "Anthony",
          sight: 2,
          reward: 3600,
          badge: "roc",
          team: [
            { id: 500, level: 28 },
            { id: 644, level: 15 },
          ],
          intro: [
            "Je suis Anthony, Champion de Mions.",
            "Le feu ouvre la voie, la foudre la referme.",
            "Personne n'a encore vu mes deux Pokémon tomber le même jour.",
          ],
          defeat: ["Le feu s'éteint et la foudre se tait. Bien joué."],
          after: [
            "Reçois l'insigne Roc, taillé dans la pierre du sommet.",
            "Trois insignes : la région entière connaît ton nom, désormais.",
          ],
        },
      },
      {
        id: "mineur-gustave",
        x: 3,
        y: 7,
        dir: "right",
        sprite: "villageois",
        lines: ["Le Champion ne s'affronte qu'après nous."],
        trainer: {
          title: "Mineur",
          name: "Gustave",
          sight: 3,
          reward: 1240,
          team: [{ id: 529, level: 24 }],
          intro: ["La piste est à moi. Prouve-moi le contraire !"],
          defeat: ["Bien creusé."],
          after: ["Anthony va te donner du fil à retordre."],
        },
      },
      {
        id: "grimpeuse-lise",
        x: 8,
        y: 5,
        dir: "left",
        sprite: "exploratrice",
        lines: ["Deux insignes déjà ? Alors ce sera un vrai combat."],
        trainer: {
          title: "Grimpeuse",
          name: "Lise",
          sight: 3,
          reward: 1160,
          team: [{ id: 508, level: 25 }],
          intro: ["Dernier verrou avant le Champion !"],
          defeat: ["Passe. Tu l'as mérité."],
          after: ["Il t'attend au fond de la piste."],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "mions", tx: 14, ty: 11, dir: "down" },
      { x: 6, y: 13, to: "mions", tx: 14, ty: 11, dir: "down" },
    ],
    signs: [],
  },

  maison4: {
    name: "Maison de Mions",
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
        id: "habitant4",
        x: 6,
        y: 2,
        dir: "down",
        sprite: "villageois",
        lines: [
          "Anthony n'a jamais perdu contre un Dresseur pressé.",
          "Entraîne-toi sur la crête avant de frapper à sa porte.",
        ],
      },
    ],
    warps: [
      { x: 4, y: 7, to: "mions", tx: 6, ty: 5, dir: "down" },
      { x: 5, y: 7, to: "mions", tx: 6, ty: 5, dir: "down" },
    ],
    signs: [],
  },

  /* ============================================ la montée vers la Ligue */

  route7: {
    name: "Route 7",
    biome: "neige",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==U......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==.......##",
      "##.#####.==.#####.##",
      "##.#####.==.#####.##",
      "##.......==.......##",
      "##..,,,,,==,,,,,..##",
      "##..,,,,,==,,,,,..##",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##,,,,...==...,,,,##",
      "##,,,,...==...,,,,##",
      "##.......==.......##",
      "##.#####.==.#####.##",
      "##.......==.......##",
      "##..S....==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "skieuse-nina",
        x: 12,
        y: 19,
        dir: "left",
        sprite: "exploratrice",
        lines: ["Le col reste blanc toute l'année. Couvre-toi bien."],
        trainer: {
          title: "Skieuse",
          name: "Nina",
          sight: 3,
          reward: 1520,
          team: [
            { id: 508, level: 29 },
            { id: 521, level: 30 },
          ],
          intro: ["On ne franchit pas le col sans un combat !"],
          defeat: ["Tu tiens debout sur la glace, bravo."],
          after: ["Encore une route et tu verras le Plateau."],
        },
      },
      {
        id: "montagnard-hugo",
        x: 7,
        y: 10,
        dir: "right",
        sprite: "villageois",
        lines: ["Trois insignes ne suffiront pas contre la Ligue. Entraîne-toi."],
        trainer: {
          title: "Montagnard",
          name: "Hugo",
          sight: 3,
          reward: 1400,
          team: [{ id: 248, level: 31 }],
          intro: ["Mon Tyranocif n'a jamais reculé. Voyons le tien."],
          defeat: ["De la roche contre de la roche… tu as gagné."],
          after: ["La Ligue t'attend, plus haut."],
        },
      },
    ],
    warps: [
      { x: 9, y: 23, to: "mions", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 23, to: "mions", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "route8", tx: 9, ty: 20, dir: "up" },
      { x: 10, y: 0, to: "route8", tx: 10, ty: 20, dir: "up" },
    ],
    signs: [
      { x: 4, y: 22, text: ["ROUTE 7 — LE COL BLANC", "Mions au sud. Le Plateau au nord."] },
    ],
    encounters: [
      { id: 508, min: 28, max: 31, weight: 30 },
      { id: 521, min: 28, max: 31, weight: 25 },
      { id: 529, min: 29, max: 32, weight: 25 },
      { id: 248, min: 30, max: 33, weight: 20 },
    ],
  },

  route8: {
    name: "Route 8",
    biome: "montagne",
    tiles: [
      "#########==#########",
      "##.......==.......##",
      "##,,,,,..==..,,,,,##",
      "##,,,,,..==..,,,,,##",
      "##.......==U......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##.#####.==.#####.##",
      "##.#####.==.#####.##",
      "##.......==.......##",
      "##..,,,,,==,,,,,..##",
      "##..,,,,,==,,,,,..##",
      "##.......==.......##",
      "##..###..==..###..##",
      "##..###..==..###..##",
      "##.......==.......##",
      "##,,,,...==...,,,,##",
      "##,,,,...==...,,,,##",
      "##.......==.......##",
      "##..S....==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "veterane-sasha",
        x: 12,
        y: 17,
        dir: "left",
        sprite: "championne",
        lines: ["Je m'entraîne ici depuis vingt ans. La Ligue, c'est autre chose."],
        trainer: {
          title: "Vétérane",
          name: "Sasha",
          sight: 3,
          reward: 2100,
          team: [
            { id: 503, level: 33 },
            { id: 448, level: 34 },
          ],
          intro: ["Dernier avertissement avant le Plateau. En garde !"],
          defeat: ["Tu es prêt. Vraiment prêt."],
          after: ["Soigne ton équipe là-haut avant d'entrer. Crois-moi."],
        },
      },
      {
        id: "portier-route8",
        x: 8,
        y: 7,
        dir: "right",
        sprite: "gamin",
        lines: [
          "Le Plateau est juste au-dessus.",
          "Sans les trois insignes, les portes de la Ligue restent closes.",
        ],
      },
    ],
    warps: [
      { x: 9, y: 21, to: "route7", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 21, to: "route7", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 0, to: "ligue", tx: 9, ty: 14, dir: "up" },
      { x: 10, y: 0, to: "ligue", tx: 10, ty: 14, dir: "up" },
    ],
    signs: [
      { x: 4, y: 20, text: ["ROUTE 8 — LA MONTÉE", "Plus qu'un effort avant le Plateau."] },
    ],
    encounters: [
      { id: 248, min: 32, max: 35, weight: 30 },
      { id: 448, min: 32, max: 35, weight: 20 },
      { id: 508, min: 32, max: 35, weight: 25 },
      { id: 130, min: 33, max: 36, weight: 25 },
    ],
  },

  ligue: {
    name: "Plateau de la Ligue",
    biome: "montagne",
    tiles: [
      "####################",
      "##..TTTTTTTTTTTT..##",
      "##..TTTTTTTTTTTT..##",
      "##..TTTTTTTTTTTT..##",
      "##..WWWWWDDWWWWW..##",
      "##.......==.......##",
      "##.......==U......##",
      "##..TTTT.==.......##",
      "##..WWDW.==.......##",
      "##.......==.......##",
      "##..S....==.......##",
      "##.......==.......##",
      "##..~~~..==..~~~..##",
      "##..~~~..==..~~~..##",
      "##.......==.......##",
      "#########==#########",
    ],
    npcs: [
      {
        id: "huissier-ligue",
        x: 12,
        y: 5,
        dir: "left",
        sprite: "vendeur",
        lines: [
          "Bienvenue au Plateau de la Ligue Pokémon.",
          "Derrière ces portes : Yen, Christina, Will et Vic — puis leur capitaine.",
          "On ne ressort pas de la salle d'un membre sans l'avoir battu.",
        ],
      },
    ],
    warps: [
      { x: 9, y: 15, to: "route8", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 15, to: "route8", tx: 10, ty: 1, dir: "down" },
      {
        x: 9,
        y: 4,
        to: "ligue1",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["insigne:trio", "insigne:sylve", "insigne:roc"],
        refusal: [
          "Les portes de la Ligue restent closes.",
          "Il faut les trois insignes de la région pour entrer.",
        ],
      },
      {
        x: 10,
        y: 4,
        to: "ligue1",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["insigne:trio", "insigne:sylve", "insigne:roc"],
        refusal: [
          "Les portes de la Ligue restent closes.",
          "Il faut les trois insignes de la région pour entrer.",
        ],
      },
      { x: 6, y: 8, to: "centre5", tx: 6, ty: 8, dir: "up" },
    ],
    signs: [
      {
        x: 4,
        y: 10,
        text: [
          "PLATEAU DE LA LIGUE",
          "Ici s'arrêtent les Dresseurs. Ici commencent les champions.",
        ],
      },
    ],
  },

  centre5: {
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
        id: "infirmiere5",
        x: 3,
        y: 3,
        dir: "down",
        sprite: "infirmiere",
        heals: true,
        lines: [
          "Bienvenue au Centre Pokémon du Plateau !",
          "C'est ici que l'on souffle avant d'affronter la Ligue…",
        ],
      },
      {
        id: "vendeur5",
        x: 8,
        y: 3,
        dir: "down",
        sprite: "vendeur",
        shop: true,
        lines: ["Bienvenue à la Boutique ! Prenez des Potions, beaucoup."],
      },
    ],
    warps: [
      { x: 5, y: 9, to: "ligue", tx: 6, ty: 9, dir: "down" },
      { x: 6, y: 9, to: "ligue", tx: 6, ty: 9, dir: "down" },
    ],
    signs: [],
  },

  ligue1: {
    name: "Ligue — Yen",
    indoor: true,
    tiles: [
      "XXXXXDDXXXXX",
      "XEEEE--EEEEX",
      "XEEEE--EEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "ligue-yen",
        x: 6,
        y: 3,
        dir: "down",
        sprite: "championne",
        lines: ["Passe. La porte du fond t'est ouverte."],
        trainer: {
          title: "Conseil 4",
          name: "Yen",
          sight: 3,
          reward: 5200,
          team: [
            { id: 510, level: 49 },
            { id: 551, level: 50 },
            { id: 248, level: 52 },
          ],
          intro: [
            "Je suis Yen, premier membre du Conseil 4.",
            "L'ombre ne pardonne pas l'hésitation.",
          ],
          defeat: ["Tu as vu dans le noir. Passe."],
          after: ["La porte du fond mène à Christina. Elle ne sera pas plus tendre."],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "ligue", tx: 9, ty: 5, dir: "down" },
      { x: 6, y: 13, to: "ligue", tx: 9, ty: 5, dir: "down" },
      {
        x: 5,
        y: 0,
        to: "ligue2",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-yen"],
        refusal: ["La porte ne s'ouvre pas.", "Yen doit d'abord être battue."],
      },
      {
        x: 6,
        y: 0,
        to: "ligue2",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-yen"],
        refusal: ["La porte ne s'ouvre pas.", "Yen doit d'abord être battue."],
      },
    ],
    signs: [],
  },

  ligue2: {
    name: "Ligue — Christina",
    indoor: true,
    tiles: [
      "XXXXXDDXXXXX",
      "XEEEE--EEEEX",
      "XEEEE--EEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "ligue-christina",
        x: 6,
        y: 3,
        dir: "down",
        sprite: "infirmiere",
        lines: ["Continue. Will attend derrière moi."],
        trainer: {
          title: "Conseil 4",
          name: "Christina",
          sight: 3,
          reward: 5600,
          team: [
            { id: 502, level: 50 },
            { id: 503, level: 51 },
            { id: 130, level: 53 },
          ],
          intro: [
            "Christina, deuxième membre du Conseil 4.",
            "L'eau finit toujours par user la pierre. Voyons ta patience.",
          ],
          defeat: ["Le courant t'a porté. Bien."],
          after: ["Will vole plus haut que moi. Prends garde à ton dos."],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "ligue1", tx: 6, ty: 1, dir: "down" },
      { x: 6, y: 13, to: "ligue1", tx: 6, ty: 1, dir: "down" },
      {
        x: 5,
        y: 0,
        to: "ligue3",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-christina"],
        refusal: ["La porte ne s'ouvre pas.", "Christina doit d'abord être battue."],
      },
      {
        x: 6,
        y: 0,
        to: "ligue3",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-christina"],
        refusal: ["La porte ne s'ouvre pas.", "Christina doit d'abord être battue."],
      },
    ],
    signs: [],
  },

  ligue3: {
    name: "Ligue — Will",
    indoor: true,
    tiles: [
      "XXXXXDDXXXXX",
      "XEEEE--EEEEX",
      "XEEEE--EEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "ligue-will",
        x: 6,
        y: 3,
        dir: "down",
        sprite: "prof",
        lines: ["Le ciel t'a laissé passer. Vic est au fond."],
        trainer: {
          title: "Conseil 4",
          name: "Will",
          sight: 3,
          reward: 6000,
          team: [
            { id: 520, level: 51 },
            { id: 521, level: 52 },
            { id: 384, level: 54 },
          ],
          intro: [
            "Will, troisième membre du Conseil 4.",
            "Depuis le ciel, on voit venir tous les coups. Essaie quand même.",
          ],
          defeat: ["Tu m'as pris de vitesse. Rare."],
          after: ["Vic tient la salle suivante. Il ne bouge pas d'un pouce."],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "ligue2", tx: 6, ty: 1, dir: "down" },
      { x: 6, y: 13, to: "ligue2", tx: 6, ty: 1, dir: "down" },
      {
        x: 5,
        y: 0,
        to: "ligue4",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-will"],
        refusal: ["La porte ne s'ouvre pas.", "Will doit d'abord être battu."],
      },
      {
        x: 6,
        y: 0,
        to: "ligue4",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-will"],
        refusal: ["La porte ne s'ouvre pas.", "Will doit d'abord être battu."],
      },
    ],
    signs: [],
  },

  ligue4: {
    name: "Ligue — Vic",
    indoor: true,
    tiles: [
      "XXXXXDDXXXXX",
      "XEEEE--EEEEX",
      "XEEEE--EEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "ligue-vic",
        x: 6,
        y: 3,
        dir: "down",
        sprite: "villageois",
        lines: ["La dernière porte est à toi. Eren t'attend."],
        trainer: {
          title: "Conseil 4",
          name: "Vic",
          sight: 3,
          reward: 6400,
          team: [
            { id: 529, level: 52 },
            { id: 557, level: 53 },
            { id: 448, level: 55 },
          ],
          intro: [
            "Vic, quatrième et dernier rempart avant le capitaine.",
            "Rien ne passe. Jamais. Prouve-moi le contraire.",
          ],
          defeat: ["Le rempart est tombé. Va-t'en le voir."],
          after: [
            "Derrière cette porte se tient Eren, notre capitaine.",
            "Personne ne l'a battu. Personne.",
          ],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "ligue3", tx: 6, ty: 1, dir: "down" },
      { x: 6, y: 13, to: "ligue3", tx: 6, ty: 1, dir: "down" },
      {
        x: 5,
        y: 0,
        to: "ligue5",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-vic"],
        refusal: ["La porte ne s'ouvre pas.", "Vic doit d'abord être battu."],
      },
      {
        x: 6,
        y: 0,
        to: "ligue5",
        tx: 6,
        ty: 12,
        dir: "up",
        needs: ["battu:ligue-vic"],
        refusal: ["La porte ne s'ouvre pas.", "Vic doit d'abord être battu."],
      },
    ],
    signs: [],
  },

  ligue5: {
    name: "Ligue — Eren",
    indoor: true,
    // Pas de porte au fond : la salle du capitaine est un cul-de-sac.
    tiles: [
      "XXXXXXXXXXXX",
      "XEEEEEEEEEEX",
      "XEEEEEEEEEEX",
      "X----------X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X-AAAAAAAA-X",
      "X----------X",
      "XEE------EEX",
      "X----------X",
      "XXXXXDDXXXXX",
    ],
    npcs: [
      {
        id: "ligue-eren",
        x: 6,
        y: 3,
        dir: "down",
        sprite: "championne",
        lines: ["Le titre est à toi. Porte-le mieux que je ne l'ai porté."],
        trainer: {
          title: "Capitaine",
          name: "Eren",
          sight: 3,
          reward: 12000,
          badge: "ligue",
          team: [
            { id: 497, level: 55 },
            { id: 500, level: 56 },
            { id: 643, level: 58 },
            { id: 644, level: 60 },
          ],
          intro: [
            "Alors c'est toi. Quatre victoires pour arriver jusqu'ici.",
            "Je suis Eren, capitaine du Conseil 4. On ne m'a jamais battu.",
            "Montre-moi ce que valent tes six compagnons.",
          ],
          defeat: [
            "…",
            "Je n'avais jamais vu ça. Pas une seule fois en dix ans.",
          ],
          after: [
            "Tu es le nouveau Maître de la Ligue Pokémon.",
            "Ton nom rejoint le Panthéon, avec celui de ton équipe.",
            "Merci d'avoir joué !",
          ],
        },
      },
    ],
    warps: [
      { x: 5, y: 13, to: "ligue4", tx: 6, ty: 1, dir: "down" },
      { x: 6, y: 13, to: "ligue4", tx: 6, ty: 1, dir: "down" },
    ],
    signs: [],
  },
};

/* ------------------------------------------------- la carte de la région */

export type RegionNode = {
  map: MapId;
  label: string;
  short: string;
  kind: "ville" | "route";
  biome: Biome;
  /** Position sur la carte, en pourcentage de sa surface. */
  x: number;
  y: number;
  /** Intérieurs rattachés : on y est toujours « dans » ce lieu. */
  inside?: MapId[];
};

/**
 * L'itinéraire du sud au nord, tel qu'il apparaît sur la carte. L'ordre fait
 * foi : les liaisons sont tracées d'un nœud au suivant.
 */
export const REGION: RegionNode[] = [
  { map: "bourg", label: "Renouet Bourg", short: "Renouet", kind: "ville", biome: "plaine", x: 12, y: 93, inside: ["maison"] },
  { map: "route1", label: "Route 1", short: "R1", kind: "route", biome: "plaine", x: 12, y: 82 },
  { map: "route2", label: "Route 2", short: "R2", kind: "route", biome: "plaine", x: 24, y: 76, inside: ["centre"] },
  { map: "route3", label: "Route 3", short: "R3", kind: "route", biome: "plaine", x: 20, y: 66 },
  { map: "maillard", label: "Maillard", short: "Maillard", kind: "ville", biome: "plaine", x: 32, y: 60, inside: ["centre2", "arene", "velo", "maison2"] },
  { map: "route4", label: "Route 4", short: "R4", kind: "route", biome: "foret", x: 46, y: 64 },
  { map: "aigueperse", label: "Aigueperse", short: "Aigueperse", kind: "ville", biome: "foret", x: 58, y: 56, inside: ["centre3", "arene2", "maison3"] },
  { map: "route5", label: "Route 5", short: "R5", kind: "route", biome: "desert", x: 72, y: 50 },
  { map: "route6", label: "Route 6", short: "R6", kind: "route", biome: "montagne", x: 62, y: 38 },
  { map: "mions", label: "Mions", short: "Mions", kind: "ville", biome: "montagne", x: 74, y: 31, inside: ["centre4", "arene3", "maison4"] },
  { map: "route7", label: "Route 7", short: "R7", kind: "route", biome: "neige", x: 86, y: 23 },
  { map: "route8", label: "Route 8", short: "R8", kind: "route", biome: "montagne", x: 74, y: 14 },
  {
    map: "ligue",
    label: "Plateau de la Ligue",
    short: "LIGUE",
    kind: "ville",
    biome: "montagne",
    x: 86, y: 6,
    inside: ["centre5", "ligue1", "ligue2", "ligue3", "ligue4", "ligue5"],
  },
];

/** Nœud de la carte où se trouve le joueur, intérieurs compris. */
export const regionNodeOf = (map: MapId): RegionNode | null =>
  REGION.find((node) => node.map === map || node.inside?.includes(map)) ?? null;

/* ------------------------------------------------ les Cars Faure */

export type BusStop = {
  map: MapId;
  label: string;
  /**
   * Insignes exigés pour descendre ici. Une ville et les routes qui y mènent
   * partagent les mêmes : sans l'insigne Roc, ni Mions ni ses deux routes ne
   * sont desservies. Le Plateau, lui, réclame les trois.
   */
  badges: string[];
  /** Où le car dépose : toujours le chemin, juste à côté de l'arrêt. */
  x: number;
  y: number;
};

/** Le réseau, du sud au nord. */
export const BUS_STOPS: BusStop[] = [
  { map: "bourg", label: "Renouet Bourg", badges: [], x: 10, y: 6 },
  { map: "route1", label: "Route 1", badges: [], x: 10, y: 8 },
  { map: "route2", label: "Route 2", badges: ["trio"], x: 10, y: 8 },
  { map: "route3", label: "Route 3", badges: ["trio"], x: 10, y: 4 },
  { map: "maillard", label: "Maillard", badges: ["trio"], x: 10, y: 5 },
  { map: "route4", label: "Route 4 — la hêtraie", badges: ["sylve"], x: 10, y: 4 },
  { map: "aigueperse", label: "Aigueperse", badges: ["sylve"], x: 10, y: 6 },
  { map: "route5", label: "Route 5 — les sables", badges: ["roc"], x: 10, y: 4 },
  { map: "route6", label: "Route 6 — la crête", badges: ["roc"], x: 10, y: 4 },
  { map: "mions", label: "Mions", badges: ["roc"], x: 10, y: 6 },
  { map: "route7", label: "Route 7 — le col blanc", badges: ["roc"], x: 10, y: 4 },
  { map: "route8", label: "Route 8 — la montée", badges: ["roc"], x: 10, y: 4 },
  {
    map: "ligue",
    label: "Plateau de la Ligue",
    badges: ["trio", "sylve", "roc"],
    x: 10,
    y: 6,
  },
];

export const busStopOf = (map: MapId) =>
  BUS_STOPS.find((stop) => stop.map === map) ?? null;

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

/**
 * Part des rencontres réservée à la faune locale de la carte. Le reste est
 * tiré dans tout le Pokédex national : on peut croiser n'importe laquelle des
 * six cent quarante-neuf premières espèces, légendaires exceptés.
 */
export const LOCAL_SHARE = 0.35;

/**
 * Tire une rencontre dans les hautes herbes. Les poids de la carte fixent
 * toujours la tranche de niveaux — une Route 1 reste une Route 1 — mais
 * l'espèce, elle, vient deux fois sur trois du Pokédex entier.
 */
export function rollEncounter(map: MapSpec): { id: number; level: number } | null {
  if (!map.encounters?.length) return null;
  const total = map.encounters.reduce((sum, e) => sum + e.weight, 0);
  let pick = Math.random() * total;
  for (const e of map.encounters) {
    pick -= e.weight;
    if (pick <= 0) {
      const id =
        Math.random() < LOCAL_SHARE
          ? e.id
          : WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)];
      return {
        id,
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
