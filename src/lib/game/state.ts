/**
 * L'état de la partie et sa sauvegarde. Tout tient dans un objet sérialisable
 * pour que `localStorage` suffise.
 */

import { MOVES, type MoveId } from "./data";
import { POTION_HEAL, createMon, healMon, maxHp, type Mon } from "./battle";
import type { Dir, MapId } from "./world";

export type GameState = {
  version: 1;
  name: string;
  map: MapId;
  x: number;
  y: number;
  dir: Dir;
  party: Mon[];
  /** Le PC des Centres : ce que l'équipe ne peut pas porter. */
  box: Mon[];
  balls: number;
  potions: number;
  money: number;
  /** Vélo acheté chez Cycles Maillard, et selle occupée ou non. */
  bike: boolean;
  riding: boolean;
  /** Musique de fond activée. */
  music: boolean;
  /** Le Pokémon de tête marche derrière le joueur. */
  follower: boolean;
  /** Starter reçu : l'Arène s'en sert pour composer son équipe. */
  starter?: number;
  /** Événements franchis : starter reçu, dresseurs battus… */
  flags: string[];
  /** Le Pokédex de la partie, distinct de celui de la console. */
  seen: number[];
  caught: number[];
  /** Dernier Centre Pokémon visité : point de réapparition après un K.O. */
  respawn: { map: MapId; x: number; y: number };
};

export const STARTERS = [495, 498, 501];

/** Le starter qui met celui du joueur en difficulté : Plante ← Feu ← Eau ← Plante. */
export function counterStarter(starter: number | undefined): number {
  if (starter === 495) return 498;
  if (starter === 498) return 501;
  return 495;
}

export const BIKE_PRICE = 2000;

/* --------------------------------------------------------- la dream team */

/**
 * L'équipe du code de triche : six niveau 50 aux IV parfaits, choisis pour
 * couvrir un maximum de types en duel. Chacun garde au moins une attaque de
 * son propre type, et l'ensemble couvre Dragon, Vol, Feu, Électrik, Roche,
 * Ténèbres, Sol, Combat, Insecte, Eau et Normal.
 */
const DREAM: { id: number; moves: MoveId[] }[] = [
  { id: 384, moves: ["draco-souffle", "coupe-vent", "jet-pierres", "plaquage"] },
  { id: 643, moves: ["lance-flammes", "draco-souffle", "coupe-vent", "plaquage"] },
  { id: 644, moves: ["eclair", "draco-souffle", "morsure", "plaquage"] },
  { id: 248, moves: ["jet-pierres", "vibrobscur", "tunnel", "plaquage"] },
  { id: 448, moves: ["balayage", "tunnel", "piqure", "vive-attaque"] },
  { id: 130, moves: ["coquille-lame", "morsure", "jet-pierres", "plaquage"] },
];

export const DREAM_LEVEL = 50;

/** Fabrique l'équipe de rêve, PV pleins et PP au maximum. */
export function dreamTeam(): Mon[] {
  return DREAM.map(({ id, moves }) => {
    const mon = createMon(id, DREAM_LEVEL);
    mon.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    mon.moves = moves.map((move) => ({
      id: move,
      pp: MOVES[move].pp,
      max: MOVES[move].pp,
    }));
    mon.hp = maxHp(mon);
    return mon;
  });
}

/** Remplace l'équipe et inscrit les nouveaux venus au Pokédex. */
export function withDreamTeam(state: GameState): GameState {
  const party = dreamTeam();
  const ids = party.map((mon) => mon.id);
  return {
    ...state,
    party,
    seen: [...new Set([...state.seen, ...ids])],
    caught: [...new Set([...state.caught, ...ids])],
  };
}

const SAVE_KEY = "pokeds:partie";

export function newGame(name: string): GameState {
  return {
    version: 1,
    name,
    map: "bourg",
    x: 6,
    y: 6,
    dir: "down",
    party: [],
    box: [],
    balls: 5,
    potions: 3,
    money: 3000,
    bike: false,
    riding: false,
    music: true,
    follower: true,
    flags: [],
    seen: [],
    caught: [],
    respawn: { map: "bourg", x: 6, y: 6 },
  };
}

export function giveStarter(state: GameState, id: number): GameState {
  const mon = createMon(id, 5);
  return {
    ...state,
    party: [mon],
    starter: id,
    flags: [...state.flags, "starter"],
    seen: [...new Set([...state.seen, id])],
    caught: [...new Set([...state.caught, id])],
  };
}

export const hasFlag = (state: GameState, flag: string) => state.flags.includes(flag);

export const withFlag = (state: GameState, flag: string): GameState =>
  hasFlag(state, flag) ? state : { ...state, flags: [...state.flags, flag] };

export const healParty = (state: GameState): GameState => ({
  ...state,
  party: state.party.map(healMon),
});

/** Ce que l'on peut garder sur soi ; le reste attend au PC. */
export const PARTY_MAX = 6;

export const addCaught = (state: GameState, mon: Mon): GameState => ({
  ...state,
  ...(state.party.length < PARTY_MAX
    ? { party: [...state.party, mon] }
    : { box: [...state.box, healMon(mon)] }),
  caught: [...new Set([...state.caught, mon.id])],
  seen: [...new Set([...state.seen, mon.id])],
});

/* -------------------------------------------------------------------- PC */

/**
 * Le PC ne garde que des Pokémon en pleine forme : y déposer un blessé le
 * soigne. On ne peut pas s'y vider les poches — il faut rester avec au moins
 * un Pokémon pour sortir du Centre.
 */
export function depositMon(state: GameState, index: number): GameState {
  const mon = state.party[index];
  if (!mon || state.party.length <= 1) return state;
  return {
    ...state,
    party: state.party.filter((_, i) => i !== index),
    box: [...state.box, healMon(mon)],
  };
}

/** Reprend un Pokémon au PC, si l'équipe a encore de la place. */
export function withdrawMon(state: GameState, index: number): GameState {
  const mon = state.box[index];
  if (!mon || state.party.length >= PARTY_MAX) return state;
  return {
    ...state,
    party: [...state.party, mon],
    box: state.box.filter((_, i) => i !== index),
  };
}

/**
 * Met un Pokémon en tête d'équipe : c'est lui qui ouvre les combats et qui
 * marche derrière le joueur.
 */
export function leadMon(state: GameState, index: number): GameState {
  const mon = state.party[index];
  if (!mon || index === 0) return state;
  return { ...state, party: [mon, ...state.party.filter((_, i) => i !== index)] };
}

/**
 * Soigne un Pokémon de l'équipe avec une Potion, hors combat. Le nom évite le
 * préfixe `use`, que la règle des hooks de React prendrait pour un hook.
 * Renvoie l'état inchangé et le motif du refus quand le soin est sans objet.
 */
export function applyPotion(
  state: GameState,
  index: number,
): { state: GameState; message: string } {
  const mon = state.party[index];
  if (!mon) return { state, message: "Aucun Pokémon à soigner." };
  if (state.potions <= 0) return { state, message: "Vous n'avez plus de Potion !" };
  const max = maxHp(mon);
  if (mon.hp >= max) return { state, message: `${mon.name} a déjà tous ses PV !` };

  const healed = Math.min(POTION_HEAL, max - mon.hp);
  return {
    state: {
      ...state,
      potions: state.potions - 1,
      party: state.party.map((m, i) => (i === index ? { ...m, hp: m.hp + healed } : m)),
    },
    message: `${mon.name} récupère ${healed} PV !`,
  };
}

export const markSeen = (state: GameState, id: number): GameState =>
  state.seen.includes(id) ? state : { ...state, seen: [...state.seen, id] };

/* ---------------------------------------------------------- sauvegarde */

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Navigation privée ou quota plein : la partie continue en mémoire.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    if (data?.version !== 1 || !Array.isArray(data.party)) return null;
    // Une sauvegarde éditée à la main ne doit pas dépasser les PV maximum, et
    // une partie plus ancienne ignore les champs ajoutés depuis.
    return {
      ...data,
      bike: data.bike ?? false,
      riding: false,
      music: data.music ?? true,
      follower: data.follower ?? true,
      box: (data.box ?? []).map((mon) => ({
        ...mon,
        shiny: mon.shiny ?? false,
        hp: Math.max(0, Math.min(mon.hp, maxHp(mon))),
      })),
      starter: data.starter ?? data.party[0]?.id,
      party: data.party.map((mon) => ({
        ...mon,
        shiny: mon.shiny ?? false,
        hp: Math.max(0, Math.min(mon.hp, maxHp(mon))),
      })),
    };
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // sans effet
  }
}
