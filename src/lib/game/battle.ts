/**
 * Le moteur de combat : un tour complet est résolu d'un coup et renvoie la
 * liste des messages à afficher, comme le défilement de texte du jeu.
 * Les formules (dégâts, capture, expérience) sont celles de la Génération V.
 */

import {
  MAX_LEVEL,
  MOVES,
  effectiveness,
  computeStat,
  expForLevel,
  expGain,
  species,
  type MoveId,
  type StatKey,
  type TypeName,
} from "./data";

export type Mon = {
  uid: string;
  /** Numéro d'espèce. */
  id: number;
  name: string;
  level: number;
  exp: number;
  ivs: Record<StatKey, number>;
  hp: number;
  moves: { id: MoveId; pp: number; max: number }[];
  /** Chromatique : livrée rare, purement cosmétique. */
  shiny: boolean;
};

/**
 * Une chance sur cinq cent douze. Les jeux d'origine sont bien plus avares,
 * mais sur une partie de cette taille on ne croiserait jamais personne.
 */
export const SHINY_RATE = 1 / 512;

export type Stages = Record<Exclude<StatKey, "hp"> | "acc", number>;

const noStages = (): Stages => ({
  atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0,
});

const rand = () => Math.random();
const roll = (n: number) => Math.floor(rand() * n);

/* ------------------------------------------------------------- créatures */

let counter = 0;
const uid = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Les quatre dernières attaques apprises, comme un Pokémon sauvage. */
function movesAtLevel(id: number, level: number) {
  const known = species(id)
    .learnset.filter((l) => l.level <= level)
    .slice(-4);
  return known.map((l) => ({
    id: l.move,
    pp: MOVES[l.move].pp,
    max: MOVES[l.move].pp,
  }));
}

export function createMon(id: number, level: number, shiny?: boolean): Mon {
  const ivs: Record<StatKey, number> = {
    hp: roll(32), atk: roll(32), def: roll(32),
    spa: roll(32), spd: roll(32), spe: roll(32),
  };
  const mon: Mon = {
    uid: uid(),
    id,
    name: species(id).name,
    level,
    exp: expForLevel(level),
    ivs,
    hp: 0,
    moves: movesAtLevel(id, level),
    shiny: shiny ?? rand() < SHINY_RATE,
  };
  mon.hp = maxHp(mon);
  return mon;
}

export const maxHp = (mon: Mon) =>
  computeStat(species(mon.id).base.hp, mon.ivs.hp, mon.level, true);

export const statOf = (mon: Mon, key: Exclude<StatKey, "hp">) =>
  computeStat(species(mon.id).base[key], mon.ivs[key], mon.level, false);

export const typesOf = (mon: Mon): TypeName[] => species(mon.id).types;

export const isKo = (mon: Mon) => mon.hp <= 0;

export function healMon(mon: Mon): Mon {
  return {
    ...mon,
    hp: maxHp(mon),
    moves: mon.moves.map((m) => ({ ...m, pp: m.max })),
  };
}

/** Multiplicateur d'un cran de statistique (−6 à +6). */
const stageMult = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));
const accMult = (n: number) => (n >= 0 ? (3 + n) / 3 : 3 / (3 - n));

/* ------------------------------------------------------------- le combat */

export type BattleKind = "sauvage" | "dresseur";

export type BattleState = {
  kind: BattleKind;
  party: Mon[];
  active: number;
  foe: Mon;
  /** Équipe restante du dresseur adverse, le combat en cours exclu. */
  foeTeam: Mon[];
  playerStages: Stages;
  foeStages: Stages;
  trainer?: { name: string; title: string; reward: number };
  balls: number;
  potions: number;
  turn: number;
  outcome: "en-cours" | "victoire" | "defaite" | "capture" | "fuite";
  /** Pokémon capturé, à ajouter à l'équipe une fois les messages lus. */
  caught?: Mon;
  /** Le joueur doit choisir un remplaçant avant de continuer. */
  mustSwitch: boolean;
  runAttempts: number;
};

export type Turn = { state: BattleState; messages: string[] };

export const activeMon = (s: BattleState) => s.party[s.active];

export function startWild(party: Mon[], foe: Mon, bag: { balls: number; potions: number }): BattleState {
  return {
    kind: "sauvage",
    party,
    active: party.findIndex((m) => !isKo(m)),
    foe,
    foeTeam: [],
    playerStages: noStages(),
    foeStages: noStages(),
    balls: bag.balls,
    potions: bag.potions,
    turn: 0,
    outcome: "en-cours",
    mustSwitch: false,
    runAttempts: 0,
  };
}

export function startTrainer(
  party: Mon[],
  team: Mon[],
  trainer: { name: string; title: string; reward: number },
  bag: { balls: number; potions: number },
): BattleState {
  return {
    kind: "dresseur",
    party,
    active: party.findIndex((m) => !isKo(m)),
    foe: team[0],
    foeTeam: team.slice(1),
    playerStages: noStages(),
    foeStages: noStages(),
    trainer,
    balls: bag.balls,
    potions: bag.potions,
    turn: 0,
    outcome: "en-cours",
    mustSwitch: false,
    runAttempts: 0,
  };
}

/* ---------------------------------------------------------------- dégâts */

type Hit = { damage: number; eff: number; crit: boolean; missed: boolean };

function computeHit(
  attacker: Mon,
  attackerStages: Stages,
  defender: Mon,
  defenderStages: Stages,
  moveId: MoveId,
): Hit {
  const mv = MOVES[moveId];
  const accuracy = mv.accuracy * accMult(attackerStages.acc);
  if (rand() * 100 > accuracy) {
    return { damage: 0, eff: 1, crit: false, missed: true };
  }
  if (mv.category === "statut") {
    return { damage: 0, eff: 1, crit: false, missed: false };
  }

  const physical = mv.category === "physique";
  const a =
    statOf(attacker, physical ? "atk" : "spa") *
    stageMult(physical ? attackerStages.atk : attackerStages.spa);
  const d =
    statOf(defender, physical ? "def" : "spd") *
    stageMult(physical ? defenderStages.def : defenderStages.spd);

  const eff = effectiveness(mv.type, typesOf(defender));
  if (eff === 0) return { damage: 0, eff: 0, crit: false, missed: false };

  const crit = rand() < 1 / 16;
  const stab = typesOf(attacker).includes(mv.type) ? 1.5 : 1;
  const variance = (85 + roll(16)) / 100;

  const base =
    Math.floor(
      Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * mv.power * a) / d) / 50,
    ) + 2;

  return {
    damage: Math.max(1, Math.floor(base * stab * eff * (crit ? 2 : 1) * variance)),
    eff,
    crit,
    missed: false,
  };
}

const effWord = (eff: number) =>
  eff > 1 ? "C'est super efficace !" : eff < 1 ? "Ce n'est pas très efficace…" : null;

/** Applique une attaque et écrit les messages correspondants. */
function applyMove(
  state: BattleState,
  fromPlayer: boolean,
  moveIndex: number,
  messages: string[],
): void {
  const attacker = fromPlayer ? activeMon(state) : state.foe;
  const defender = fromPlayer ? state.foe : activeMon(state);
  const slot = attacker.moves[moveIndex];
  if (!slot || slot.pp <= 0) return;

  slot.pp -= 1;
  const mv = MOVES[slot.id];
  const who = fromPlayer ? attacker.name : `${attacker.name} ennemi`;
  messages.push(`${who} utilise ${mv.name} !`);

  const hit = computeHit(
    attacker,
    fromPlayer ? state.playerStages : state.foeStages,
    defender,
    fromPlayer ? state.foeStages : state.playerStages,
    slot.id,
  );

  if (hit.missed) {
    messages.push("Mais l'attaque échoue !");
    return;
  }
  if (hit.eff === 0) {
    messages.push(`Ça n'affecte pas ${defender.name}…`);
    return;
  }

  if (mv.category === "statut") {
    const lower = mv.lower;
    if (lower) {
      const stages = fromPlayer ? state.foeStages : state.playerStages;
      if (stages[lower.stat] <= -6) {
        messages.push(`La stat de ${defender.name} ne peut pas baisser plus !`);
      } else {
        stages[lower.stat] -= lower.stages;
        messages.push(`${defender.name} voit sa stat baisser !`);
      }
    }
    return;
  }

  defender.hp = Math.max(0, defender.hp - hit.damage);
  if (hit.crit) messages.push("Coup critique !");
  const word = effWord(hit.eff);
  if (word) messages.push(word);
  if (isKo(defender)) {
    messages.push(`${fromPlayer ? `${defender.name} ennemi` : defender.name} est K.O. !`);
  }
}

/** Choix de l'adversaire : la meilleure attaque, avec un peu d'imprévu. */
function foeChoice(state: BattleState): number {
  const usable = state.foe.moves
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.pp > 0);
  if (!usable.length) return -1;
  if (rand() < 0.15) return usable[roll(usable.length)].i;

  let best = usable[0].i;
  let bestScore = -1;
  for (const { m, i } of usable) {
    const mv = MOVES[m.id];
    const eff = effectiveness(mv.type, typesOf(activeMon(state)));
    const stab = typesOf(state.foe).includes(mv.type) ? 1.5 : 1;
    const score = mv.category === "statut" ? 12 : mv.power * eff * stab;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

const speed = (mon: Mon, stages: Stages) => statOf(mon, "spe") * stageMult(stages.spe);

/* ------------------------------------------------------- fin de combat */

function grantExp(state: BattleState, messages: string[]): void {
  const gain = expGain(species(state.foe.id).baseExp, state.foe.level);
  const mon = activeMon(state);
  if (isKo(mon)) return;

  mon.exp += gain;
  messages.push(`${mon.name} gagne ${gain} points d'exp. !`);

  while (mon.level < MAX_LEVEL && mon.exp >= expForLevel(mon.level + 1)) {
    // Les PV gagnés au passage de niveau s'ajoutent aux PV courants.
    const before = maxHp(mon);
    mon.level += 1;
    mon.hp = Math.min(maxHp(mon), mon.hp + (maxHp(mon) - before));
    messages.push(`${mon.name} monte au niveau ${mon.level} !`);

    for (const learn of species(mon.id).learnset) {
      if (learn.level !== mon.level) continue;
      if (mon.moves.some((m) => m.id === learn.move)) continue;
      const entry = { id: learn.move, pp: MOVES[learn.move].pp, max: MOVES[learn.move].pp };
      if (mon.moves.length < 4) {
        mon.moves.push(entry);
        messages.push(`${mon.name} apprend ${MOVES[learn.move].name} !`);
      } else {
        const dropped = mon.moves.shift()!;
        mon.moves.push(entry);
        messages.push(
          `${mon.name} oublie ${MOVES[dropped.id].name} et apprend ${MOVES[learn.move].name} !`,
        );
      }
    }

    // L'évolution suit immédiatement le niveau atteint, comme dans le jeu.
    const form = species(mon.id);
    if (form.evolvesInto && form.evolvesAt && mon.level >= form.evolvesAt) {
      const hpBefore = maxHp(mon);
      const from = mon.name;
      mon.id = form.evolvesInto;
      mon.name = species(mon.id).name;
      mon.hp = Math.min(maxHp(mon), mon.hp + (maxHp(mon) - hpBefore));
      messages.push(`Quoi ? ${from} évolue !`);
      messages.push(`Félicitations ! ${from} a évolué en ${mon.name} !`);
    }
  }
}

/** Le camp adverse est-il vaincu ? Enchaîne sur le Pokémon suivant sinon. */
function afterFoeDown(state: BattleState, messages: string[]): void {
  grantExp(state, messages);

  if (state.foeTeam.length) {
    state.foe = state.foeTeam[0];
    state.foeTeam = state.foeTeam.slice(1);
    state.foeStages = noStages();
    messages.push(`${state.trainer?.name ?? "L'adversaire"} envoie ${state.foe.name} !`);
    return;
  }

  state.outcome = "victoire";
  if (state.kind === "dresseur" && state.trainer) {
    messages.push(`${state.trainer.title} ${state.trainer.name} est battu !`);
    messages.push(`Vous remportez ${state.trainer.reward} P !`);
  } else {
    messages.push(`${state.foe.name} sauvage est vaincu !`);
  }
}

function afterPlayerDown(state: BattleState, messages: string[]): void {
  if (state.party.some((m) => !isKo(m))) {
    state.mustSwitch = true;
    messages.push("Choisissez un autre Pokémon !");
    return;
  }
  state.outcome = "defaite";
  messages.push("Vous n'avez plus de Pokémon en état de combattre…");
  messages.push("Vous rentrez au Centre Pokémon en toute hâte.");
}

/* ------------------------------------------------------------- actions */

const clone = (state: BattleState): BattleState => ({
  ...state,
  party: state.party.map((m) => ({ ...m, moves: m.moves.map((x) => ({ ...x })) })),
  foe: { ...state.foe, moves: state.foe.moves.map((x) => ({ ...x })) },
  foeTeam: state.foeTeam.map((m) => ({ ...m, moves: m.moves.map((x) => ({ ...x })) })),
  playerStages: { ...state.playerStages },
  foeStages: { ...state.foeStages },
});

/** Un tour complet : le joueur attaque, l'adversaire réplique. */
export function playerMove(prev: BattleState, moveIndex: number): Turn {
  const state = clone(prev);
  const messages: string[] = [];
  state.turn += 1;

  const mine = activeMon(state).moves[moveIndex];
  const theirIndex = foeChoice(state);
  const theirs = theirIndex >= 0 ? state.foe.moves[theirIndex] : null;

  const myPriority = MOVES[mine.id].priority ?? 0;
  const theirPriority = theirs ? (MOVES[theirs.id].priority ?? 0) : -99;
  const mySpeed = speed(activeMon(state), state.playerStages);
  const theirSpeed = speed(state.foe, state.foeStages);
  const playerFirst =
    myPriority !== theirPriority
      ? myPriority > theirPriority
      : mySpeed !== theirSpeed
        ? mySpeed > theirSpeed
        : rand() < 0.5;

  const actPlayer = () => applyMove(state, true, moveIndex, messages);
  const actFoe = () => {
    if (theirIndex < 0) {
      messages.push(`${state.foe.name} ennemi n'a plus de PP !`);
      return;
    }
    applyMove(state, false, theirIndex, messages);
  };

  if (playerFirst) {
    actPlayer();
    if (isKo(state.foe)) {
      afterFoeDown(state, messages);
      return { state, messages };
    }
    actFoe();
  } else {
    actFoe();
    if (isKo(activeMon(state))) {
      afterPlayerDown(state, messages);
      return { state, messages };
    }
    actPlayer();
    if (isKo(state.foe)) {
      afterFoeDown(state, messages);
      return { state, messages };
    }
  }

  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  return { state, messages };
}

/* -------------------------------------------------------------- capture */

/** Formule de capture de la Génération V, secousses comprises. */
function catchShakes(target: Mon, ballBonus: number): number {
  const max = maxHp(target);
  const rate = species(target.id).catchRate;
  const a = (((3 * max - 2 * target.hp) * rate * ballBonus) / (3 * max)) * 1;
  if (a >= 255) return 4;

  const b = 65536 / Math.pow(255 / a, 0.1875);
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.floor(rand() * 65536) >= b) break;
    shakes += 1;
  }
  return shakes;
}

export function throwBall(prev: BattleState): Turn {
  const state = clone(prev);
  const messages: string[] = [];

  if (state.kind === "dresseur") {
    messages.push("On ne vole pas les Pokémon des autres !");
    return { state, messages };
  }
  if (state.balls <= 0) {
    messages.push("Vous n'avez plus de Poké Ball !");
    return { state, messages };
  }

  state.balls -= 1;
  messages.push("Vous lancez une Poké Ball !");

  const shakes = catchShakes(state.foe, 1);
  if (shakes >= 4) {
    messages.push(`Et hop ! ${state.foe.name} est capturé !`);
    state.outcome = "capture";
    state.caught = { ...state.foe, moves: state.foe.moves.map((m) => ({ ...m })) };
    return { state, messages };
  }

  messages.push(
    [
      "Oh non ! Le Pokémon s'est libéré !",
      "Zut ! Il était presque attrapé !",
      "Ah ! Il s'est échappé de justesse !",
      "Rhaa ! Il s'est libéré au dernier moment !",
    ][shakes],
  );

  const theirIndex = foeChoice(state);
  if (theirIndex >= 0) applyMove(state, false, theirIndex, messages);
  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  return { state, messages };
}

/* ----------------------------------------------------- fuite et objets */

export function tryRun(prev: BattleState): Turn {
  const state = clone(prev);
  const messages: string[] = [];

  if (state.kind === "dresseur") {
    messages.push("Impossible de fuir un combat de Dresseurs !");
    return { state, messages };
  }

  state.runAttempts += 1;
  const mine = speed(activeMon(state), state.playerStages);
  const theirs = speed(state.foe, state.foeStages);
  const odds = theirs === 0 ? 256 : ((mine * 128) / theirs + 30 * state.runAttempts) % 256;

  if (mine >= theirs || roll(256) < odds) {
    state.outcome = "fuite";
    messages.push("Vous prenez la fuite !");
    return { state, messages };
  }

  messages.push("Impossible de fuir !");
  const theirIndex = foeChoice(state);
  if (theirIndex >= 0) applyMove(state, false, theirIndex, messages);
  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  return { state, messages };
}

export function takePotion(prev: BattleState): Turn {
  const state = clone(prev);
  const messages: string[] = [];
  const mon = activeMon(state);

  if (state.potions <= 0) {
    messages.push("Vous n'avez plus de Potion !");
    return { state, messages };
  }
  if (mon.hp >= maxHp(mon)) {
    messages.push(`${mon.name} a déjà tous ses PV !`);
    return { state, messages };
  }

  state.potions -= 1;
  const healed = Math.min(20, maxHp(mon) - mon.hp);
  mon.hp += healed;
  messages.push(`${mon.name} récupère ${healed} PV !`);

  const theirIndex = foeChoice(state);
  if (theirIndex >= 0) applyMove(state, false, theirIndex, messages);
  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  return { state, messages };
}

/** Changement de Pokémon : gratuit après un K.O., coûte le tour sinon. */
export function switchTo(prev: BattleState, index: number): Turn {
  const state = clone(prev);
  const messages: string[] = [];
  const forced = state.mustSwitch;

  if (index === state.active || isKo(state.party[index])) {
    messages.push("Ce Pokémon ne peut pas combattre !");
    return { state, messages };
  }

  state.active = index;
  state.playerStages = noStages();
  state.mustSwitch = false;
  messages.push(`En avant, ${activeMon(state).name} !`);

  if (!forced) {
    const theirIndex = foeChoice(state);
    if (theirIndex >= 0) applyMove(state, false, theirIndex, messages);
    if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  }
  return { state, messages };
}
