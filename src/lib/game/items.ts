/**
 * Le sac : ce qu'il contient, ce que chaque objet sait faire et ce qu'il
 * coûte. Les prix et les effets sont ceux d'Unys.
 */

import { maxHp, type Mon } from "./battle";

export type ItemId =
  | "ball"
  | "superball"
  | "hyperball"
  | "potion"
  | "superpotion"
  | "hyperpotion"
  | "rappel"
  | "totalsoin";

export type ItemKind = "ball" | "soin" | "rappel" | "statut";

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
};

export const ITEMS: Record<ItemId, Item> = {
  ball: { name: "Poké Ball", price: 200, kind: "ball", bonus: 1 },
  superball: { name: "Super Ball", price: 600, kind: "ball", bonus: 1.5 },
  hyperball: { name: "Hyper Ball", price: 1200, kind: "ball", bonus: 2 },
  potion: { name: "Potion", price: 300, kind: "soin", heal: 20 },
  superpotion: { name: "Super Potion", price: 700, kind: "soin", heal: 50 },
  hyperpotion: { name: "Hyper Potion", price: 1200, kind: "soin", heal: 200 },
  rappel: { name: "Rappel", price: 1500, kind: "rappel", share: 0.5 },
  totalsoin: { name: "Total Soin", price: 600, kind: "statut" },
};

/** L'ordre des rayons et du sac : du plus courant au plus rare. */
export const ITEM_ORDER: ItemId[] = [
  "ball",
  "superball",
  "hyperball",
  "potion",
  "superpotion",
  "hyperpotion",
  "rappel",
  "totalsoin",
];

export type Bag = Record<ItemId, number>;

export const emptyBag = (): Bag => ({
  ball: 0, superball: 0, hyperball: 0,
  potion: 0, superpotion: 0, hyperpotion: 0, rappel: 0, totalsoin: 0,
});

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
export const needsTarget = (item: ItemId) => ITEMS[item].kind !== "ball";
