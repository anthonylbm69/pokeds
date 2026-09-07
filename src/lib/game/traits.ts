/**
 * Ce qui distingue deux Pokémon de la même espèce : sa nature et son talent.
 *
 * Les vingt-cinq natures agissent toutes, chacune relevant une statistique
 * de dix pour cent et en rabaissant une autre d'autant. Les talents, eux,
 * sont cent dix-huit dans le Pokédex : ceux que le moteur sait appliquer
 * sont listés dans `ABILITIES`, les autres ne sont qu'affichés sur la fiche.
 */

import { ABILITY_FR, DEX } from "./dex";
import type { StatKey, TypeName } from "./data";
import type { Status } from "./battle";

/* -------------------------------------------------------------- natures */

export type Boostable = Exclude<StatKey, "hp">;

export type Nature = {
  name: string;
  /** Statistique relevée de dix pour cent, et celle qui paie la note. */
  up: Boostable | null;
  down: Boostable | null;
};

export const NATURES: Nature[] = [
  { name: "Hardi", up: null, down: null },
  { name: "Solo", up: "atk", down: "def" },
  { name: "Brave", up: "atk", down: "spe" },
  { name: "Rigide", up: "atk", down: "spa" },
  { name: "Mauvais", up: "atk", down: "spd" },
  { name: "Assuré", up: "def", down: "atk" },
  { name: "Docile", up: null, down: null },
  { name: "Relax", up: "def", down: "spe" },
  { name: "Malin", up: "def", down: "spa" },
  { name: "Lâche", up: "def", down: "spd" },
  { name: "Pressé", up: "spe", down: "def" },
  { name: "Jovial", up: "spe", down: "spa" },
  { name: "Naïf", up: "spe", down: "spd" },
  { name: "Timide", up: "spe", down: "atk" },
  { name: "Sérieux", up: null, down: null },
  { name: "Modeste", up: "spa", down: "atk" },
  { name: "Doux", up: "spa", down: "def" },
  { name: "Discret", up: "spa", down: "spe" },
  { name: "Foufou", up: "spa", down: "spd" },
  { name: "Pudique", up: "spd", down: "atk" },
  { name: "Gentil", up: "spd", down: "def" },
  { name: "Prudent", up: "spd", down: "spa" },
  { name: "Bizarre", up: "spd", down: "spe" },
  { name: "Calme", up: null, down: null },
  { name: "Pugnace", up: null, down: null },
];

/** Multiplicateur d'une nature sur une statistique : 1,1 · 1 · 0,9. */
export function natureMult(nature: number, stat: Boostable): number {
  const n = NATURES[nature] ?? NATURES[0];
  if (n.up === stat && n.down !== stat) return 1.1;
  if (n.down === stat && n.up !== stat) return 0.9;
  return 1;
}

export const natureName = (nature: number) => (NATURES[nature] ?? NATURES[0]).name;

/* -------------------------------------------------------------- talents */

/**
 * Ce qu'un talent sait faire dans ce moteur. Un talent absent d'ici garde
 * son nom sur la fiche mais n'a aucun effet — mieux vaut l'avouer que de
 * faire semblant.
 */
export type Ability = {
  /** Empêche une altération de se poser. */
  blocks?: Status[];
  /** Multiplie les attaques de ce type quand les PV passent sous un tiers. */
  pinch?: TypeName;
  /** Rend insensible aux attaques de ce type. */
  immune?: TypeName;
  /** Pose une altération sur qui frappe au corps à corps. */
  contact?: { status: Status; chance: number };
  /** Baisse l'Attaque adverse d'un cran en entrant en scène. */
  intimidate?: true;
  /** Survit à un coup fatal avec un point de vie, depuis le maximum. */
  sturdy?: true;
  /** Multiplie l'Attaque quand le Pokémon souffre d'une altération. */
  guts?: true;
};

export const ABILITIES: Record<string, Ability> = {
  overgrow: { pinch: "grass" },
  blaze: { pinch: "fire" },
  torrent: { pinch: "water" },
  swarm: { pinch: "bug" },

  levitate: { immune: "ground" },

  static: { contact: { status: "paralysie", chance: 0.3 } },
  "flame-body": { contact: { status: "brulure", chance: 0.3 } },
  "poison-point": { contact: { status: "poison", chance: 0.3 } },

  intimidate: { intimidate: true },
  sturdy: { sturdy: true },
  guts: { guts: true },

  immunity: { blocks: ["poison"] },
  "water-veil": { blocks: ["brulure"] },
  limber: { blocks: ["paralysie"] },
  "magma-armor": { blocks: ["gel"] },
  insomnia: { blocks: ["sommeil"] },
  "vital-spirit": { blocks: ["sommeil"] },
};

/** Le talent d'une espèce, tel que relevé au Pokédex. */
export const abilityOf = (id: number): string | null => DEX[id]?.[6] ?? null;

/** Ce que ce talent sait faire ici — rien, le plus souvent. */
export const abilityRules = (id: number): Ability =>
  ABILITIES[abilityOf(id) ?? ""] ?? {};

/** Le nom français du talent, pour la fiche. */
export function abilityName(id: number): string {
  const brut = abilityOf(id);
  if (!brut) return "Aucun";
  return ABILITY_FR[brut] ?? brut;
}

/** Ce talent a-t-il un effet, ou n'est-il qu'une mention ? */
export const abilityWorks = (id: number) => Boolean(ABILITIES[abilityOf(id) ?? ""]);

/** Seuil sous lequel les talents « en difficulté » se déclenchent. */
export const PINCH = 1 / 3;
