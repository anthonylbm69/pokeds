/**
 * La Pension et les œufs. On confie deux Pokémon, on repart marcher, et un
 * œuf finit par apparaître ; il éclôt au fil des pas.
 *
 * Une liberté par rapport aux jeux d'origine : l'œuf voyage à part, et non
 * dans l'équipe. Cela évite qu'un œuf se retrouve envoyé au combat, et
 * l'éclosion reste liée à la marche, ce qui est l'essentiel.
 */

import { EVOLUTIONS } from "./dex";
import { MOVES, species, type MoveId } from "./data";
import { createMon, type Mon } from "./battle";

/** Pas à parcourir avant qu'un œuf n'éclose. */
export const HATCH_STEPS = 320;

/** Pas à parcourir avant que la Pension ne propose un œuf. */
export const EGG_STEPS = 200;

/** Ce que la Pension garde, et ce qu'elle a préparé. */
export type Daycare = {
  /** Les deux pensionnaires, au plus. */
  mons: Mon[];
  /** Pas accumulés depuis le dernier œuf. */
  steps: number;
  /** Un œuf attend d'être récupéré. */
  ready: Egg | null;
};

export type Egg = {
  /** Espèce qui écloura. */
  id: number;
  /** Nature héritée d'un des parents. */
  nature: number;
  /** Attaques transmises, en plus de celles du niveau un. */
  moves: MoveId[];
  /** Pas restants avant l'éclosion. */
  steps: number;
};

export const emptyDaycare = (): Daycare => ({ mons: [], steps: 0, ready: null });

/** Deux Pokémon suffisent : au-delà, la Pension refuse. */
export const DAYCARE_MAX = 2;

/**
 * La forme de base d'une espèce : un œuf ne rend jamais une forme évoluée.
 * On remonte la chaîne d'évolution jusqu'à ne plus trouver de parent.
 */
export function baseForm(id: number): number {
  const parents = new Map<number, number>();
  for (const [depuis, [, vers]] of Object.entries(EVOLUTIONS)) {
    parents.set(vers, Number(depuis));
  }
  let courant = id;
  // Une chaîne est courte ; la borne évite une boucle si les données bouclent.
  for (let i = 0; i < 5; i++) {
    const parent = parents.get(courant);
    if (parent === undefined || parent === courant) break;
    courant = parent;
  }
  return courant;
}

/**
 * La Pension accepte-t-elle un couple ? Il faut deux pensionnaires, et deux
 * créatures distinctes. Faute de groupes d'œufs dans ce jeu, toute paire est
 * compatible — c'est plus permissif que les jeux d'origine, et assumé.
 */
export function canBreed(mons: Mon[]): boolean {
  if (mons.length < DAYCARE_MAX) return false;
  return mons[0].uid !== mons[1].uid;
}

/**
 * L'œuf que ce couple donnerait. L'espèce vient du premier pensionnaire,
 * ramenée à sa forme de base ; la nature de l'un des deux ; les attaques
 * sont celles que les deux parents ont en commun.
 */
export function makeEgg(mons: Mon[], roll = Math.random()): Egg | null {
  if (!canBreed(mons)) return null;
  const [a, b] = mons;

  const connuesDeB = new Set(b.moves.map((m) => m.id));
  const heritees = a.moves
    .map((m) => m.id)
    .filter((id) => connuesDeB.has(id))
    .slice(0, 4);

  return {
    id: baseForm(a.id),
    // Le petit tient sa nature de l'un ou l'autre, à pile ou face.
    nature: (roll < 0.5 ? a : b).nature ?? 0,
    moves: heritees,
    steps: HATCH_STEPS,
  };
}

/** Un pas de plus : la Pension avance vers son œuf. */
export function walkDaycare(care: Daycare): Daycare {
  if (care.ready || !canBreed(care.mons)) return care;
  const steps = care.steps + 1;
  if (steps < EGG_STEPS) return { ...care, steps };
  return { ...care, steps: 0, ready: makeEgg(care.mons) };
}

/** Un pas de plus : chaque œuf porté se rapproche de l'éclosion. */
export const walkEggs = (eggs: Egg[]): Egg[] =>
  eggs.map((egg) => ({ ...egg, steps: Math.max(0, egg.steps - 1) }));

/** Ce qui sort d'un œuf arrivé à terme : un Pokémon de niveau un. */
export function hatch(egg: Egg): Mon {
  const mon = createMon(egg.id, 1, undefined);
  mon.nature = egg.nature;

  // Les attaques héritées passent devant celles du niveau un, sans dépasser
  // les quatre emplacements.
  const deja = new Set(mon.moves.map((m) => m.id));
  const transmises = egg.moves
    .filter((id) => !deja.has(id) && MOVES[id])
    .map((id) => ({ id, pp: MOVES[id].pp, max: MOVES[id].pp }));
  mon.moves = [...transmises, ...mon.moves].slice(0, 4);

  return mon;
}

/** Combien de pas il reste, dit en clair. */
export const eggHint = (egg: Egg) =>
  egg.steps <= 0
    ? "il bouge !"
    : egg.steps < HATCH_STEPS / 4
      ? "il remue beaucoup"
      : egg.steps < HATCH_STEPS / 2
        ? "il bouge un peu"
        : "rien ne bouge encore";

/** Le nom de l'espèce qui dort dans l'œuf — que l'on ne montre jamais. */
export const eggSpecies = (egg: Egg) => species(egg.id).name;
