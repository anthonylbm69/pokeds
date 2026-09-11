/**
 * Le sac : ce qu'il contient, ce que chaque objet sait faire et ce qu'il
 * coûte. Les prix et les effets sont ceux d'Unys.
 */

import { maxHp, type Mon } from "./battle";
import { MOVES, type MoveId } from "./data";

export type ItemId =
  | "ball"
  | "superball"
  | "hyperball"
  | "potion"
  | "superpotion"
  | "hyperpotion"
  | "rappel"
  | "totalsoin"
  | "masterball"
  | "restes"
  | "ceinture"
  | "baie-oran"
  | "roche-royale"
  | "lunettes"
  | "huile"
  | "elixir"
  | `ct-${MoveId}`;

export type ItemKind = "ball" | "soin" | "rappel" | "statut" | "ct" | "tenu" | "pp";

export type Item = {
  name: string;
  price: number;
  kind: ItemKind;
  /** Multiplicateur de capture, pour une Ball. */
  bonus?: number;
  /** PV rendus, pour un soin. */
  heal?: number;
  /** Part des PV maximum rendus à la réanimation. */
  share?: number;
  /** Attaque enseignée, pour une Capsule Technique. */
  teaches?: MoveId;
  /** Ce que l'objet fait quand un Pokémon le porte. */
  hold?: Hold;
  /** PP rendus. `toutes` sert tout le répertoire d'un coup. */
  pp?: { amount: number; toutes?: true };
};

/**
 * L'effet d'un objet tenu. Chaque champ est indépendant : un objet peut
 * régénérer et amortir à la fois, si on l'écrit ainsi.
 */
export type Hold = {
  /** Part des PV maximum rendue à la fin de chaque tour. */
  regen?: number;
  /** Multiplie les dégâts que le porteur inflige. */
  power?: number;
  /** Divise les dégâts que le porteur encaisse. */
  guard?: number;
  /** Rend des PV quand les siens tombent sous `below`, une seule fois. */
  berry?: { below: number; heal: number };
  /** Le porteur frappe toujours en premier à priorité égale. */
  quick?: true;
};

/**
 * Les Capsules Techniques. Le jeu n'a jamais laissé choisir une attaque :
 * elles s'écrasaient toutes seules à la montée de niveau. Une CT permet
 * enfin d'en enseigner une, et de décider laquelle sacrifier.
 *
 * Le catalogue est celui des attaques marquantes, pas des coups de départ.
 */
export const CT_MOVES: MoveId[] = [
  "plaquage",
  "lance-flammes",
  "hydrocanon",
  "lame-feuille",
  "tonnerre-eclair",
  "psyko",
  "blizzard",
  "colere",
  "dark-lariat",
  "megasabot",
  "eboulement",
  "ultimapoing",
  "dard-nuee",
  "eclat-magique",
  "tete-de-fer",
  "direct-toxik",
  "griffe-ombre",
  "aeropique",
  "danse-lames",
  "hate",
  "cage-eclair",
  "toxik",
  "poudre-dodo",
  "feu-follet",
];

/** L'identifiant d'objet d'une CT, et l'attaque qu'elle porte. */
export const ctId = (move: MoveId): ItemId => `ct-${move}` as ItemId;
export const ctMove = (id: ItemId): MoveId | null =>
  id.startsWith("ct-") ? (id.slice(3) as MoveId) : null;

/** Prix d'une CT : proportionnel à ce qu'elle apporte. */
const ctPrice = (move: MoveId) =>
  Math.max(1500, Math.round((MOVES[move].power || 60) * 40));

const CT_ITEMS = Object.fromEntries(
  CT_MOVES.map((move) => [
    ctId(move),
    {
      name: `CT · ${MOVES[move].name}`,
      price: ctPrice(move),
      kind: "ct" as const,
      teaches: move,
    },
  ]),
) as Record<ItemId, Item>;

export const ITEMS: Record<ItemId, Item> = {
  ...CT_ITEMS,
  ball: { name: "Poké Ball", price: 200, kind: "ball", bonus: 1 },
  superball: { name: "Super Ball", price: 600, kind: "ball", bonus: 1.5 },
  hyperball: { name: "Hyper Ball", price: 1200, kind: "ball", bonus: 2 },
  potion: { name: "Potion", price: 300, kind: "soin", heal: 20 },
  superpotion: { name: "Super Potion", price: 700, kind: "soin", heal: 50 },
  hyperpotion: { name: "Hyper Potion", price: 1200, kind: "soin", heal: 200 },
  rappel: { name: "Rappel", price: 1500, kind: "rappel", share: 0.5 },
  totalsoin: { name: "Total Soin", price: 600, kind: "statut" },
  // Ne se vend pas : le Professeur la remet pour un Pokédex bien rempli.
  masterball: { name: "Master Ball", price: 0, kind: "ball", bonus: 255 },

  // Les objets à tenir. Ils ne s'utilisent pas : on les confie.
  restes: {
    name: "Restes",
    price: 2500,
    kind: "tenu",
    hold: { regen: 1 / 16 },
  },
  ceinture: {
    name: "Ceinture Force",
    price: 2000,
    kind: "tenu",
    hold: { power: 1.2 },
  },
  "baie-oran": {
    name: "Baie Oran",
    price: 400,
    kind: "tenu",
    hold: { berry: { below: 0.5, heal: 30 } },
  },
  "roche-royale": {
    name: "Roche Royale",
    price: 2200,
    kind: "tenu",
    hold: { guard: 1.2 },
  },
  lunettes: {
    name: "Lunettes Choix",
    price: 3000,
    kind: "tenu",
    hold: { power: 1.5, quick: true },
  },

  // Les PP ne se rendaient qu'au Centre : de quoi tenir loin de la ville.
  huile: { name: "Huile", price: 1200, kind: "pp", pp: { amount: 10 } },
  elixir: { name: "Élixir", price: 3000, kind: "pp", pp: { amount: 10, toutes: true } },
};

/** L'ordre des rayons et du sac : du plus courant au plus rare. */
/** Ce que la boutique tient en rayon : tout, sauf ce qui ne s'achète pas. */
export const SHOP_STOCK: ItemId[] = [];

export const ITEM_ORDER: ItemId[] = [
  "ball",
  "superball",
  "hyperball",
  "potion",
  "superpotion",
  "hyperpotion",
  "rappel",
  "totalsoin",
  "masterball",
  "restes",
  "ceinture",
  "baie-oran",
  "roche-royale",
  "lunettes",
  "huile",
  "elixir",
  // Les Capsules ferment la marche : elles sont nombreuses et rares.
  ...CT_MOVES.map(ctId),
];

// Rempli une fois la liste connue : seuls les objets à prix non nul.
SHOP_STOCK.push(...ITEM_ORDER.filter((id) => ITEMS[id].price > 0));

export type Bag = Record<ItemId, number>;

export const emptyBag = (): Bag => ({
  ball: 0, superball: 0, hyperball: 0,
  potion: 0, superpotion: 0, hyperpotion: 0, rappel: 0, totalsoin: 0,
  masterball: 0,
  restes: 0, ceinture: 0, "baie-oran": 0, "roche-royale": 0, lunettes: 0,
  huile: 0, elixir: 0,
  ...Object.fromEntries(CT_MOVES.map((m) => [ctId(m), 0])),
} as Bag);

/** Un sac neuf : de quoi tenir jusqu'à la première boutique. */
export const startingBag = (): Bag => ({ ...emptyBag(), ball: 5, potion: 3 });

/**
 * Remet un sac d'aplomb : une sauvegarde d'avant les nouveaux objets ne
 * connaissait que deux compteurs, `balls` et `potions`.
 */
export function normaliseBag(
  bag: Partial<Bag> | undefined,
  balls?: number,
  potions?: number,
): Bag {
  const out = emptyBag();
  for (const id of ITEM_ORDER) out[id] = Math.max(0, Math.floor(bag?.[id] ?? 0));
  if (!bag) {
    out.ball = Math.max(0, Math.floor(balls ?? 0));
    out.potion = Math.max(0, Math.floor(potions ?? 0));
  }
  return out;
}

export const countOf = (bag: Bag, id: ItemId) => bag[id] ?? 0;

/** Retire un exemplaire, sans jamais descendre sous zéro. */
export const spend = (bag: Bag, id: ItemId): Bag => ({
  ...bag,
  [id]: Math.max(0, countOf(bag, id) - 1),
});

export const add = (bag: Bag, id: ItemId, n = 1): Bag => ({
  ...bag,
  [id]: countOf(bag, id) + n,
});

/**
 * Ce qu'un objet ferait au Pokémon visé, sans rien modifier : les PV rendus
 * et, s'il ne sert à rien, le motif du refus. Un seul endroit décide, pour
 * que le combat et le sac ne divergent pas.
 */
export function effectOn(
  item: ItemId,
  mon: Mon | undefined,
): { healed: number; refus: string | null } {
  const data = ITEMS[item];
  if (!mon) return { healed: 0, refus: "Aucun Pokémon à soigner." };

  const max = maxHp(mon);
  if (data.kind === "ct" || data.kind === "tenu") return { healed: 0, refus: null };
  if (data.kind === "pp") return { healed: 0, refus: ppEffectOn(item, mon).refus };
  if (data.kind === "statut") {
    if (!mon.status) return { healed: 0, refus: `${mon.name} se porte très bien.` };
    return { healed: 0, refus: null };
  }
  if (data.kind === "rappel") {
    if (mon.hp > 0) return { healed: 0, refus: `${mon.name} tient encore debout !` };
    return { healed: Math.max(1, Math.floor(max * (data.share ?? 0.5))), refus: null };
  }
  if (data.kind === "soin") {
    if (mon.hp <= 0) return { healed: 0, refus: `${mon.name} est K.O. : il lui faut un Rappel.` };
    if (mon.hp >= max) return { healed: 0, refus: `${mon.name} a déjà tous ses PV !` };
    return { healed: Math.min(data.heal ?? 0, max - mon.hp), refus: null };
  }
  return { healed: 0, refus: "Cet objet ne se lance que sur un Pokémon sauvage." };
}

/** Un objet qui se pose sur un Pokémon de l'équipe demande une cible. */
export const needsTarget = (item: ItemId) =>
  ITEMS[item].kind !== "ball" && ITEMS[item].kind !== "ct";

/** Un objet de PP vise une attaque, ou tout le répertoire. */
export const isPP = (item: ItemId) => ITEMS[item].kind === "pp";

/**
 * Ce qu'un objet de PP rendrait à ce Pokémon, et le motif du refus quand il
 * n'a rien à rendre. `move` est le rang de l'attaque visée ; il est ignoré
 * par un Élixir, qui sert tout le monde.
 */
export function ppEffectOn(
  item: ItemId,
  mon: Mon | undefined,
  move = 0,
): { refus: string | null } {
  const regle = ITEMS[item].pp;
  if (!regle) return { refus: "Cet objet ne rend pas de PP." };
  if (!mon) return { refus: "Aucun Pokémon à qui le donner." };

  const vises = regle.toutes ? mon.moves : mon.moves.slice(move, move + 1);
  if (!vises.length) return { refus: "Aucune attaque à recharger." };
  if (vises.every((m) => m.pp >= m.max)) {
    return {
      refus: regle.toutes
        ? `${mon.name} a déjà tous ses PP.`
        : "Cette attaque a déjà tous ses PP.",
    };
  }
  return { refus: null };
}

/** Applique l'objet : renvoie le répertoire rechargé. */
export function refillPP(item: ItemId, mon: Mon, move = 0): Mon["moves"] {
  const regle = ITEMS[item].pp;
  if (!regle) return mon.moves;
  return mon.moves.map((m, i) =>
    regle.toutes || i === move
      ? { ...m, pp: Math.min(m.max, m.pp + regle.amount) }
      : m,
  );
}

/** Une CT s'enseigne hors combat, et seulement là. */
export const isCT = (item: ItemId) => ITEMS[item].kind === "ct";

/** Un objet tenu se confie, il ne s'emploie pas. */
export const isHeld = (item: ItemId) => ITEMS[item].kind === "tenu";

/** Ce que l'objet porté par ce Pokémon sait faire — rien s'il n'en porte pas. */
export const holdRules = (held: ItemId | null | undefined): Hold =>
  (held && ITEMS[held]?.hold) || {};
