/**
 * Le temps qu'il fait dehors. La météo existait déjà, mais seulement à
 * l'intérieur d'un duel, posée par une attaque : elle ne sortait jamais du
 * combat. Ici c'est l'inverse — le ciel appartient au lieu, et le combat qui
 * s'y ouvre commence sous ce ciel-là.
 *
 * Le tirage est stable : le même endroit, au même quart d'heure, donne
 * toujours le même temps. Rien n'est gardé en mémoire, rien ne clignote d'un
 * rendu à l'autre, et un test n'a qu'à passer l'heure qu'il veut.
 */

import type { Weather } from "./data";
import type { Biome, MapSpec } from "./world";

/** Un ciel, météo de combat ou simplement dégagé. */
export type Ciel = Weather | "beau";

/** Combien de temps le ciel tient avant de tourner. */
export const CIEL_MS = 15 * 60 * 1000;

/**
 * Ce que chaque biome peut donner. La répétition fait le poids : une plaine
 * est dégagée six fois sur dix.
 *
 * Le moteur ne connaît que la pluie, le soleil et le sable — il n'y a pas de
 * grêle. Une route enneigée reçoit donc de la pluie : c'est le plus proche
 * que ce jeu sache dire d'un ciel bouché.
 */
const CLIMATS: Record<Biome, Ciel[]> = {
  plaine: ["beau", "beau", "beau", "beau", "beau", "beau", "pluie", "pluie", "soleil", "soleil"],
  foret: ["beau", "beau", "beau", "beau", "beau", "pluie", "pluie", "pluie", "soleil", "beau"],
  desert: ["soleil", "soleil", "soleil", "soleil", "sable", "sable", "sable", "sable", "beau", "beau"],
  montagne: ["beau", "beau", "beau", "beau", "beau", "pluie", "pluie", "sable", "sable", "beau"],
  neige: ["beau", "beau", "beau", "beau", "pluie", "pluie", "pluie", "pluie", "beau", "beau"],
};

/**
 * Un tirage stable, sans mémoire : le nom du lieu et la tranche horaire
 * donnent un nombre entre zéro et un. C'est un FNV-1a, assez mélangeant pour
 * que deux routes voisines n'aient pas le même ciel.
 */
function graine(lieu: string, tranche: number): number {
  let h = 2166136261;
  for (let i = 0; i < lieu.length; i++) {
    h = Math.imul(h ^ lieu.charCodeAt(i), 16777619);
  }
  h = Math.imul(h ^ tranche, 16777619);
  h = Math.imul(h ^ (h >>> 13), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Le ciel d'une carte à un instant donné. Un intérieur est toujours dégagé. */
export function skyAt(map: MapSpec, lieu: string, now = Date.now()): Ciel {
  if (map.indoor) return "beau";
  const climat = CLIMATS[map.biome ?? "plaine"];
  const tirage = graine(lieu, Math.floor(now / CIEL_MS));
  return climat[Math.min(climat.length - 1, Math.floor(tirage * climat.length))];
}

/** Ce que le ciel installe en combat — rien, quand il est dégagé. */
export const weatherOf = (ciel: Ciel): Weather | undefined =>
  ciel === "beau" ? undefined : ciel;

export const CIEL_FR: Record<Ciel, string> = {
  beau: "Ciel dégagé",
  pluie: "Pluie",
  soleil: "Grand soleil",
  sable: "Vent de sable",
};

/** Le symbole posé à côté du lieu, dans les menus. */
export const CIEL_SIGNE: Record<Ciel, string> = {
  beau: "☀",
  pluie: "☂",
  soleil: "☼",
  sable: "≈",
};
