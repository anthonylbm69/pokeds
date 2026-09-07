/**
 * Le combat vu de l'interface : quels écrans montrer, et que faire du choix
 * du joueur. Tout est pur — aucun état, aucun hook — pour que `useGame` ne
 * garde que l'enchaînement des phases, et pour que ces décisions se
 * vérifient sans navigateur.
 */

import { MOVES, TYPE_FR, effectiveness, species, type MoveId } from "@/lib/game/data";
import {
  activeMon,
  isKo,
  playerMove,
  switchTo,
  takeItem,
  throwBall,
  tryRun,
  type BattleState,
  type Mon,
  type Turn,
} from "@/lib/game/battle";
import {
  ITEMS,
  ITEM_ORDER,
  countOf,
  effectOn,
  needsTarget,
  type ItemId,
} from "@/lib/game/items";
import type { Choice } from "./TouchPanel";

export type BattleView = "message" | "menu" | "moves" | "bag" | "bagCible" | "party";

export type BattleUi = {
  state: BattleState;
  queue: string[];
  view: BattleView;
  throwing: boolean;
  /** Le dresseur est encore en scène, avant son premier Pokémon. */
  showTrainer: boolean;
  /** Objet choisi au sac, en attente de sa cible. */
  item?: ItemId;
  /** `npc` n'est renseigné que pour un Pokémon posté sur la carte. */
  origin: { kind: "sauvage"; npc?: string } | { kind: "dresseur"; npc: string };
};

/** Le premier remplaçant en état de se battre. */
export const firstReady = (s: BattleState) =>
  Math.max(0, s.party.findIndex((m, i) => !isKo(m) && i !== s.active));

/**
 * Ce que vaut une attaque contre l'adversaire du moment, écrit en clair.
 * Rien n'est révélé pour une attaque de statut, qui ne suit pas la table.
 */
export function efficaciteContre(move: MoveId, foe: Mon): string {
  const mv = MOVES[move];
  if (mv.category === "statut") return "";
  const eff = effectiveness(mv.type, species(foe.id).types);
  if (eff === 0) return " · sans effet";
  if (eff > 1.5) return " · très efficace";
  if (eff > 1) return " · efficace";
  if (eff < 0.5) return " · quasi sans effet";
  if (eff < 1) return " · peu efficace";
  return "";
}

/** La note qui suit le décompte d'un objet : ce qu'il fait, en trois mots. */
export function itemHint(id: ItemId): string {
  const data = ITEMS[id];
  if (data.kind === "rappel") return " — ranime un K.O.";
  if (data.kind === "statut") return " — lève une altération";
  if (data.kind === "soin") return ` — rend ${data.heal} PV`;
  return data.bonus && data.bonus > 1 ? ` — capture ×${data.bonus}` : "";
}

export type Screen = {
  title: string;
  hint: string;
  layout: "grid" | "list" | "row";
  list: Choice[];
};

/** Une ligne de liste pour un Pokémon : nom, livrée, niveau et PV. */
export type MonLine = (mon: Mon) => { label: string; sub: string };

/** L'écran du bas pendant un combat, selon la vue en cours. */
export function battleScreen(ui: BattleUi, monLine: MonLine): Screen {
  const s = ui.state;
  const mine = activeMon(s);
  const arena = s.kind === "sauvage" ? "Combat sauvage" : `Combat — ${s.trainer?.name}`;
  const back = { id: "back", label: "RETOUR", tone: "back" as const };

  // Pendant le défilement du texte, aucune commande n'est proposée.
  if (ui.view === "message") {
    return { title: arena, hint: "A pour continuer", layout: "row", list: [] };
  }

  if (ui.view === "menu") {
    const objets = ITEM_ORDER.reduce((n, id) => n + countOf(s.bag, id), 0);
    return {
      title: arena,
      hint: "Croix pour choisir · A pour valider",
      layout: "grid",
      list: [
        { id: "fight", label: "COMBAT", tone: "fight" },
        { id: "bag", label: "SAC", tone: "bag", sub: `${objets} objets` },
        { id: "party", label: "POKÉMON", tone: "party" },
        { id: "run", label: "FUITE", tone: "run", disabled: s.kind === "dresseur" },
      ],
    };
  }

  if (ui.view === "moves") {
    return {
      title: `Attaques de ${mine.name}`,
      hint: "A pour attaquer · B pour revenir",
      layout: "grid",
      list: [
        ...mine.moves.map((m) => ({
          id: m.id,
          label: MOVES[m.id].name,
          sub: `${TYPE_FR[MOVES[m.id].type]} · ${m.pp}/${m.max} PP${efficaciteContre(m.id, s.foe)}`,
          disabled: m.pp <= 0,
          tone: "fight" as const,
        })),
        back,
      ],
    };
  }

  if (ui.view === "bag") {
    return {
      title: "Sac",
      hint: "▲ ▼ pour choisir · A pour utiliser · B pour revenir",
      layout: "list",
      list: [
        ...ITEM_ORDER.filter((id) => countOf(s.bag, id) > 0).map((id) => ({
          id,
          label: ITEMS[id].name,
          sub:
            ITEMS[id].kind === "ball" && s.kind === "dresseur"
              ? `× ${countOf(s.bag, id)} — pas sur le Pokémon d'un autre`
              : `× ${countOf(s.bag, id)}${itemHint(id)}`,
          disabled: ITEMS[id].kind === "ball" && s.kind === "dresseur",
          tone: "bag" as const,
        })),
        back,
      ],
    };
  }

  if (ui.view === "bagCible") {
    const item = ui.item ?? "potion";
    return {
      title: `${ITEMS[item].name} sur qui ?`,
      hint: "▲ ▼ pour choisir · A pour utiliser · B pour revenir",
      layout: "list",
      list: [
        ...s.party.map((m, i) => ({
          id: `cible:${i}`,
          ...monLine(m),
          disabled: effectOn(item, m).refus !== null,
          tone: "party" as const,
        })),
        back,
      ],
    };
  }

  return {
    title: "Équipe",
    hint: s.mustSwitch ? "Choisissez un Pokémon en forme" : "A pour envoyer · B pour revenir",
    layout: "list",
    list: [
      ...s.party.map((m, i) => ({
        id: m.uid,
        label: m.name,
        sub: `N.${m.level} · ${m.hp} PV`,
        disabled: isKo(m) || i === s.active,
        tone: "party" as const,
      })),
      { ...back, disabled: s.mustSwitch },
    ],
  };
}

/**
 * Ce que déclenche un choix : passer à une autre vue, ou jouer un tour. La
 * décision est rendue plutôt qu'exécutée, pour que l'enchaînement des phases
 * reste l'affaire de `useGame`.
 */
export type BattleAction =
  | { do: "vue"; view: BattleView; item?: ItemId; cursor?: number }
  | { do: "tour"; turn: Turn; throwing?: boolean }
  | { do: "rien" };

export function battleAction(ui: BattleUi, choice: Choice, index: number): BattleAction {
  const retour: BattleAction = { do: "vue", view: "menu" };

  if (ui.view === "menu") {
    if (choice.id === "fight") return { do: "vue", view: "moves" };
    if (choice.id === "bag") return { do: "vue", view: "bag" };
    if (choice.id === "party") {
      return { do: "vue", view: "party", cursor: firstReady(ui.state) };
    }
    if (choice.id === "run") return { do: "tour", turn: tryRun(ui.state) };
    return { do: "rien" };
  }

  if (ui.view === "moves") {
    if (choice.id === "back") return retour;
    return { do: "tour", turn: playerMove(ui.state, index) };
  }

  if (ui.view === "bag") {
    if (choice.id === "back") return retour;
    const item = choice.id as ItemId;
    // Une Ball part sur l'adversaire ; un soin demande d'abord sa cible.
    if (needsTarget(item)) return { do: "vue", view: "bagCible", item };
    return { do: "tour", turn: throwBall(ui.state, item), throwing: true };
  }

  if (ui.view === "bagCible") {
    if (choice.id === "back") return { do: "vue", view: "bag" };
    const cible = Number(choice.id.split(":")[1]);
    return { do: "tour", turn: takeItem(ui.state, ui.item ?? "potion", cible) };
  }

  if (choice.id === "back") return retour;
  return { do: "tour", turn: switchTo(ui.state, index) };
}
