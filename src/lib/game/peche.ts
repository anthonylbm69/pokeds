/**
 * La pêche. Trois cannes, de la plus modeste à la plus sérieuse : chacune
 * mord plus souvent et ramène plus gros. On lance face à l'eau, depuis la
 * berge ou depuis le dos de son Pokémon.
 *
 * Les prises viennent du même vivier que les rencontres en mer — tout ce qui
 * est de type Eau — mais la tranche de niveaux tient à la canne, pas au lieu :
 * une Super Canne rapporte autant sur la Route 3 qu'au large.
 */

import { ROD_SPECS, type RodId } from "./items";
import { WATER_POOL } from "./world";

export type Prise = { id: number; level: number };

/**
 * Un lancer. Rend la prise, ou `null` quand ça ne mord pas. Les trois tirages
 * sont passés à part pour que le test n'ait rien à deviner.
 */
export function castRod(
  rod: RodId,
  mord = Math.random(),
  espece = Math.random(),
  niveau = Math.random(),
): Prise | null {
  const spec = ROD_SPECS[rod];
  if (mord >= spec.bite) return null;
  const [min, max] = spec.levels;
  return {
    id: WATER_POOL[Math.floor(espece * WATER_POOL.length) % WATER_POOL.length],
    level: min + Math.floor(niveau * (max - min + 1)),
  };
}

/** La meilleure canne que l'on porte, s'il y en a une. */
export function bestRod(owned: (rod: RodId) => number): RodId | null {
  // `ROD_ORDER` va de la plus modeste à la plus sérieuse : on lit à l'envers.
  for (let i = ROD_ORDER.length - 1; i >= 0; i--) {
    if (owned(ROD_ORDER[i]) > 0) return ROD_ORDER[i];
  }
  return null;
}

/** Les cannes, de la plus modeste à la plus sérieuse. */
export const ROD_ORDER: RodId[] = ["canne", "bonne-canne", "super-canne"];

/** Ce que l'on dit en lançant, puis en attendant. */
export const CAST_LINES = (rod: RodId) => [
  `Vous lancez la ${ROD_SPECS[rod].name}…`,
];

export const NOTHING_LINE = "… Rien ne mord. L'eau reste lisse.";
