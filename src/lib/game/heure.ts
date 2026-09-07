/**
 * L'heure du jeu, calquée sur celle du joueur. La nuit change la teinte du
 * décor et la faune des hautes herbes : ce que l'on croise à minuit n'est
 * pas ce que l'on croise à midi.
 */

import { DEX, WILD_POOL } from "./dex";

export type Moment = "jour" | "soir" | "nuit";

/** Le moment de la journée, à l'heure de la machine. */
export function momentAt(heure: number): Moment {
  if (heure >= 6 && heure < 18) return "jour";
  if (heure >= 18 && heure < 21) return "soir";
  return "nuit";
}

export const momentNow = (now = new Date()): Moment => momentAt(now.getHours());

export const MOMENT_FR: Record<Moment, string> = {
  jour: "Jour",
  soir: "Crépuscule",
  nuit: "Nuit",
};

/**
 * Le voile posé sur le décor. Le jour n'en a pas ; le soir tire vers
 * l'orange, la nuit vers le bleu profond.
 */
export const TINT: Record<Moment, { color: string; alpha: number }> = {
  jour: { color: "#000000", alpha: 0 },
  soir: { color: "#8a4a20", alpha: 0.18 },
  nuit: { color: "#101d3a", alpha: 0.38 },
};

/**
 * Les types que la nuit fait sortir. Le reste dort : de nuit, une rencontre
 * sur deux vient de ce vivier plutôt que du Pokédex entier.
 */
const TYPES_NOCTURNES = ["ghost", "dark", "poison", "bug"];

export const NIGHT_POOL: number[] = WILD_POOL.filter((id) =>
  DEX[id][2].some((t) => TYPES_NOCTURNES.includes(t)),
);

/** Part des rencontres nocturnes réservée aux espèces de la nuit. */
export const NIGHT_SHARE = 0.5;

/**
 * Corrige une rencontre selon l'heure. De jour, rien ne change ; de nuit,
 * une fois sur deux, c'est une créature nocturne qui se présente.
 */
export function atNight(id: number, moment: Moment, roll = Math.random()): number {
  if (moment !== "nuit" || !NIGHT_POOL.length) return id;
  if (roll >= NIGHT_SHARE) return id;
  return NIGHT_POOL[Math.floor(roll * (1 / NIGHT_SHARE) * NIGHT_POOL.length) % NIGHT_POOL.length];
}
