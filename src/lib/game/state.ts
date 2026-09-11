/**
 * L'état de la partie et sa sauvegarde. Tout tient dans un objet sérialisable
 * pour que `localStorage` suffise.
 */

import { MOVES, species, typedMoveset, type MoveId, type TypeName } from "./data";
import { STATUS_FR, createMon, healMon, maxHp, type Mon } from "./battle";
import {
  ITEMS,
  countOf,
  ctMove,
  effectOn,
  normaliseBag,
  ppEffectOn,
  refillPP,
  spend,
  startingBag,
  type Bag,
  type ItemId,
} from "./items";
import { emptyDaycare, type Daycare, type Egg } from "./elevage";
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
  bag: Bag;
  /**
   * Anciens compteurs, gardés pour relire une sauvegarde d'avant le sac.
   * Rien ne les écrit plus.
   */
  balls?: number;
  potions?: number;
  money: number;
  /** Vélo acheté chez Cycles Maillard, et selle occupée ou non. */
  bike: boolean;
  riding: boolean;
  /** Musique de fond activée. */
  music: boolean;
  /** Le Pokémon de tête marche derrière le joueur. */
  follower: boolean;
  /** Sur l'eau : le joueur avance à dos de Pokémon. */
  surfing: boolean;
  /** Comment la boîte du PC est rangée à l'affichage. */
  boxOrder: BoxOrder;
  /** Secondes de jeu accumulées, pour la carte de Dresseur. */
  played: number;
  /** Duels remportés, toutes catégories confondues. */
  wins: number;
  /** Les sacres inscrits au Panthéon, du plus ancien au plus récent. */
  hall: HallEntry[];
  /** Ce que la Pension garde pour vous. */
  daycare: Daycare;
  /** Les œufs que l'on porte, et qui éclosent en marchant. */
  eggs: Egg[];
  /** Meilleure série à la Tour de Combat, et série en cours. */
  towerBest: number;
  towerRun: number;
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

/**
 * Deux emplacements de sauvegarde. Le premier garde la clé historique, pour
 * qu'une partie déjà commencée se retrouve exactement là où elle était.
 */
export const SLOTS = [1, 2] as const;
export type Slot = (typeof SLOTS)[number];

const SAVE_KEY = "pokeds:partie";
const slotKey = (slot: Slot) => (slot === 1 ? SAVE_KEY : `${SAVE_KEY}:${slot}`);

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
    bag: startingBag(),
    money: 3000,
    bike: false,
    riding: false,
    music: true,
    follower: true,
    surfing: false,
    boxOrder: "arrivee",
    played: 0,
    wins: 0,
    hall: [],
    daycare: emptyDaycare(),
    eggs: [],
    towerBest: 0,
    towerRun: 0,
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

/**
 * Ce que raconte le Pokémon qui marche derrière soi quand on lui parle. Son
 * humeur tient à son état : blessé, altéré, ou simplement content d'être là.
 * Le type donne la couleur de la réplique.
 */
export function followerLine(mon: Mon): string[] {
  const ratio = mon.hp / maxHp(mon);

  if (mon.hp <= 0) {
    return [
      `${mon.name} est hors de combat et ne bronche pas.`,
      "Un passage au Centre Pokémon lui ferait le plus grand bien.",
    ];
  }
  if (mon.status) {
    return [
      `${mon.name} vous regarde, ${STATUS_FR[mon.status]}.`,
      "Il faudrait s'occuper de lui.",
    ];
  }
  if (ratio < 0.35) {
    return [
      `${mon.name} traîne la patte derrière vous.`,
      "Il tiendra encore un peu, mais pas beaucoup plus.",
    ];
  }

  const humeur = HUMEURS[species(mon.id).types[0]] ?? HUMEURS.normal;
  return [`${mon.name} ${humeur}`];
}

/** Une réplique par type : la même espèce dit toujours la même chose. */
const HUMEURS: Partial<Record<TypeName, string>> = {
  normal: "trottine gaiement à votre hauteur.",
  fire: "souffle un panache tiède et vous regarde, ravi.",
  water: "s'ébroue et vous éclabousse les chaussures.",
  grass: "s'étire vers le soleil avant de vous rattraper.",
  electric: "crépite doucement quand vous le caressez.",
  ice: "laisse derrière lui une trace de givre.",
  fighting: "frappe l'air deux fois, prêt au prochain duel.",
  poison: "renifle bruyamment quelque chose au sol.",
  ground: "gratte la terre du bout de la patte.",
  flying: "fait un tour en l'air et se repose près de vous.",
  psychic: "vous fixe, et vous avez l'étrange impression d'être compris.",
  bug: "s'agite dans tous les sens, infatigable.",
  rock: "avance sans se presser, imperturbable.",
  ghost: "disparaît une seconde, puis réapparaît en riant.",
  dragon: "gronde doucement, tout en fierté contenue.",
  dark: "vous observe du coin de l'œil, l'air de tout savoir.",
  steel: "cliquette à chaque pas sur le chemin.",
  fairy: "tourne autour de vous en pépiant.",
};

/**
 * L'insigne qui autorise le Surf. C'est celui de Mions, le troisième :
 * franchir l'eau ouvre des rives que l'on ne pouvait pas atteindre à pied.
 */
export const SURF_BADGE = "roc";

export const canSurf = (state: GameState) => hasFlag(state, `insigne:${SURF_BADGE}`);

/**
 * Enseigne l'attaque d'une Capsule au Pokémon désigné. `oubli` dit quelle
 * attaque céder la place quand les quatre emplacements sont pris ; il vaut
 * -1 quand il reste de la place.
 *
 * La Capsule se consomme, comme en Génération V — elle ne resservira pas.
 */
export function teachMove(
  state: GameState,
  item: ItemId,
  index: number,
  oubli: number,
): { state: GameState; message: string } {
  const move = ctMove(item);
  const mon = state.party[index];
  if (!move) return { state, message: "Ce n'est pas une Capsule." };
  if (countOf(state.bag, item) <= 0) {
    return { state, message: `Vous n'avez plus de ${ITEMS[item].name} !` };
  }
  if (!mon) return { state, message: "Aucun Pokémon à qui l'enseigner." };
  if (mon.moves.some((m) => m.id === move)) {
    return { state, message: `${mon.name} connaît déjà ${MOVES[move].name}.` };
  }

  const neuf = { id: move, pp: MOVES[move].pp, max: MOVES[move].pp };
  const complet = mon.moves.length >= 4;
  if (complet && (oubli < 0 || oubli >= mon.moves.length)) {
    return { state, message: "Il faut choisir une attaque à oublier." };
  }
  const oubliee = complet ? MOVES[mon.moves[oubli].id].name : null;
  const moves = complet
    ? mon.moves.map((m, i) => (i === oubli ? neuf : m))
    : [...mon.moves, neuf];

  return {
    state: {
      ...state,
      bag: spend(state.bag, item),
      party: state.party.map((m, i) => (i === index ? { ...m, moves } : m)),
    },
    message: oubliee
      ? `${mon.name} oublie ${oubliee} et apprend ${MOVES[move].name} !`
      : `${mon.name} apprend ${MOVES[move].name} !`,
  };
}

/**
 * Confie un objet à un Pokémon. Celui qu'il portait déjà retourne au sac :
 * rien ne se perd, contrairement aux jeux d'origine où l'on pouvait écraser.
 */
export function giveHeld(
  state: GameState,
  item: ItemId,
  index: number,
): { state: GameState; message: string } {
  const mon = state.party[index];
  if (!mon) return { state, message: "Aucun Pokémon à qui le confier." };
  if (countOf(state.bag, item) <= 0) {
    return { state, message: `Vous n'avez plus de ${ITEMS[item].name} !` };
  }
  if (mon.held === item) {
    return { state, message: `${mon.name} porte déjà ${ITEMS[item].name}.` };
  }

  const rendu = mon.held;
  const bag = { ...spend(state.bag, item) };
  if (rendu) bag[rendu] = countOf(bag, rendu) + 1;

  return {
    state: {
      ...state,
      bag,
      party: state.party.map((m, i) => (i === index ? { ...m, held: item } : m)),
    },
    message: rendu
      ? `${mon.name} rend ${ITEMS[rendu].name} et prend ${ITEMS[item].name}.`
      : `${mon.name} porte maintenant ${ITEMS[item].name}.`,
  };
}

/** Reprend l'objet d'un Pokémon et le remet au sac. */
export function takeHeld(
  state: GameState,
  index: number,
): { state: GameState; message: string } {
  const mon = state.party[index];
  if (!mon?.held) return { state, message: "Il ne porte rien." };
  const item = mon.held;
  return {
    state: {
      ...state,
      bag: { ...state.bag, [item]: countOf(state.bag, item) + 1 },
      party: state.party.map((m, i) => (i === index ? { ...m, held: null } : m)),
    },
    message: `${mon.name} rend ${ITEMS[item].name}.`,
  };
}

/* ------------------------------------------------------------ Panthéon */

/**
 * Un sacre : l'équipe telle qu'elle était le jour où elle a battu la Ligue.
 * On en garde une copie figée plutôt qu'une référence — ces Pokémon vont
 * continuer à évoluer, le souvenir, lui, ne doit pas bouger.
 */
export type HallEntry = {
  /** Date du sacre, au format ISO. */
  date: string;
  /** Temps de jeu à cet instant, en secondes. */
  played: number;
  badges: number;
  team: { id: number; name: string; level: number; shiny: boolean }[];
};

/** Inscrit l'équipe au Panthéon. Un même dresseur peut y revenir. */
export function enterHallOfFame(state: GameState): GameState {
  const entree: HallEntry = {
    date: new Date().toISOString(),
    played: state.played,
    badges: state.flags.filter((f) => f.startsWith("insigne:")).length,
    team: state.party.map((mon) => ({
      id: mon.id,
      name: mon.name,
      level: mon.level,
      shiny: mon.shiny,
    })),
  };
  return { ...state, hall: [...state.hall, entree] };
}

/** La date d'un sacre, écrite en toutes lettres. */
export function hallDate(entry: HallEntry): string {
  const quand = new Date(entry.date);
  if (Number.isNaN(quand.getTime())) return "date inconnue";
  return quand.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Le temps de jeu d'un sacre, en heures et minutes. */
export function hallTime(seconds: number): string {
  const heures = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${heures} h ${String(minutes).padStart(2, "0")}`;
}

/**
 * Recharge les PP d'un Pokémon de l'équipe. `move` est le rang de l'attaque
 * visée ; un Élixir sert tout le répertoire et l'ignore.
 */
export function applyPP(
  state: GameState,
  item: ItemId,
  index: number,
  move: number,
): { state: GameState; message: string } {
  if (countOf(state.bag, item) <= 0) {
    return { state, message: `Vous n'avez plus de ${ITEMS[item].name} !` };
  }
  const mon = state.party[index];
  const { refus } = ppEffectOn(item, mon, move);
  if (refus) return { state, message: refus };

  const moves = refillPP(item, mon, move);
  return {
    state: {
      ...state,
      bag: spend(state.bag, item),
      party: state.party.map((m, i) => (i === index ? { ...m, moves } : m)),
    },
    message: ITEMS[item].pp?.toutes
      ? `${mon.name} retrouve ses PP.`
      : `${MOVES[moves[move].id].name} retrouve des PP.`,
  };
}

/* -------------------------------------------------- Maître des Capacités */

/** Ce que coûte le réapprentissage d'une attaque oubliée. */
export const RELEARN_PRICE = 800;

/**
 * Les attaques que ce Pokémon pourrait connaître à son niveau et qu'il ne
 * connaît plus. Les espèces écrites à la main puisent dans leur
 * apprentissage ; les autres, dans le répertoire déduit de leurs types.
 */
export function relearnable(mon: Mon): MoveId[] {
  const kind = species(mon.id);
  const possibles = kind.learnset.length
    ? kind.learnset.filter((l) => l.level <= mon.level).map((l) => l.move)
    : typedMoveset(kind.types, mon.level);
  const connues = new Set(mon.moves.map((m) => m.id));
  return [...new Set(possibles)].filter((id) => !connues.has(id));
}

/**
 * Réapprend une attaque contre monnaie sonnante. `oubli` dit laquelle céder
 * quand les quatre emplacements sont pris ; il vaut -1 sinon.
 */
export function relearnMove(
  state: GameState,
  index: number,
  move: MoveId,
  oubli: number,
): { state: GameState; message: string } {
  const mon = state.party[index];
  if (!mon) return { state, message: "Aucun Pokémon." };
  if (state.money < RELEARN_PRICE) {
    return { state, message: "Vous n'avez pas de quoi me payer." };
  }
  if (!relearnable(mon).includes(move)) {
    return { state, message: `${mon.name} ne peut pas apprendre cela.` };
  }

  const neuf = { id: move, pp: MOVES[move].pp, max: MOVES[move].pp };
  const complet = mon.moves.length >= 4;
  if (complet && (oubli < 0 || oubli >= mon.moves.length)) {
    return { state, message: "Il faut choisir une attaque à oublier." };
  }
  const oubliee = complet ? MOVES[mon.moves[oubli].id].name : null;
  const moves = complet
    ? mon.moves.map((m, i) => (i === oubli ? neuf : m))
    : [...mon.moves, neuf];

  return {
    state: {
      ...state,
      money: state.money - RELEARN_PRICE,
      party: state.party.map((m, i) => (i === index ? { ...m, moves } : m)),
    },
    message: oubliee
      ? `${mon.name} oublie ${oubliee} et retrouve ${MOVES[move].name} !`
      : `${mon.name} retrouve ${MOVES[move].name} !`,
  };
}

/* ------------------------------------------------------- Tour de Combat */

/**
 * Les adversaires de la Tour montent avec la série : chaque victoire ajoute
 * un niveau et, tous les trois duels, un Pokémon de plus dans leur équipe.
 */
export const TOWER_BASE_LEVEL = 50;
export const TOWER_MAX_TEAM = 3;

export type TowerFoe = { name: string; level: number; team: number };

const TOWER_NAMES = [
  "Nadia", "Bruno", "Lise", "Karim", "Ines", "Mathis",
  "Sofia", "Yann", "Claire", "Ugo", "Nora", "Elias",
];

/** L'adversaire du duel numéro `run` — le premier duel porte le numéro zéro. */
export function towerFoe(run: number): TowerFoe {
  return {
    name: TOWER_NAMES[run % TOWER_NAMES.length],
    level: Math.min(100, TOWER_BASE_LEVEL + run),
    team: Math.min(TOWER_MAX_TEAM, 1 + Math.floor(run / 3)),
  };
}

/** Ce que rapporte une victoire à la Tour : de plus en plus. */
export const towerReward = (run: number) => 1000 + run * 500;

/** Enregistre une victoire à la Tour, et retient la meilleure série. */
export function towerWin(state: GameState): GameState {
  const towerRun = state.towerRun + 1;
  return {
    ...state,
    towerRun,
    towerBest: Math.max(state.towerBest, towerRun),
    wins: state.wins + 1,
    money: state.money + towerReward(state.towerRun),
  };
}

/** Une défaite remet la série à zéro ; le record, lui, reste acquis. */
export const towerLose = (state: GameState): GameState => ({ ...state, towerRun: 0 });

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

/** Les façons de ranger le PC. Le rang d'origine reste la valeur par défaut. */
export type BoxOrder = "arrivee" | "numero" | "niveau" | "nom";

export const BOX_ORDER_FR: Record<BoxOrder, string> = {
  arrivee: "ordre d'arrivée",
  numero: "numéro du Pokédex",
  niveau: "niveau, du plus fort",
  nom: "nom, de A à Z",
};

/**
 * Range la boîte pour l'affichage, sans jamais la modifier : les rangs
 * rendus pointent vers `state.box`, pour que retirer vise le bon Pokémon.
 */
export function sortedBox(box: Mon[], order: BoxOrder): number[] {
  const rangs = box.map((_, i) => i);
  if (order === "arrivee") return rangs;
  return rangs.sort((a, b) => {
    const x = box[a];
    const y = box[b];
    if (order === "numero") return x.id - y.id || x.name.localeCompare(y.name);
    if (order === "niveau") return y.level - x.level || x.name.localeCompare(y.name);
    return x.name.localeCompare(y.name);
  });
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
 * Pose un objet du sac sur un Pokémon de l'équipe, hors combat. Le nom évite
 * le préfixe `use`, que la règle des hooks de React prendrait pour un hook.
 * Renvoie l'état inchangé et le motif du refus quand l'objet est sans effet.
 */
export function applyItem(
  state: GameState,
  item: ItemId,
  index: number,
): { state: GameState; message: string } {
  if (countOf(state.bag, item) <= 0) {
    return { state, message: `Vous n'avez plus de ${ITEMS[item].name} !` };
  }
  const mon = state.party[index];
  const { healed, refus } = effectOn(item, mon);
  if (refus) return { state, message: refus };

  const releve = mon.hp <= 0;
  const soigne = ITEMS[item].kind === "statut";
  return {
    state: {
      ...state,
      bag: spend(state.bag, item),
      party: state.party.map((m, i) =>
        i === index
          ? { ...m, hp: m.hp + healed, ...(soigne ? { status: null, sleep: 0 } : {}) }
          : m,
      ),
    },
    message: soigne
      ? `${mon.name} n'a plus aucune altération.`
      : releve
        ? `${mon.name} reprend ses esprits et récupère ${healed} PV !`
        : `${mon.name} récupère ${healed} PV !`,
  };
}

export const markSeen = (state: GameState, id: number): GameState =>
  state.seen.includes(id) ? state : { ...state, seen: [...state.seen, id] };

/* ---------------------------------------------------------- sauvegarde */

/** Ce qui coiffe un fichier exporté : de quoi le reconnaître et le dater. */
export type SaveFile = {
  jeu: "pokeds";
  version: 1;
  exporte: string;
  partie: GameState;
};

/** Le contenu du fichier à télécharger, prêt à écrire. */
export function exportSave(state: GameState): string {
  const fichier: SaveFile = {
    jeu: "pokeds",
    version: 1,
    exporte: new Date().toISOString(),
    partie: state,
  };
  return JSON.stringify(fichier, null, 2);
}

/** Un nom de fichier qui dit de quelle partie il s'agit. */
export function exportName(state: GameState): string {
  const qui = (state.name || "dresseur").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const quand = new Date().toISOString().slice(0, 10);
  return `pokeds-${qui}-${quand}.json`;
}

/**
 * Relit un fichier exporté. Tout ce qui n'est pas une sauvegarde de ce jeu
 * est refusé plutôt que chargé à moitié.
 */
export function importSave(texte: string): { state: GameState } | { erreur: string } {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { erreur: "Ce fichier n'est pas lisible." };
  }
  const fichier = brut as Partial<SaveFile>;
  if (fichier?.jeu !== "pokeds" || !fichier.partie) {
    return { erreur: "Ce fichier ne vient pas de ce jeu." };
  }
  const state = reviveGame(fichier.partie);
  if (!state) return { erreur: "Cette sauvegarde est abîmée." };
  return { state };
}

export function saveGame(state: GameState, slot: Slot = 1): void {
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(state));
  } catch {
    // Navigation privée ou quota plein : la partie continue en mémoire.
  }
}

/** Efface un emplacement, sans toucher aux autres. */
export function clearSlot(slot: Slot): void {
  try {
    localStorage.removeItem(slotKey(slot));
  } catch {
    // Rien à faire : il n'y avait rien à effacer.
  }
}

/**
 * Ce qu'un emplacement contient, en une ligne, sans le charger vraiment :
 * de quoi remplir un menu de sélection.
 */
export type SlotInfo = {
  slot: Slot;
  name: string;
  badges: number;
  party: number;
  caught: number;
  map: string;
} | null;

export function slotInfo(slot: Slot): SlotInfo {
  const state = loadGame(slot);
  if (!state) return null;
  return {
    slot,
    name: state.name || "Sans nom",
    badges: state.flags.filter((f) => f.startsWith("insigne:")).length,
    party: state.party.length,
    caught: state.caught.length,
    map: state.map,
  };
}

export function loadGame(slot: Slot = 1): GameState | null {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    return reviveGame(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Remet un Pokémon d'aplomb : une partie plus ancienne ignore les champs
 * ajoutés depuis, et un fichier bricolé ne doit pas dépasser les PV maximum.
 */
function reviveMon(mon: Mon): Mon {
  const remis: Mon = {
    ...mon,
    shiny: mon.shiny ?? false,
    status: mon.status ?? null,
    sleep: mon.sleep ?? 0,
    // La confusion ne sort jamais du combat.
    confusion: 0,
    // Une partie d'avant les natures reçoit la neutre : rien ne change pour
    // un Pokémon déjà élevé.
    nature: mon.nature ?? 0,
    held: mon.held ?? null,
    hp: 0,
  };
  remis.hp = Math.max(0, Math.min(mon.hp, maxHp(remis)));
  return remis;
}

/**
 * Remet une sauvegarde d'aplomb : une partie plus ancienne ignore les champs
 * ajoutés depuis, et un fichier bricolé à la main ne doit pas passer.
 * Renvoie `null` si ce n'est pas une sauvegarde de ce jeu.
 */
export function reviveGame(brut: unknown): GameState | null {
  try {
    const data = brut as GameState;
    if (data?.version !== 1 || !Array.isArray(data.party)) return null;
    // Une sauvegarde éditée à la main ne doit pas dépasser les PV maximum, et
    // une partie plus ancienne ignore les champs ajoutés depuis.
    return {
      ...data,
      bike: data.bike ?? false,
      riding: false,
      music: data.music ?? true,
      // Une partie d'avant les Super Ball ne connaissait que deux compteurs.
      bag: normaliseBag(data.bag, data.balls, data.potions),
      balls: undefined,
      potions: undefined,
      follower: data.follower ?? true,
      // On ne reprend jamais une partie au milieu de l'eau.
      surfing: false,
      boxOrder: data.boxOrder ?? "arrivee",
      played: data.played ?? 0,
      wins: data.wins ?? 0,
      // Un sacre bricolé à la main ne doit pas casser l'écran : on ne garde
      // que les entrées qui ont bien une équipe.
      hall: (data.hall ?? []).filter((e) => Array.isArray(e?.team)),
      daycare: {
        ...emptyDaycare(),
        ...data.daycare,
        mons: (data.daycare?.mons ?? []).map(reviveMon),
        // Un œuf en attente se vérifie comme ceux qu'on porte.
        ready:
          typeof data.daycare?.ready?.id === "number" ? data.daycare.ready : null,
      },
      eggs: (data.eggs ?? []).filter((e) => typeof e?.id === "number"),
      towerBest: data.towerBest ?? 0,
      // Une série en cours ne survit pas à un rechargement : on repart de zéro.
      towerRun: 0,
      box: (data.box ?? []).map(reviveMon),
      starter: data.starter ?? data.party[0]?.id,
      party: data.party.map(reviveMon),
    };
  } catch {
    return null;
  }
}

export function hasSave(slot: Slot = 1): boolean {
  try {
    return localStorage.getItem(slotKey(slot)) !== null;
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
