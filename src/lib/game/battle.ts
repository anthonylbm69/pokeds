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
  typedMoveset,
  type MoveId,
  type StatKey,
  type TypeName,
} from "./data";
import { ITEMS, countOf, effectOn, spend, type Bag, type ItemId } from "./items";

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
  /** Altération persistante, gardée hors combat jusqu'au Centre. */
  status: Status | null;
  /** Tours de sommeil restants, quand il dort. */
  sleep: number;
};

export type Status = "poison" | "brulure" | "paralysie" | "sommeil" | "gel";

export const STATUS_FR: Record<Status, string> = {
  poison: "empoisonné",
  brulure: "brûlé",
  paralysie: "paralysé",
  sommeil: "endormi",
  gel: "gelé",
};

/** L'étiquette de trois lettres posée sur la jauge, comme dans les jeux. */
export const STATUS_TAG: Record<Status, string> = {
  poison: "PSN",
  brulure: "BRÛ",
  paralysie: "PAR",
  sommeil: "SOM",
  gel: "GEL",
};

/**
 * Multiplicateur de capture. Un Pokémon endormi ou gelé se prend bien plus
 * facilement : c'est tout l'intérêt d'endormir avant de lancer la Ball.
 */
export const statusBonus = (status: Status | null): number =>
  status === "sommeil" || status === "gel" ? 2.5 : status ? 1.5 : 1;

/** Part des PV maximum perdue par tour sous poison ou brûlure. */
const RESIDU = 1 / 8;

/**
 * Une rencontre sur dix. Les jeux d'origine sont infiniment plus avares —
 * une sur huit mille — mais l'idée est ici d'en croiser pour de vrai.
 */
export const SHINY_RATE = 0.1;

export type Stages = Record<Exclude<StatKey, "hp"> | "acc", number>;

const noStages = (): Stages => ({
  atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0,
});

const rand = () => Math.random();
const roll = (n: number) => Math.floor(rand() * n);

/* ------------------------------------------------------------- créatures */

let counter = 0;
const uid = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

const slot = (move: MoveId) => ({ id: move, pp: MOVES[move].pp, max: MOVES[move].pp });

/**
 * Les quatre dernières attaques apprises, comme un Pokémon sauvage. Les
 * espèces reconstituées du Pokédex national n'ont pas d'apprentissage écrit :
 * leur répertoire se déduit de leurs types et de leur niveau.
 */
function movesAtLevel(id: number, level: number) {
  const kind = species(id);
  const known = kind.learnset.length
    ? kind.learnset.filter((l) => l.level <= level).slice(-4).map((l) => l.move)
    : typedMoveset(kind.types, level);
  return known.map(slot);
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
    status: null,
    sleep: 0,
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
    status: null,
    sleep: 0,
  };
}

/** Comment nommer un Pokémon dans le texte, selon son camp. */
const who = (mon: Mon, mine: boolean) => (mine ? mon.name : `${mon.name} ennemi`);

/**
 * Pose une altération, si la cible n'en porte pas déjà une. Un type ne peut
 * pas recevoir son propre mal : on n'empoisonne pas un Poison, on ne brûle
 * pas un Feu.
 */
export function inflict(
  mon: Mon,
  status: Status,
  mine: boolean,
  messages: string[],
): boolean {
  if (mon.status) return false;
  const types = typesOf(mon);
  const immunise =
    (status === "poison" && (types.includes("poison") || types.includes("steel"))) ||
    (status === "brulure" && types.includes("fire")) ||
    (status === "gel" && types.includes("ice")) ||
    (status === "paralysie" && types.includes("electric"));
  if (immunise) return false;

  mon.status = status;
  // Un à trois tours de sommeil, comme en Génération V.
  mon.sleep = status === "sommeil" ? 1 + roll(3) : 0;
  messages.push(`${who(mon, mine)} est ${STATUS_FR[status]} !`);
  return true;
}

/**
 * Le Pokémon peut-il agir ? Le sommeil se décompte, le gel se rompt parfois,
 * la paralysie bloque un coup sur quatre.
 */
function canAct(mon: Mon, mine: boolean, messages: string[]): boolean {
  if (mon.status === "sommeil") {
    if (mon.sleep > 0) {
      mon.sleep -= 1;
      messages.push(`${who(mon, mine)} dort à poings fermés.`);
      return false;
    }
    mon.status = null;
    messages.push(`${who(mon, mine)} se réveille !`);
    return true;
  }
  if (mon.status === "gel") {
    if (rand() < 0.2) {
      mon.status = null;
      messages.push(`${who(mon, mine)} n'est plus gelé !`);
      return true;
    }
    messages.push(`${who(mon, mine)} est pris dans la glace.`);
    return false;
  }
  if (mon.status === "paralysie" && rand() < 0.25) {
    messages.push(`${who(mon, mine)} est paralysé, il ne peut plus bouger !`);
    return false;
  }
  return true;
}

/** Les dégâts de fin de tour : le poison et la brûlure rongent lentement. */
function residual(mon: Mon, mine: boolean, messages: string[]): void {
  if (isKo(mon)) return;
  if (mon.status !== "poison" && mon.status !== "brulure") return;
  const perte = Math.max(1, Math.floor(maxHp(mon) * RESIDU));
  mon.hp = Math.max(0, mon.hp - perte);
  messages.push(
    mon.status === "poison"
      ? `${who(mon, mine)} souffre du poison !`
      : `${who(mon, mine)} souffre de sa brûlure !`,
  );
  if (isKo(mon)) messages.push(`${who(mon, mine)} est K.O. !`);
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
  /** Potions que le dresseur adverse peut encore employer. */
  foePotions: number;
  bag: Bag;
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

export function startWild(party: Mon[], foe: Mon, bag: Bag): BattleState {
  return {
    kind: "sauvage",
    party,
    active: party.findIndex((m) => !isKo(m)),
    foe,
    foeTeam: [],
    playerStages: noStages(),
    foeStages: noStages(),
    foePotions: 0,
    bag,
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
  bag: Bag,
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
    // Un dresseur d'Arène ou de la Ligue a de quoi se soigner ; les autres non.
    foePotions: team.length >= 3 ? 2 : team.length >= 2 ? 1 : 0,
    bag,
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
  // Une brûlure ampute de moitié l'attaque physique, comme dans les jeux.
  const brulure = physical && attacker.status === "brulure" ? 0.5 : 1;
  const a =
    statOf(attacker, physical ? "atk" : "spa") *
    stageMult(physical ? attackerStages.atk : attackerStages.spa) *
    brulure;
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
  messages.push(`${who(attacker, fromPlayer)} utilise ${mv.name} !`);

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
    if (mv.inflicts) {
      if (!inflict(defender, mv.inflicts.status, !fromPlayer, messages)) {
        messages.push("Mais cela échoue !");
      }
      return;
    }
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
    messages.push(`${who(defender, !fromPlayer)} est K.O. !`);
    return;
  }

  // L'effet secondaire ne se déclenche que si la cible tient encore debout.
  if (mv.inflicts && rand() < mv.inflicts.chance) {
    inflict(defender, mv.inflicts.status, !fromPlayer, messages);
  }
}

/** Choix de l'adversaire : la meilleure attaque, avec un peu d'imprévu. */
/** Ce que vaut une attaque contre la cible du moment. */
function scoreOf(state: BattleState, move: MoveId, attacker: Mon, target: Mon): number {
  const mv = MOVES[move];
  const eff = effectiveness(mv.type, typesOf(target));
  const stab = typesOf(attacker).includes(mv.type) ? 1.5 : 1;
  if (mv.category !== "statut") return mv.power * eff * stab;
  // Poser une altération vaut cher, mais seulement sur une cible saine.
  if (mv.inflicts) return target.status ? 0 : 55;
  return 12;
}

/** Ce qu'un Pokémon a de mieux à opposer à la cible. */
function bestAgainst(state: BattleState, mon: Mon, target: Mon): number {
  let best = 0;
  for (const slot of mon.moves) {
    if (slot.pp <= 0) continue;
    best = Math.max(best, scoreOf(state, slot.id, mon, target));
  }
  return best;
}

export type FoePlan =
  | { do: "attaque"; move: number }
  | { do: "change"; index: number }
  | { do: "soin" }
  | { do: "rien" };

/**
 * La décision du dresseur adverse. Il ne se contente plus d'attaquer : il se
 * soigne quand il est bas, et passe la main à un coéquipier mieux placé quand
 * le duel tourne mal. Un Pokémon sauvage, lui, ne fait ni l'un ni l'autre.
 */
export function foePlan(state: BattleState): FoePlan {
  const cible = activeMon(state);

  if (state.kind === "dresseur") {
    const max = maxHp(state.foe);
    // Se soigner sous le tiers, et pas au tout dernier moment : sous un
    // quart, l'attaque suivante l'emporterait de toute façon.
    if (state.foePotions > 0 && state.foe.hp > max * 0.15 && state.foe.hp < max / 3) {
      return { do: "soin" };
    }

    // Changer quand on n'a plus rien à opposer et qu'un autre ferait mieux.
    const actuel = bestAgainst(state, state.foe, cible);
    if (actuel < 45 && state.foeTeam.length) {
      let meilleur = -1;
      let score = actuel * 1.6;
      state.foeTeam.forEach((m, i) => {
        if (isKo(m)) return;
        const valeur = bestAgainst(state, m, cible);
        if (valeur > score) {
          score = valeur;
          meilleur = i;
        }
      });
      if (meilleur >= 0) return { do: "change", index: meilleur };
    }
  }

  const move = foeChoice(state);
  return move >= 0 ? { do: "attaque", move } : { do: "rien" };
}

function foeChoice(state: BattleState): number {
  const usable = state.foe.moves
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.pp > 0);
  if (!usable.length) return -1;
  if (rand() < 0.15) return usable[roll(usable.length)].i;

  let best = usable[0].i;
  let bestScore = -1;
  for (const { m, i } of usable) {
    const score = scoreOf(state, m.id, state.foe, activeMon(state));
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

// Un Pokémon paralysé ne court plus qu'au quart de sa vitesse.
const speed = (mon: Mon, stages: Stages) =>
  statOf(mon, "spe") * stageMult(stages.spe) * (mon.status === "paralysie" ? 0.25 : 1);

/* ------------------------------------------------------- fin de combat */

/**
 * Part d'expérience revenant au reste de l'équipe. Sans elle, une équipe de
 * six monte six fois moins vite qu'un Pokémon seul, et le PC ne sert à rien.
 */
export const EXP_SHARE = 0.5;

function grantExp(state: BattleState, messages: string[]): void {
  const gain = expGain(species(state.foe.id).baseExp, state.foe.level);
  const combattant = activeMon(state);

  for (const mon of state.party) {
    if (isKo(mon)) continue;
    const part = mon === combattant ? gain : Math.max(1, Math.floor(gain * EXP_SHARE));
    if (mon !== combattant) {
      // Le partage se résume à une ligne : six annonces noieraient le texte.
      grantTo(mon, part, messages, false);
      continue;
    }
    grantTo(mon, part, messages, true);
  }

  const partages = state.party.filter((m) => !isKo(m) && m !== combattant).length;
  if (partages) {
    messages.push(`Le reste de l'équipe se partage ${Math.max(1, Math.floor(gain * EXP_SHARE))} points d'exp.`);
  }
}

/** Fait monter un Pokémon, annonce le gain si c'est lui qui a combattu. */
function grantTo(
  mon: Mon,
  gain: number,
  messages: string[],
  annonce: boolean,
): void {
  mon.exp += gain;
  if (annonce) messages.push(`${mon.name} gagne ${gain} points d'exp. !`);

  while (mon.level < MAX_LEVEL && mon.exp >= expForLevel(mon.level + 1)) {
    // Les PV gagnés au passage de niveau s'ajoutent aux PV courants.
    const before = maxHp(mon);
    mon.level += 1;
    mon.hp = Math.min(maxHp(mon), mon.hp + (maxHp(mon) - before));
    messages.push(`${mon.name} monte au niveau ${mon.level} !`);

    const kind = species(mon.id);
    // Fiche écrite à la main : on suit l'apprentissage au niveau près.
    // Espèce reconstituée : son répertoire se recalcule, ce qui lui vaut le
    // palier supérieur de son type le moment venu.
    const learned = kind.learnset.length
      ? kind.learnset.filter((l) => l.level === mon.level).map((l) => l.move)
      : typedMoveset(kind.types, mon.level);

    for (const move of learned) {
      if (mon.moves.some((m) => m.id === move)) continue;
      if (mon.moves.length < 4) {
        mon.moves.push(slot(move));
        messages.push(`${mon.name} apprend ${MOVES[move].name} !`);
      } else {
        const dropped = mon.moves.shift()!;
        mon.moves.push(slot(move));
        messages.push(
          `${mon.name} oublie ${MOVES[dropped.id].name} et apprend ${MOVES[move].name} !`,
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

/**
 * Le tour de l'adversaire, quel que soit ce que le joueur vient de faire :
 * attaquer, lancer une Ball, employer un objet ou changer de Pokémon. Suit
 * le même plan partout, plutôt que d'attaquer par défaut.
 */
function foeActs(state: BattleState, messages: string[]): void {
  const plan = foePlan(state);
  if (plan.do === "soin") return foeHeal(state, messages);
  if (plan.do === "change") return foeSwitch(state, plan.index, messages);
  if (plan.do === "rien") return;
  if (!canAct(state.foe, false, messages)) return;
  applyMove(state, false, plan.move, messages);
}

/** Ce que rend la Potion d'un dresseur : de quoi tenir un tour de plus. */
const FOE_HEAL = 60;

/** Le dresseur adverse soigne son Pokémon ; cela lui coûte son tour. */
function foeHeal(state: BattleState, messages: string[]): void {
  const max = maxHp(state.foe);
  const rendu = Math.min(FOE_HEAL, max - state.foe.hp);
  state.foe.hp += rendu;
  state.foePotions -= 1;
  messages.push(
    `${state.trainer?.name ?? "L'adversaire"} utilise une Potion sur ${state.foe.name} !`,
  );
}

/**
 * Le dresseur rappelle son Pokémon et en envoie un autre. Le remplaçant
 * n'attaque pas dans la foulée : changer coûte le tour, des deux côtés.
 */
function foeSwitch(state: BattleState, index: number, messages: string[]): void {
  const entrant = state.foeTeam[index];
  if (!entrant) return;
  const sortant = state.foe;
  state.foeTeam = state.foeTeam.filter((_, i) => i !== index);
  state.foeTeam.push(sortant);
  state.foe = entrant;
  state.foeStages = noStages();
  messages.push(
    `${state.trainer?.name ?? "L'adversaire"} rappelle ${sortant.name} et envoie ${entrant.name} !`,
  );
}

/** Le camp adverse est-il vaincu ? Enchaîne sur le Pokémon suivant sinon. */
function afterFoeDown(state: BattleState, messages: string[]): void {
  grantExp(state, messages);

  // Un Pokémon rappelé plus tôt a repris sa place dans la file : on ne
  // renvoie que ceux qui tiennent encore debout.
  const suivant = state.foeTeam.findIndex((m) => !isKo(m));
  if (suivant >= 0) {
    state.foe = state.foeTeam[suivant];
    state.foeTeam = state.foeTeam.filter((_, i) => i !== suivant);
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
  const plan = foePlan(state);
  const theirIndex = plan.do === "attaque" ? plan.move : -1;
  const theirs = theirIndex >= 0 ? state.foe.moves[theirIndex] : null;

  const myPriority = MOVES[mine.id].priority ?? 0;
  // Se soigner ou changer de Pokémon passe avant toute attaque, comme un
  // objet lancé par le joueur.
  const theirPriority = plan.do === "attaque" ? (theirs ? (MOVES[theirs.id].priority ?? 0) : -99) : 6;
  const mySpeed = speed(activeMon(state), state.playerStages);
  const theirSpeed = speed(state.foe, state.foeStages);
  const playerFirst =
    myPriority !== theirPriority
      ? myPriority > theirPriority
      : mySpeed !== theirSpeed
        ? mySpeed > theirSpeed
        : rand() < 0.5;

  const actPlayer = () => {
    if (!canAct(activeMon(state), true, messages)) return;
    applyMove(state, true, moveIndex, messages);
  };
  const actFoe = () => {
    if (plan.do === "soin") {
      foeHeal(state, messages);
      return;
    }
    if (plan.do === "change") {
      foeSwitch(state, plan.index, messages);
      return;
    }
    if (theirIndex < 0) {
      messages.push(`${state.foe.name} ennemi n'a plus de PP !`);
      return;
    }
    if (!canAct(state.foe, false, messages)) return;
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

  endOfTurn(state, messages);
  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  else if (isKo(state.foe)) afterFoeDown(state, messages);
  return { state, messages };
}

/**
 * La fin du tour : le poison et la brûlure prélèvent leur dû, le plus rapide
 * d'abord. Personne ne doit être déjà au tapis quand on arrive ici.
 */
function endOfTurn(state: BattleState, messages: string[]): void {
  const mine = activeMon(state);
  if (isKo(mine) || isKo(state.foe)) return;

  if (speed(mine, state.playerStages) >= speed(state.foe, state.foeStages)) {
    residual(mine, true, messages);
    residual(state.foe, false, messages);
  } else {
    residual(state.foe, false, messages);
    residual(mine, true, messages);
  }
}

/* -------------------------------------------------------------- capture */

/** Formule de capture de la Génération V, secousses comprises. */
function catchShakes(target: Mon, ballBonus: number): number {
  const max = maxHp(target);
  const rate = species(target.id).catchRate;
  const a =
    (((3 * max - 2 * target.hp) * rate * ballBonus) / (3 * max)) *
    statusBonus(target.status);
  if (a >= 255) return 4;

  const b = 65536 / Math.pow(255 / a, 0.1875);
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.floor(rand() * 65536) >= b) break;
    shakes += 1;
  }
  return shakes;
}

export function throwBall(prev: BattleState, item: ItemId = "ball"): Turn {
  const state = clone(prev);
  const messages: string[] = [];
  const data = ITEMS[item];

  if (state.kind === "dresseur") {
    messages.push("On ne vole pas les Pokémon des autres !");
    return { state, messages };
  }
  if (countOf(state.bag, item) <= 0) {
    messages.push(`Vous n'avez plus de ${data.name} !`);
    return { state, messages };
  }

  state.bag = spend(state.bag, item);
  messages.push(`Vous lancez une ${data.name} !`);

  // Une Ball plus fine multiplie le taux de capture : c'est tout ce qui
  // sépare une Poké Ball d'une Hyper Ball.
  const shakes = catchShakes(state.foe, data.bonus ?? 1);
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

  foeActs(state, messages);
  endOfTurn(state, messages);
  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  else if (isKo(state.foe)) afterFoeDown(state, messages);
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
  foeActs(state, messages);
  endOfTurn(state, messages);
  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  else if (isKo(state.foe)) afterFoeDown(state, messages);
  return { state, messages };
}

/**
 * Un soin ou un Rappel, posé sur un Pokémon de l'équipe. Employer un objet
 * coûte le tour : l'adversaire riposte, sauf si l'objet était sans effet.
 */
export function takeItem(prev: BattleState, item: ItemId, target?: number): Turn {
  const state = clone(prev);
  const messages: string[] = [];
  const index = target ?? state.active;
  const mon = state.party[index];
  const data = ITEMS[item];

  if (countOf(state.bag, item) <= 0) {
    messages.push(`Vous n'avez plus de ${data.name} !`);
    return { state, messages };
  }
  const { healed, refus } = effectOn(item, mon);
  if (refus) {
    messages.push(refus);
    return { state, messages };
  }

  state.bag = spend(state.bag, item);
  const releve = mon.hp <= 0;
  mon.hp += healed;
  if (data.kind === "statut") {
    mon.status = null;
    mon.sleep = 0;
    messages.push(`${mon.name} n'a plus aucune altération.`);
  } else {
    messages.push(
      releve
        ? `${mon.name} reprend ses esprits et récupère ${healed} PV !`
        : `${mon.name} récupère ${healed} PV !`,
    );
  }

  if (releve) {
    mon.status = null;
    mon.sleep = 0;
  }

  // Ranimer le Pokémon au tapis lève l'obligation de changer.
  if (releve && state.mustSwitch && state.party.some((m) => !isKo(m))) {
    state.mustSwitch = false;
    if (isKo(activeMon(state))) state.active = index;
  }

  foeActs(state, messages);
  endOfTurn(state, messages);
  if (isKo(activeMon(state))) afterPlayerDown(state, messages);
  else if (isKo(state.foe)) afterFoeDown(state, messages);
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
    foeActs(state, messages);
    endOfTurn(state, messages);
    if (isKo(activeMon(state))) afterPlayerDown(state, messages);
    else if (isKo(state.foe)) afterFoeDown(state, messages);
  }
  return { state, messages };
}
