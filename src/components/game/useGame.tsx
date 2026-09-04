"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animatedUrl, cryUrl, staticUrl } from "@/lib/pokeapi";
import { TRACKS, music, trackForMap, type TrackId } from "@/lib/game/music";
import { MOVES, TYPE_FR, species } from "@/lib/game/data";
import {
  ITEMS,
  ITEM_ORDER,
  countOf,
  effectOn,
  needsTarget,
  type ItemId,
} from "@/lib/game/items";
import {
  activeMon,
  createMon,
  isKo,
  maxHp,
  playerMove,
  startTrainer,
  startWild,
  switchTo,
  takeItem,
  throwBall,
  tryRun,
  type BattleState,
  type Mon,
} from "@/lib/game/battle";
import {
  BUS_STOPS,
  MAPS,
  STEP,
  busStopOf,
  rollEncounter,
  seesPlayer,
  signAt,
  tileAt,
  tileChar,
  warpAt,
  type MapId,
  type NpcSpec,
} from "@/lib/game/world";
import {
  BIKE_PRICE,
  PARTY_MAX,
  STARTERS,
  addCaught,
  counterStarter,
  depositMon,
  giveStarter,
  hasFlag,
  healParty,
  loadGame,
  markSeen,
  newGame,
  leadMon,
  saveGame,
  applyItem,
  withDreamTeam,
  withdrawMon,
  withFlag,
  DREAM_LEVEL,
  type GameState,
} from "@/lib/game/state";
import type { DsButton, ModeParts } from "../DSConsole";
import BattleView from "./BattleView";
import BusRide from "./BusRide";
import RegionMap from "./RegionMap";
import TouchPanel, { type Choice } from "./TouchPanel";
import WorldView, { newPlayer, type PlayerPos } from "./WorldView";

export type GameParts = ModeParts & {
  /** Lance une partie neuve ou reprend la sauvegarde. */
  begin: (mode: "nouvelle" | "continuer") => void;
  /** La coque y dépose les boutons maintenus : c'est ce qui fait marcher. */
  setHeld: (buttons: ReadonlySet<DsButton>) => void;
  /** Espèces rencontrées : le Pokédex ouvert depuis le jeu s'y limite. */
  seen: number[];
};

/** Ce qu'il faut faire une fois le dialogue terminé. */
type Then =
  | { do: "starter" }
  | { do: "heal"; respawn: boolean }
  | { do: "trainer"; npc: string }
  | { do: "statique"; npc: string }
  | { do: "shop"; counter: "boutique" | "velo" }
  | { do: "world" };

type BattleUi = {
  state: BattleState;
  queue: string[];
  view: "message" | "menu" | "moves" | "bag" | "bagCible" | "party";
  /** Objet choisi au sac, en attente de sa cible. */
  item?: ItemId;
  throwing: boolean;
  /** Le dresseur est encore en scène, avant son premier Pokémon. */
  showTrainer: boolean;
  /** `npc` n'est renseigné que pour un Pokémon posté sur la carte. */
  origin: { kind: "sauvage"; npc?: string } | { kind: "dresseur"; npc: string };
};

type Counter = "boutique" | "velo";

type Phase =
  | { kind: "intro"; step: number }
  | { kind: "name" }
  | { kind: "world" }
  | { kind: "text"; lines: string[]; i: number; then: Then | null }
  | { kind: "starter" }
  | { kind: "carte" }
  | { kind: "bus" }
  | { kind: "voyage"; to: MapId; label: string }
  | { kind: "shop"; counter: Counter; message: string | null }
  | { kind: "sac"; on: "objets" | "cible"; item?: ItemId; message: string | null }
  | { kind: "pc"; on: "menu" | "retirer" | "deposer" | "ordre"; message: string | null }
  | { kind: "battle"; ui: BattleUi };

/** Les rayons, aux prix d'Unys. */
const STOCK: Record<Counter, { id: string; label: string; price: number }[]> = {
  boutique: ITEM_ORDER.map((id) => ({ id, label: ITEMS[id].name, price: ITEMS[id].price })),
  velo: [{ id: "bike", label: "VÉLO", price: BIKE_PRICE }],
};

const INTRO = [
  "Bonjour ! Bienvenue dans le monde des POKéMON !",
  "Je m'appelle Keteleeria. Mais tout le monde m'appelle le Professeur Pokémon.",
  "Ce monde est peuplé de créatures fabuleuses que l'on nomme Pokémon.",
  "Certaines personnes les élèvent, d'autres les affrontent… et d'autres, comme moi, les étudient.",
  "Et toi ? Quel genre de Dresseur vas-tu devenir ?",
  "Avant de commencer, dis-moi…",
];

const ENCOUNTER_RATE = 0.14;

/** La note qui suit le décompte d'un objet : ce qu'il fait, en trois mots. */
function itemHint(id: ItemId): string {
  const data = ITEMS[id];
  if (data.kind === "rappel") return " — ranime un K.O.";
  if (data.kind === "soin") return ` — rend ${data.heal} PV`;
  return data.bonus && data.bonus > 1 ? ` — capture ×${data.bonus}` : "";
}

/** Durée du trajet en autocar, animation comprise. */
const RIDE_MS = 2800;

const BADGE_LABEL: Record<string, string> = {
  trio: "insigne Trio",
  sylve: "insigne Sylve",
  roc: "insigne Roc",
};

/**
 * Le code de triche : cinq fois à gauche, deux fois à droite. Seuls les
 * appuis volontaires comptent — la répétition automatique de la marche est
 * écartée — et la séquence entière doit tenir dans la fenêtre ci-dessous,
 * sinon marcher de long en large finirait par la composer par accident.
 */
const CHEAT_LEFTS = 5;
const CHEAT_RIGHTS = 2;
const CHEAT_WINDOW = 3000;

export function useGame({
  active,
  onOpenDex,
  onExit,
}: {
  active: boolean;
  onOpenDex: () => void;
  onExit: () => void;
}): GameParts {
  const [game, setGame] = useState<GameState>(() => newGame(""));
  const [phase, setPhase] = useState<Phase>({ kind: "intro", step: 0 });
  const [cursor, setCursor] = useState(0);
  const [draftName, setDraftName] = useState("");

  const player = useRef<PlayerPos>(newPlayer(6, 6, "down"));
  const held = useRef<ReadonlySet<DsButton>>(new Set());
  const nameRef = useRef<HTMLInputElement>(null);

  const setHeld = useCallback((buttons: ReadonlySet<DsButton>) => {
    held.current = buttons;
  }, []);

  /** Le cri du Pokémon qui entre en scène, comme à l'ouverture d'un combat. */
  const cry = useRef<HTMLAudioElement | null>(null);
  const playCry = useCallback((id: number) => {
    cry.current?.pause();
    const audio = new Audio(cryUrl(id));
    audio.volume = 0.3;
    cry.current = audio;
    // Le navigateur peut refuser la lecture : ce n'est pas bloquant.
    void audio.play().catch(() => {});
  }, []);

  /** Démarre une partie neuve ou reprend la sauvegarde. */
  const begin = useCallback((mode: "nouvelle" | "continuer") => {
    if (mode === "continuer") {
      const saved = loadGame();
      if (saved) {
        setGame(saved);
        player.current = newPlayer(saved.x, saved.y, saved.dir);
        setPhase({ kind: "world" });
        return;
      }
    }
    setGame(newGame(""));
    setDraftName("");
    setPhase({ kind: "intro", step: 0 });
  }, []);

  /* ------------------------------------------------------------- PNJ */

  const map = MAPS[game.map];

  const npcs = useMemo<NpcSpec[]>(
    // Le légendaire de la grotte quitte les lieux une fois l'affaire réglée.
    () => map.npcs.filter((n) => !n.mon || !hasFlag(game, `battu:${n.id}`)),
    [map, game],
  );

  /**
   * Le Pokémon qui marche derrière le joueur : le premier de l'équipe encore
   * debout. Un Pokémon K.O. reste dans sa Ball.
   */
  const walker = useMemo(() => {
    if (!game.follower) return null;
    const lead = game.party.find((mon) => !isKo(mon));
    return lead ? { id: lead.id, shiny: lead.shiny } : null;
  }, [game.follower, game.party]);

  const npcById = useCallback(
    (id: string) => npcs.find((n) => n.id === id) ?? null,
    [npcs],
  );

  const talk = useCallback(
    (npc: NpcSpec) => {
      if (npc.mon) {
        setPhase({
          kind: "text",
          lines: npc.lines,
          i: 0,
          then: { do: "statique", npc: npc.id },
        });
        return;
      }
      if (npc.trainer && !hasFlag(game, `battu:${npc.id}`)) {
        setPhase({
          kind: "text",
          lines: npc.trainer.intro,
          i: 0,
          then: { do: "trainer", npc: npc.id },
        });
        return;
      }
      if (npc.starter) {
        if (!hasFlag(game, "starter")) {
          setPhase({
            kind: "text",
            lines: [
              `Ah, ${game.name} ! Je t'attendais.`,
              "J'ai ici trois Pokémon confiés par des Dresseurs de la région.",
              "Choisis celui qui t'accompagnera dans ton voyage !",
            ],
            i: 0,
            then: { do: "starter" },
          });
        } else {
          setPhase({
            kind: "text",
            lines: [
              "Alors, comment se porte ton Pokémon ?",
              "Les hautes herbes au nord regorgent d'espèces à étudier. Bonne route !",
            ],
            i: 0,
            then: null,
          });
        }
        return;
      }
      if (npc.heals) {
        setPhase({
          kind: "text",
          lines: npc.lines,
          i: 0,
          then: { do: "heal", respawn: true },
        });
        return;
      }
      if (npc.shop) {
        setPhase({
          kind: "text",
          lines: npc.lines,
          i: 0,
          then: { do: "shop", counter: "boutique" },
        });
        return;
      }
      if (npc.bike) {
        setPhase({
          kind: "text",
          lines: game.bike
            ? ["Alors, ce vélo ? Rien de tel pour avaler les routes !"]
            : npc.lines,
          i: 0,
          then: game.bike ? null : { do: "shop", counter: "velo" },
        });
        return;
      }
      setPhase({ kind: "text", lines: npc.lines, i: 0, then: null });
    },
    [game],
  );

  /* --------------------------------------------------------- combats */

  const openBattle = useCallback(
    (state: BattleState, queue: string[], origin: BattleUi["origin"]) => {
      setGame((g) => markSeen(g, state.foe.id));
      setCursor(0);
      playCry(state.foe.id);
      setPhase({
        kind: "battle",
        ui: {
          state,
          queue,
          view: "message",
          throwing: false,
          showTrainer: origin.kind === "dresseur",
          origin,
        },
      });
    },
    [playCry],
  );

  const startWildBattle = useCallback(
    (id: number, level: number) => {
      const foe = createMon(id, level);
      const state = startWild(game.party, foe, game.bag);
      openBattle(
        state,
        [
          `Un ${foe.name} sauvage apparaît !`,
          ...(foe.shiny ? ["✦ Sa livrée scintille d'un éclat rare !"] : []),
          `En avant, ${activeMon(state).name} !`,
        ],
        { kind: "sauvage" },
      );
    },
    [game, openBattle],
  );

  /**
   * Le combat d'un Pokémon posté sur une carte — un légendaire au fond d'une
   * grotte. C'est un combat sauvage : on peut le capturer, mais il ne se
   * représentera pas si on le met au tapis.
   */
  const startStaticBattle = useCallback(
    (npcId: string) => {
      const npc = npcById(npcId);
      if (!npc?.mon) return;
      const foe = createMon(npc.mon.id, npc.mon.level, npc.mon.shiny);
      const state = startWild(game.party, foe, game.bag);
      openBattle(
        state,
        [
          `${foe.name} bloque le passage !`,
          ...(foe.shiny ? ["✦ Sa livrée scintille d'un éclat rare !"] : []),
          `En avant, ${activeMon(state).name} !`,
        ],
        { kind: "sauvage", npc: npcId },
      );
    },
    [game, npcById, openBattle],
  );

  const startTrainerBattle = useCallback(
    (npcId: string) => {
      const npc = npcById(npcId);
      if (!npc?.trainer) return;
      const team = npc.trainer.team.map((t) => createMon(t.id, t.level));
      // À l'Arène, l'as de la Championne répond au starter du joueur.
      if (npc.trainer.mirror && team.length) {
        const last = team[team.length - 1];
        team[team.length - 1] = createMon(counterStarter(game.starter), last.level);
      }
      const state = startTrainer(game.party, team, {
        name: npc.trainer.name,
        title: npc.trainer.title,
        reward: npc.trainer.reward,
      }, game.bag);
      openBattle(
        state,
        [
          `${npc.trainer.title} ${npc.trainer.name} veut se battre !`,
          `${npc.trainer.name} envoie ${state.foe.name} !`,
          `En avant, ${activeMon(state).name} !`,
        ],
        { kind: "dresseur", npc: npcId },
      );
    },
    [game, npcById, openBattle],
  );

  /** Range le combat : équipe, sac, récompense, puis retour au monde. */
  const finishBattle = useCallback(
    (ui: BattleUi) => {
      const s = ui.state;
      let next: GameState = {
        ...game,
        party: s.party,
        bag: s.bag,
      };
      const lines: string[] = [];

      if (s.outcome === "capture" && s.caught) {
        const plein = next.party.length >= PARTY_MAX;
        next = addCaught(next, s.caught);
        lines.push(
          plein
            ? `${s.caught.name} est transféré au PC : votre équipe est pleine.`
            : `Les données de ${s.caught.name} sont ajoutées au Pokédex.`,
        );
      }

      if (s.outcome === "victoire") music.play("victoire");

      // Un Pokémon posté cède la place dès qu'il est vaincu ou capturé.
      if (
        ui.origin.kind === "sauvage" &&
        ui.origin.npc &&
        (s.outcome === "victoire" || s.outcome === "capture")
      ) {
        next = withFlag(next, `battu:${ui.origin.npc}`);
      }

      if (s.outcome === "victoire" && ui.origin.kind === "dresseur") {
        const npc = npcById(ui.origin.npc);
        next = withFlag(next, `battu:${ui.origin.npc}`);
        next = { ...next, money: next.money + (s.trainer?.reward ?? 0) };
        if (npc?.trainer) {
          lines.push(...npc.trainer.defeat, ...npc.trainer.after);
          if (npc.trainer.badge) next = withFlag(next, `insigne:${npc.trainer.badge}`);
        }
      }

      if (s.outcome === "defaite") {
        next = healParty(next);
        next = { ...next, map: next.respawn.map, x: next.respawn.x, y: next.respawn.y };
        player.current = newPlayer(next.respawn.x, next.respawn.y, "down");
        lines.push("Vos Pokémon ont été soignés. Reprenez des forces !");
      }

      // Une évolution change l'espèce en cours de combat : on réenregistre
      // toute l'équipe au Pokédex plutôt que de la suivre coup par coup.
      const owned = next.party.map((m) => m.id);
      next = {
        ...next,
        seen: [...new Set([...next.seen, ...owned])],
        caught: [...new Set([...next.caught, ...owned])],
      };

      setGame(next);
      saveGame({ ...next, x: player.current.x, y: player.current.y, dir: player.current.dir });
      setPhase(lines.length ? { kind: "text", lines, i: 0, then: null } : { kind: "world" });
    },
    [game, npcById],
  );

  /** Premier Pokémon envoyable : le curseur ne se pose jamais sur un K.O. */
  const firstReady = useCallback(
    (s: BattleState) =>
      Math.max(0, s.party.findIndex((m, i) => !isKo(m) && i !== s.active)),
    [],
  );

  /** Fait avancer la file de messages d'un combat. */
  const advanceBattle = useCallback(
    (ui: BattleUi) => {
      const queue = ui.queue.slice(1);
      if (queue.length) {
        // Le dresseur s'efface dès sa réplique lue : son Pokémon entre.
        setPhase({
          kind: "battle",
          ui: { ...ui, queue, throwing: false, showTrainer: false },
        });
        return;
      }
      if (ui.state.outcome !== "en-cours") {
        finishBattle(ui);
        return;
      }
      setCursor(ui.state.mustSwitch ? firstReady(ui.state) : 0);
      setPhase({
        kind: "battle",
        ui: { ...ui, queue, throwing: false, view: ui.state.mustSwitch ? "party" : "menu" },
      });
    },
    [finishBattle, firstReady],
  );

  const runTurn = useCallback(
    (ui: BattleUi, turn: { state: BattleState; messages: string[] }, throwing = false) => {
      setCursor(0);
      setPhase({
        kind: "battle",
        ui: { ...ui, state: turn.state, queue: turn.messages, view: "message", throwing },
      });
    },
    [],
  );

  /* ---------------------------------------------------------- le monde */

  const onStep = useCallback(
    (x: number, y: number) => {
      const current = MAPS[game.map];

      const warp = warpAt(current, x, y);
      if (warp) {
        // Portes du Plateau et salles de la Ligue : on ne passe qu'avec les
        // insignes en poche, ou une fois le membre du Conseil 4 battu.
        if (warp.needs?.some((flag) => !hasFlag(game, flag))) {
          setPhase({
            kind: "text",
            lines: warp.refusal ?? ["La porte ne s'ouvre pas."],
            i: 0,
            then: null,
          });
          return;
        }

        const moved: GameState = {
          ...game,
          map: warp.to,
          x: warp.tx,
          y: warp.ty,
          dir: warp.dir ?? game.dir,
          // On met pied à terre en franchissant une porte.
          riding: game.riding && !MAPS[warp.to].indoor,
        };
        player.current = newPlayer(warp.tx, warp.ty, warp.dir ?? game.dir);
        setGame(moved);
        saveGame(moved);
        return;
      }

      for (const npc of current.npcs) {
        if (!npc.trainer || hasFlag(game, `battu:${npc.id}`)) continue;
        if (seesPlayer(current, npc, x, y)) {
          setPhase({
            kind: "text",
            lines: npc.trainer.intro,
            i: 0,
            then: { do: "trainer", npc: npc.id },
          });
          return;
        }
      }

      if (tileChar(current, x, y) === "," && game.party.some((m) => !isKo(m))) {
        if (Math.random() < ENCOUNTER_RATE) {
          const roll = rollEncounter(current);
          if (roll) startWildBattle(roll.id, roll.level);
        }
      }
    },
    [game, startWildBattle],
  );

  const interact = useCallback(() => {
    const p = player.current;
    const { dx, dy } = STEP[p.dir];
    const tx = p.x + dx;
    const ty = p.y + dy;

    const npc = map.npcs.find((n) => n.x === tx && n.y === ty);
    if (npc) {
      talk(npc);
      return;
    }
    if (tileAt(map, tx, ty)?.kind === "bus") {
      // Sans Pokémon, le car serait un moyen de contourner le bourg.
      if (!hasFlag(game, "starter")) {
        setPhase({
          kind: "text",
          lines: [
            "Le chauffeur vous arrête d'un geste.",
            "« Personne ne quitte le bourg sans Pokémon. Va donc voir le Professeur. »",
          ],
          i: 0,
          then: null,
        });
        return;
      }
      setCursor(0);
      setPhase({ kind: "bus" });
      return;
    }

    if (tileAt(map, tx, ty)?.kind === "pc") {
      setCursor(0);
      setPhase({ kind: "pc", on: "menu", message: null });
      return;
    }

    const sign = signAt(map, tx, ty);
    if (sign) {
      setPhase({ kind: "text", lines: sign.text, i: 0, then: null });
    }
  }, [map, talk, game]);

  /* --------------------------------------------------- les Cars Faure */

  /** Fin du trajet : on descend à l'arrêt de la destination. */
  const arriveByBus = useCallback(
    (to: MapId) => {
      const stop = busStopOf(to);
      if (!stop) {
        setPhase({ kind: "world" });
        return;
      }
      const next: GameState = {
        ...game,
        map: to,
        x: stop.x,
        y: stop.y,
        dir: "down",
        riding: false,
      };
      player.current = newPlayer(stop.x, stop.y, "down");
      setGame(next);
      saveGame(next);
      setPhase({
        kind: "text",
        lines: [
          `Terminus : ${stop.label}.`,
          "Merci d'avoir voyagé avec les Cars Faure !",
        ],
        i: 0,
        then: null,
      });
    },
    [game],
  );

  useEffect(() => {
    if (phase.kind !== "voyage") return;
    const to = phase.to;
    const id = window.setTimeout(() => arriveByBus(to), RIDE_MS);
    return () => window.clearTimeout(id);
  }, [phase, arriveByBus]);

  const save = useCallback(() => {
    const next = {
      ...game,
      x: player.current.x,
      y: player.current.y,
      dir: player.current.dir,
    };
    setGame(next);
    saveGame(next);
    setPhase({
      kind: "text",
      lines: [`${next.name || "Dresseur"} sauvegarde sa progression…`, "C'est fait !"],
      i: 0,
      then: null,
    });
  }, [game]);

  /* -------------------------------------------------- fin de dialogue */

  const resolveThen = useCallback(
    (then: Then | null) => {
      if (!then) {
        setPhase({ kind: "world" });
        return;
      }
      switch (then.do) {
        case "starter":
          setCursor(0);
          setPhase({ kind: "starter" });
          break;
        case "statique":
          startStaticBattle(then.npc);
          break;
        case "trainer":
          startTrainerBattle(then.npc);
          break;
        case "heal": {
          music.play("soin");
          const healed = healParty(game);
          const next = then.respawn
            ? { ...healed, respawn: { map: game.map, x: player.current.x, y: player.current.y } }
            : healed;
          setGame(next);
          saveGame({ ...next, x: player.current.x, y: player.current.y, dir: player.current.dir });
          setPhase({
            kind: "text",
            lines: ["Vos Pokémon débordent d'énergie !"],
            i: 0,
            then: null,
          });
          break;
        }
        case "shop":
          setCursor(0);
          setPhase({ kind: "shop", counter: then.counter, message: null });
          break;
        default:
          setPhase({ kind: "world" });
      }
    },
    [game, startTrainerBattle, startStaticBattle],
  );

  /** Achat d'un article : le comptoir reste ouvert pour enchaîner. */
  const buy = useCallback(
    (counter: Counter, index: number) => {
      const item = STOCK[counter][index];
      if (!item) return;
      if (game.money < item.price) {
        setPhase({ kind: "shop", counter, message: "Vous n'avez pas assez d'argent…" });
        return;
      }
      if (item.id === "bike" && game.bike) {
        setPhase({ kind: "shop", counter, message: "Vous en avez déjà un !" });
        return;
      }

      const next: GameState = {
        ...game,
        money: game.money - item.price,
        bag:
          item.id === "bike"
            ? game.bag
            : { ...game.bag, [item.id as ItemId]: countOf(game.bag, item.id as ItemId) + 1 },
        bike: game.bike || item.id === "bike",
      };
      setGame(next);
      saveGame({ ...next, x: player.current.x, y: player.current.y, dir: player.current.dir });
      setPhase({
        kind: "shop",
        counter,
        message:
          item.id === "bike"
            ? "Et voilà votre vélo ! Appuyez sur L pour monter en selle."
            : `Et voilà un${item.id.endsWith("ball") ? "e" : ""} ${item.label} ! Merci de votre visite.`,
      });
    },
    [game],
  );

  /* ------------------------------------------------ le code de triche */

  const combo = useRef({ lefts: 0, rights: 0, at: 0 });

  /**
   * Compte les gauches puis les droites ; renvoie vrai quand la séquence
   * aboutit. Des gauches en trop ne gênent pas — seules les cinq dernières
   * comptent — mais toute autre touche remet le compteur à zéro.
   */
  const trackCheat = useCallback((button: DsButton) => {
    const now = Date.now();
    const state = combo.current;
    if (now - state.at > CHEAT_WINDOW) {
      state.lefts = 0;
      state.rights = 0;
    }
    state.at = now;

    if (button === "left") {
      // Repartir à gauche après une droite, c'est recommencer la séquence.
      if (state.rights > 0) state.lefts = 0;
      state.rights = 0;
      state.lefts = Math.min(state.lefts + 1, CHEAT_LEFTS);
      return false;
    }

    if (button === "right" && state.lefts >= CHEAT_LEFTS) {
      state.rights += 1;
      if (state.rights >= CHEAT_RIGHTS) {
        state.lefts = 0;
        state.rights = 0;
        return true;
      }
      return false;
    }

    state.lefts = 0;
    state.rights = 0;
    return false;
  }, []);

  const grantDreamTeam = useCallback(() => {
    const next = withDreamTeam(game);
    setGame(next);
    saveGame({ ...next, x: player.current.x, y: player.current.y, dir: player.current.dir });
    setPhase({
      kind: "text",
      lines: [
        "★ CODE ACCEPTÉ ★",
        `Six championnes et champions de niveau ${DREAM_LEVEL} rejoignent votre équipe.`,
        `${next.party.map((mon) => mon.name).join(", ")}.`,
        "L'ancienne équipe s'efface. Que le duel commence !",
      ],
      i: 0,
      then: null,
    });
  }, [game]);

  /** Monter ou descendre du vélo : impossible à l'intérieur. */
  const toggleBike = useCallback(() => {
    if (!game.bike) return;
    if (!game.riding && MAPS[game.map].indoor) {
      setPhase({
        kind: "text",
        lines: ["Pas de vélo à l'intérieur !"],
        i: 0,
        then: null,
      });
      return;
    }
    setGame((g) => ({ ...g, riding: !g.riding }));
  }, [game]);

  const chooseStarter = useCallback(
    (index: number) => {
      const id = STARTERS[index];
      const next = giveStarter(game, id);
      setGame(next);
      saveGame({ ...next, x: player.current.x, y: player.current.y, dir: player.current.dir });
      setPhase({
        kind: "text",
        lines: [
          `${next.name} reçoit ${species(id).name} !`,
          `${species(id).name} a l'air ravi de te rencontrer.`,
          "Tiens, prends aussi ces cinq Poké Ball. À toi de jouer !",
        ],
        i: 0,
        then: null,
      });
    },
    [game],
  );

  /* ------------------------------------------------------ les options */

  const battleUi = phase.kind === "battle" ? phase.ui : null;

  /** Ce que le sac contient en tout, pour la vignette du menu. */
  const sacTotal = useMemo(
    () => ITEM_ORDER.reduce((n, id) => n + countOf(game.bag, id), 0),
    [game.bag],
  );

  /** Une ligne de liste pour un Pokémon : nom, livrée, niveau et PV. */
  const monLine = useCallback(
    (mon: Mon) => ({
      label: `${mon.name}${mon.shiny ? " ✦" : ""}`,
      sub: `N.${mon.level} · ${mon.hp}/${maxHp(mon)} PV`,
    }),
    [],
  );

  const choices = useMemo<{ list: Choice[]; layout: "grid" | "list" | "row"; hint: string; title: string }>(() => {
    if (battleUi) {
      const s = battleUi.state;
      const mine = activeMon(s);
      const arena =
        s.kind === "sauvage" ? "Combat sauvage" : `Combat — ${s.trainer?.name}`;

      // Pendant le défilement du texte, aucune commande n'est proposée.
      if (battleUi.view === "message") {
        return { title: arena, hint: "A pour continuer", layout: "row", list: [] };
      }
      if (battleUi.view === "menu") {
        return {
          title: arena,
          hint: "Croix pour choisir · A pour valider",
          layout: "grid",
          list: [
            { id: "fight", label: "COMBAT", tone: "fight" },
            {
              id: "bag",
              label: "SAC",
              tone: "bag",
              sub: `${ITEM_ORDER.reduce((n, id) => n + countOf(s.bag, id), 0)} objets`,
            },
            { id: "party", label: "POKÉMON", tone: "party" },
            { id: "run", label: "FUITE", tone: "run", disabled: s.kind === "dresseur" },
          ],
        };
      }
      if (battleUi.view === "moves") {
        return {
          title: `Attaques de ${mine.name}`,
          hint: "A pour attaquer · B pour revenir",
          layout: "grid",
          list: [
            ...mine.moves.map((m) => ({
              id: m.id,
              label: MOVES[m.id].name,
              sub: `${TYPE_FR[MOVES[m.id].type]} · ${m.pp}/${m.max} PP`,
              disabled: m.pp <= 0,
              tone: "fight" as const,
            })),
            { id: "back", label: "RETOUR", tone: "back" as const },
          ],
        };
      }
      if (battleUi.view === "bag") {
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
            { id: "back", label: "RETOUR", tone: "back" as const },
          ],
        };
      }

      if (battleUi.view === "bagCible") {
        const item = battleUi.item ?? "potion";
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
            { id: "back", label: "RETOUR", tone: "back" as const },
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
          { id: "back", label: "RETOUR", tone: "back" as const, disabled: s.mustSwitch },
        ],
      };
    }

    if (phase.kind === "starter") {
      return {
        title: "Choisis ton premier Pokémon",
        hint: "◀ ▶ pour parcourir · A pour choisir",
        layout: "row",
        list: STARTERS.map((id) => ({ id: String(id), label: species(id).name })),
      };
    }

    if (phase.kind === "bus") {
      return {
        title: "Cars Faure",
        hint: "▲ ▼ pour choisir · A pour monter · B pour renoncer",
        layout: "list",
        list: [
          ...BUS_STOPS.filter((stop) => stop.map !== game.map).map((stop) => {
            const manquants = stop.badges.filter(
              (badge) => !hasFlag(game, `insigne:${badge}`),
            );
            return {
              id: stop.map,
              label: stop.label,
              sub: !manquants.length
                ? "desservi"
                : manquants.length === 1
                  ? `${BADGE_LABEL[manquants[0]]} exigé`
                  : `${manquants.length} insignes exigés`,
              disabled: manquants.length > 0,
              tone: (manquants.length ? "back" : "bag") as Choice["tone"],
            };
          }),
          { id: "leave", label: "RENONCER", tone: "back" },
        ],
      };
    }

    if (phase.kind === "voyage") {
      return {
        title: "Cars Faure",
        hint: "Trajet en cours…",
        layout: "row",
        list: [],
      };
    }

    if (phase.kind === "carte") {
      return {
        title: "Carte de la région",
        hint: "B ou START pour refermer",
        layout: "row",
        list: [{ id: "leave", label: "REFERMER", tone: "back" }],
      };
    }

    if (phase.kind === "shop") {
      const owned = (id: string) =>
        id === "bike"
          ? game.bike
            ? "déjà en selle"
            : "un seul suffit"
          : `vous en avez ${countOf(game.bag, id as ItemId)}`;
      return {
        title: phase.counter === "velo" ? "Cycles Maillard" : "Boutique",
        hint: "▲ ▼ pour choisir · A pour acheter · B pour sortir",
        layout: "list",
        list: [
          ...STOCK[phase.counter].map((item) => ({
            id: item.id,
            label: item.label,
            sub: `${item.price} P — ${owned(item.id)}`,
            disabled: game.money < item.price || (item.id === "bike" && game.bike),
            tone: "bag" as const,
          })),
          { id: "leave", label: "SORTIR", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "sac") {
      const back = { id: "back", label: "RETOUR", tone: "back" as const };
      if (phase.on === "cible") {
        const item = phase.item ?? "potion";
        return {
          title: `${ITEMS[item].name} sur qui ?`,
          hint: "▲ ▼ pour choisir · A pour utiliser · B pour revenir",
          layout: "list",
          list: [
            ...game.party.map((mon, i) => ({
              id: `mon:${i}`,
              ...monLine(mon),
              disabled: effectOn(item, mon).refus !== null,
              tone: "party" as const,
            })),
            back,
          ],
        };
      }
      const tenus = ITEM_ORDER.filter((id) => countOf(game.bag, id) > 0);
      return {
        title: "Sac",
        hint: "▲ ▼ pour choisir · A pour utiliser · B pour fermer",
        layout: "list",
        list: [
          ...tenus.map((id) => ({
            id,
            label: ITEMS[id].name,
            sub:
              ITEMS[id].kind === "ball"
                ? `× ${countOf(game.bag, id)} — seulement en combat`
                : `× ${countOf(game.bag, id)}${itemHint(id)}`,
            disabled: ITEMS[id].kind === "ball" || !game.party.length,
            tone: "bag" as const,
          })),
          ...(tenus.length ? [] : [{ id: "vide", label: "SAC VIDE", disabled: true, tone: "back" as const }]),
          { id: "leave", label: "FERMER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "pc") {
      const back = { id: "back", label: "RETOUR", tone: "back" as const };
      if (phase.on === "retirer") {
        return {
          title: "Retirer du PC",
          hint: "▲ ▼ pour choisir · A pour reprendre · B pour revenir",
          layout: "list",
          list: [
            ...game.box.map((mon, i) => ({
              id: `box:${i}`,
              ...monLine(mon),
              disabled: game.party.length >= PARTY_MAX,
              tone: "party" as const,
            })),
            back,
          ],
        };
      }
      if (phase.on === "deposer" || phase.on === "ordre") {
        const depot = phase.on === "deposer";
        return {
          title: depot ? "Déposer au PC" : "Mettre en tête",
          hint: `▲ ▼ pour choisir · A pour ${depot ? "déposer" : "placer"} · B pour revenir`,
          layout: "list",
          list: [
            ...game.party.map((mon, i) => ({
              id: `${depot ? "dep" : "tete"}:${i}`,
              ...monLine(mon),
              disabled: depot ? game.party.length <= 1 : i === 0,
              tone: "party" as const,
            })),
            back,
          ],
        };
      }
      return {
        title: `PC de ${game.name || "Dresseur"}`,
        hint: "▲ ▼ pour choisir · A pour valider · B pour fermer",
        layout: "list",
        list: [
          {
            id: "retirer",
            label: "RETIRER",
            sub: game.box.length ? `${game.box.length} au PC` : "le PC est vide",
            disabled: !game.box.length || game.party.length >= PARTY_MAX,
            tone: "party" as const,
          },
          {
            id: "deposer",
            label: "DÉPOSER",
            sub: `${game.party.length}/${PARTY_MAX} sur vous`,
            disabled: game.party.length <= 1,
            tone: "party" as const,
          },
          {
            id: "ordre",
            label: "METTRE EN TÊTE",
            sub: game.party[0] ? `${game.party[0].name} ouvre les combats` : "—",
            disabled: game.party.length <= 1,
            tone: "party" as const,
          },
          { id: "leave", label: "FERMER", tone: "back" as const },
        ],
      };
    }

    if (phase.kind === "name") {
      return {
        title: "Ton nom",
        hint: "Tapez un nom puis validez",
        layout: "row",
        list: [{ id: "ok", label: "VALIDER", tone: "fight" }],
      };
    }

    if (phase.kind === "intro" || phase.kind === "text") {
      return {
        title: phase.kind === "intro" ? "Introduction" : MAPS[game.map].name,
        hint: "A pour continuer",
        layout: "row",
        list: [],
      };
    }

    return {
      title: MAPS[game.map].name,
      hint: game.bike
        ? `Croix pour marcher · B pour courir · L pour ${game.riding ? "descendre du" : "monter à"} vélo · A pour interagir`
        : "Croix pour marcher · B pour courir · A pour interagir",
      // Sept entrées : deux colonnes se lisent mieux qu'une rangée serrée.
      layout: "grid",
      list: [
        { id: "sac", label: "SAC", sub: `${sacTotal} objet${sacTotal > 1 ? "s" : ""}` },
        { id: "carte", label: "CARTE", sub: "START" },
        { id: "dex", label: "POKÉDEX", sub: `${game.caught.length} capturés` },
        { id: "save", label: "SAUVER", sub: "X" },
        { id: "music", label: "MUSIQUE", sub: game.music ? "activée" : "coupée" },
        {
          id: "suiveur",
          label: "SUIVEUR",
          sub: game.party.length ? (game.follower ? "au pied" : "au repos") : "—",
          disabled: !game.party.length,
        },
        { id: "title", label: "TITRE", sub: "SELECT" },
      ],
    };
  }, [battleUi, phase, game, monLine, sacTotal]);

  /* ---------------------------------------------------------- entrées */

  const pick = useCallback(
    (index: number) => {
      const choice = choices.list[index];

      if (phase.kind === "starter") {
        chooseStarter(index);
        return;
      }
      if (phase.kind === "name") {
        const name = draftName.trim() || "Sacha";
        const started = { ...newGame(name) };
        setGame(started);
        setPhase({
          kind: "text",
          lines: [
            `${name} ! C'est un très joli nom.`,
            "Ton aventure commence maintenant. Viens me voir devant le laboratoire !",
          ],
          i: 0,
          then: null,
        });
        return;
      }
      if (phase.kind === "shop") {
        if (!choice) return;
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
          return;
        }
        // `buy` répond lui-même quand la bourse est trop légère.
        buy(phase.counter, index);
        return;
      }
      if (!choice || choice.disabled) return;

      if (phase.kind === "sac") {
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
          return;
        }
        if (choice.id === "back") {
          setCursor(0);
          setPhase({ kind: "sac", on: "objets", message: null });
          return;
        }
        if (phase.on === "objets") {
          setCursor(0);
          setPhase({ kind: "sac", on: "cible", item: choice.id as ItemId, message: null });
          return;
        }
        const soin = applyItem(game, phase.item ?? "potion", Number(choice.id.split(":")[1]));
        setGame(soin.state);
        setCursor(0);
        setPhase({ kind: "sac", on: "objets", message: soin.message });
        return;
      }

      if (phase.kind === "pc") {
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
          return;
        }
        if (choice.id === "back") {
          setCursor(0);
          setPhase({ kind: "pc", on: "menu", message: null });
          return;
        }
        if (phase.on === "menu") {
          setCursor(0);
          setPhase({
            kind: "pc",
            on: choice.id as "retirer" | "deposer" | "ordre",
            message: null,
          });
          return;
        }
        const [quoi, rang] = choice.id.split(":");
        const i = Number(rang);
        const nom = (quoi === "box" ? game.box : game.party)[i]?.name ?? "Le Pokémon";
        setGame(
          quoi === "box"
            ? withdrawMon(game, i)
            : quoi === "dep"
              ? depositMon(game, i)
              : leadMon(game, i),
        );
        setCursor(0);
        setPhase({
          kind: "pc",
          on: "menu",
          message:
            quoi === "box"
              ? `${nom} rejoint votre équipe.`
              : quoi === "dep"
                ? `${nom} est confié au PC, en pleine forme.`
                : `${nom} prend la tête de l'équipe.`,
        });
        return;
      }

      if (battleUi) {
        const ui = battleUi;
        if (ui.view === "menu") {
          if (choice.id === "fight") {
            setCursor(0);
            setPhase({ kind: "battle", ui: { ...ui, view: "moves" } });
          } else if (choice.id === "bag") {
            setCursor(0);
            setPhase({ kind: "battle", ui: { ...ui, view: "bag" } });
          } else if (choice.id === "party") {
            setCursor(firstReady(ui.state));
            setPhase({ kind: "battle", ui: { ...ui, view: "party" } });
          } else if (choice.id === "run") {
            runTurn(ui, tryRun(ui.state));
          }
          return;
        }
        if (ui.view === "moves") {
          if (choice.id === "back") {
            setCursor(0);
            setPhase({ kind: "battle", ui: { ...ui, view: "menu" } });
            return;
          }
          runTurn(ui, playerMove(ui.state, index));
          return;
        }
        if (ui.view === "bag") {
          if (choice.id === "back") {
            setCursor(0);
            setPhase({ kind: "battle", ui: { ...ui, view: "menu" } });
            return;
          }
          const item = choice.id as ItemId;
          // Une Ball part sur l'adversaire ; un soin demande d'abord sa cible.
          if (needsTarget(item)) {
            setCursor(0);
            setPhase({ kind: "battle", ui: { ...ui, view: "bagCible", item } });
          } else {
            runTurn(ui, throwBall(ui.state, item), true);
          }
          return;
        }
        if (ui.view === "bagCible") {
          if (choice.id === "back") {
            setCursor(0);
            setPhase({ kind: "battle", ui: { ...ui, view: "bag" } });
            return;
          }
          runTurn(ui, takeItem(ui.state, ui.item ?? "potion", Number(choice.id.split(":")[1])));
          return;
        }
        if (choice.id === "back") {
          setCursor(0);
          setPhase({ kind: "battle", ui: { ...ui, view: "menu" } });
          return;
        }
        runTurn(ui, switchTo(ui.state, index));
        return;
      }

      if (phase.kind === "carte") {
        setPhase({ kind: "world" });
        return;
      }

      if (phase.kind === "bus") {
        if (!choice || choice.disabled) return;
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
          return;
        }
        const stop = busStopOf(choice.id as MapId);
        if (stop) setPhase({ kind: "voyage", to: stop.map, label: stop.label });
        return;
      }

      if (phase.kind === "world") {
        if (choice.id === "sac") {
          setCursor(0);
          setPhase({ kind: "sac", on: "objets", message: null });
        } else if (choice.id === "carte") setPhase({ kind: "carte" });
        else if (choice.id === "dex") onOpenDex();
        else if (choice.id === "save") save();
        else if (choice.id === "music") setGame((g) => ({ ...g, music: !g.music }));
        else if (choice.id === "suiveur") setGame((g) => ({ ...g, follower: !g.follower }));
        else if (choice.id === "title") onExit();
      }
    },
    [choices, phase, game, battleUi, draftName, chooseStarter, runTurn, save, buy, firstReady, onOpenDex, onExit],
  );

  const moveCursor = useCallback(
    (dx: number, dy: number) => {
      const count = choices.list.length;
      if (!count) return;
      const step = choices.layout === "grid" ? dx + dy * 2 : choices.layout === "list" ? dy : dx;
      if (!step) return;
      setCursor((c) => Math.min(Math.max(c + step, 0), count - 1));
    },
    [choices],
  );

  const press = useCallback(
    (button: DsButton, repeat = false) => {
      if (!active) return;

      // La séquence secrète ne se compose qu'au pas, et jamais en plein
      // combat : remplacer l'équipe en cours de duel casserait la partie.
      if (!repeat && trackCheat(button) && phase.kind === "world") {
        grantDreamTeam();
        return;
      }

      switch (phase.kind) {
        case "intro":
          if (button === "a" || button === "start") {
            const step = phase.step + 1;
            if (step >= INTRO.length) {
              setPhase({ kind: "name" });
              setTimeout(() => nameRef.current?.focus(), 40);
            } else {
              setPhase({ kind: "intro", step });
            }
          }
          return;

        case "name":
          if (button === "a" || button === "start") pick(0);
          return;

        case "text":
          if (button === "a" || button === "b" || button === "start") {
            const i = phase.i + 1;
            if (i < phase.lines.length) setPhase({ ...phase, i });
            else resolveThen(phase.then);
          }
          return;

        case "starter":
          if (button === "left") moveCursor(-1, 0);
          else if (button === "right") moveCursor(1, 0);
          else if (button === "a") pick(cursor);
          return;

        case "shop":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") setPhase({ kind: "world" });
          return;

        case "sac":
        case "pc":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") {
            setCursor(0);
            // B remonte d'un cran : une liste rend la main au menu, le menu ferme.
            if (phase.on === "objets" || phase.on === "menu") setPhase({ kind: "world" });
            else if (phase.kind === "sac") setPhase({ kind: "sac", on: "objets", message: null });
            else setPhase({ kind: "pc", on: "menu", message: null });
          }
          return;

        case "battle": {
          const ui = phase.ui;
          if (ui.view === "message") {
            if (button === "a" || button === "b" || button === "start") advanceBattle(ui);
            return;
          }
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "left") moveCursor(-1, 0);
          else if (button === "right") moveCursor(1, 0);
          else if (button === "a") pick(cursor);
          else if (button === "b" && ui.view !== "menu" && !ui.state.mustSwitch) {
            setCursor(0);
            setPhase({ kind: "battle", ui: { ...ui, view: "menu" } });
          }
          return;
        }

        case "carte":
          if (button === "a" || button === "b" || button === "start") {
            setPhase({ kind: "world" });
          }
          return;

        case "bus":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") setPhase({ kind: "world" });
          return;

        // Le trajet suit son cours : aucune commande ne l'interrompt.
        case "voyage":
          return;

        case "world":
          if (button === "a") interact();
          else if (button === "x") save();
          else if (button === "y") onOpenDex();
          else if (button === "start") setPhase({ kind: "carte" });
          else if (button === "l" || button === "r") toggleBike();
          else if (button === "select") onExit();
          return;
      }
    },
    [active, phase, cursor, pick, moveCursor, advanceBattle, interact, save, toggleBike, trackCheat, grantDreamTeam, onOpenDex, onExit, resolveThen],
  );

  /* ---------------------------------------------------------- musique */

  const track: TrackId = useMemo(() => {
    if (phase.kind === "battle") {
      return phase.ui.origin.kind === "dresseur" ? "dresseur" : "combat";
    }
    return trackForMap(game.map);
  }, [phase, game.map]);

  useEffect(() => {
    if (!active) {
      music.stop();
      return;
    }
    music.setMuted(!game.music);
    // Un jingle a la priorité : il rendra la main tout seul.
    const playing = music.playing;
    if (playing && !TRACKS[playing].loop) return;
    music.play(track);
  }, [active, track, game.music]);

  /* ------------------------------------------------------------ rendu */

  const dialogue =
    phase.kind === "text"
      ? phase.lines[phase.i]
      : phase.kind === "shop"
        ? (phase.message ?? "Que puis-je vous servir ?")
        : phase.kind === "sac"
          ? (phase.message ?? "Que sortez-vous du sac ?")
          : phase.kind === "pc"
            ? (phase.message ?? "Système de stockage. Que souhaitez-vous faire ?")
            : null;

  /**
   * Sans clavier, il faut pouvoir avancer le texte en touchant la dalle :
   * cette couche transparente double le bouton A partout où l'on attend
   * simplement « continuer ».
   */
  const tapToAdvance =
    phase.kind === "intro" ||
    phase.kind === "text" ||
    (phase.kind === "battle" && phase.ui.view === "message");

  const tap = tapToAdvance ? (
    <button
      type="button"
      className="tap-layer"
      onClick={() => press("a")}
      aria-label="Continuer"
    />
  ) : null;

  const top = (() => {
    if (phase.kind === "intro" || phase.kind === "name") {
      const line = phase.kind === "intro" ? INTRO[phase.step] : "…comment t'appelles-tu ?";
      return (
        <div className="intro">
          <img
            className="intro__mon"
            src={animatedUrl(517) ?? staticUrl(517)}
            alt=""
            onError={(e) => {
              e.currentTarget.src = staticUrl(517);
            }}
          />
          <div className="intro__box">
            <p className="intro__who">Professeur Keteleeria</p>
            <p className="intro__line">{line}</p>
            {phase.kind === "intro" && (
              <span className="intro__next" aria-hidden="true">
                ▼
              </span>
            )}
          </div>
          {tap}
        </div>
      );
    }

    if (phase.kind === "carte") return <RegionMap current={game.map} />;

    if (phase.kind === "voyage") return <BusRide destination={phase.label} />;

    if (phase.kind === "battle") {
      const foeTrainer =
        phase.ui.showTrainer && phase.ui.origin.kind === "dresseur"
          ? (npcById(phase.ui.origin.npc)?.sprite ?? null)
          : null;
      return (
        <>
          <BattleView
            state={phase.ui.state}
            message={phase.ui.queue[0] ?? null}
            throwing={phase.ui.throwing}
            trainerSprite={foeTrainer}
          />
          {tap}
        </>
      );
    }

    return (
      <div className="scene">
        <WorldView
          mapId={game.map}
          npcs={npcs}
          player={player}
          held={held}
          paused={phase.kind !== "world"}
          riding={game.riding}
          follower={walker}
          onStep={onStep}
        />
        <span className="scene__zone">{MAPS[game.map].name}</span>
        {dialogue && (
          <div className="scene__box">
            <p>{dialogue}</p>
            {phase.kind === "text" && (
              <span className="scene__next" aria-hidden="true">
                ▼
              </span>
            )}
          </div>
        )}
        {tap}
      </div>
    );
  })();

  const bottom = (
    <TouchPanel
      title={choices.title}
      hint={choices.hint}
      choices={choices.list}
      layout={choices.layout}
      // Dans le monde et pendant le texte, rien n'est surligné : la croix
      // sert à marcher, et A ne fait qu'avancer les messages.
      cursor={
        phase.kind === "world" || battleUi?.view === "message" ? -1 : cursor
      }
      onPick={pick}
      game={game}
      party={battleUi ? battleUi.state.party : game.party}
      active={battleUi ? battleUi.state.active : -1}
      starters={phase.kind === "starter" ? STARTERS : undefined}
      showParty={phase.kind !== "intro" && phase.kind !== "name"}
      naming={phase.kind === "name"}
      nameValue={draftName}
      onNameChange={setDraftName}
      nameRef={nameRef}
    />
  );

  return {
    top,
    bottom,
    press,
    begin,
    setHeld,
    seen: game.seen,
    // Quand une seule dalle tient à l'écran, la console montre celle-ci.
    focus:
      phase.kind === "starter" ||
      phase.kind === "shop" ||
      phase.kind === "sac" ||
      phase.kind === "pc" ||
      phase.kind === "bus" ||
      phase.kind === "name" ||
      (battleUi && battleUi.view !== "message")
        ? "bottom"
        : "top",
    // Avec six cent quarante-neuf espèces dans les herbes, l'écart entre ce
    // que l'on croise et ce que l'on attrape mérite d'être affiché.
    count: game.party.length
      ? `${game.party.length}/6 · ${game.seen.length} vus · ${game.caught.length} pris`
      : "AUCUN POKéMON",
  };
}
