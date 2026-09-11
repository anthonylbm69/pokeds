"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animatedUrl, cryUrl, staticUrl } from "@/lib/pokeapi";
import { TRACKS, music, trackForMap, type TrackId } from "@/lib/game/music";
import { atNight, momentNow } from "@/lib/game/heure";
import { WILD_POOL } from "@/lib/game/dex";
import { hatch, walkDaycare, walkEggs } from "@/lib/game/elevage";
import { MAX_LEVEL, species, type MoveId } from "@/lib/game/data";
import {
  ITEM_ORDER,
  countOf,
  ITEMS,
  ctMove,
  isHeld,
  isPP,
  type ItemId,
} from "@/lib/game/items";
import {
  activeMon,
  createMon,
  healMon,
  isKo,
  maxHp,
  startTrainer,
  startWild,
  type BattleState,
  type Mon,
} from "@/lib/game/battle";
import {
  MAPS,
  STEP,
  busStopOf,
  followerSpot,
  isWater,
  rollEncounter,
  rollWaterEncounter,
  seesPlayer,
  signAt,
  tileAt,
  tileChar,
  warpAt,
  type MapId,
  type NpcSpec,
} from "@/lib/game/world";
import {
  PARTY_MAX,
  STARTERS,
  addCaught,
  counterStarter,
  followerLine,
  depositMon,
  giveStarter,
  canSurf,
  hasFlag,
  healParty,
  loadGame,
  markSeen,
  newGame,
  leadMon,
  exportName,
  exportSave,
  importSave,
  saveGame,
  applyItem,
  applyPP,
  enterHallOfFame,
  relearnMove,
  giveHeld,
  takeHeld,
  teachMove,
  towerFoe,
  towerLose,
  towerReward,
  towerWin,
  withDreamTeam,
  withdrawMon,
  withFlag,
  DREAM_LEVEL,
  type BoxOrder,
  type GameState,
  type Slot,
} from "@/lib/game/state";
import type { DsButton, ModeParts } from "../DSConsole";
import BattleView from "./BattleView";
import BusRide from "./BusRide";
import RegionMap from "./RegionMap";
import TouchPanel from "./TouchPanel";
import {
  battleAction,
  battleScreen,
  firstReady,
  type BattleUi,
} from "./battleFlow";
import {
  INTRO,
  STOCK,
  worldScreen,
  type Counter,
  type Phase,
  type Then,
} from "./worldFlow";
import WorldView, { newPlayer, type PlayerPos } from "./WorldView";

export type GameParts = ModeParts & {
  /** Lance une partie neuve ou reprend la sauvegarde. */
  begin: (mode: "nouvelle" | "continuer") => void;
  /** La coque y dépose les boutons maintenus : c'est ce qui fait marcher. */
  setHeld: (buttons: ReadonlySet<DsButton>) => void;
  /** Espèces rencontrées : le Pokédex ouvert depuis le jeu s'y limite. */
  seen: number[];
};

const ENCOUNTER_RATE = 0.14;

/** Durée du trajet en autocar, animation comprise. */
const RIDE_MS = 2800;

/**
 * Une fois la Ligue tombée, les dresseurs déjà battus veulent leur revanche,
 * et reviennent bien plus haut. Une seule fois chacun.
 */
const REMATCH_BOOST = 25;

/** Nombre d'espèces attrapées qui vaut la Master Ball du Professeur. */
const DEX_REWARD = 60;

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
  /** Pokémon tout juste capturé, à qui l'on proposera un surnom. */
  const [aBaptiser, setABaptiser] = useState<Mon | null>(null);
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

  // Le temps de jeu, compté à la minute tant que la console est allumée.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(
      () => setGame((g) => ({ ...g, played: g.played + 60 })),
      60_000,
    );
    return () => window.clearInterval(id);
  }, [active]);

  /* ------------------------------------------------------------- PNJ */

  const map = MAPS[game.map];

  const npcs = useMemo<NpcSpec[]>(
    () =>
      map.npcs.filter(
        (n) =>
          // Certains n'apparaissent qu'une fois la Ligue tombée…
          (n.needs ?? []).every((flag) => hasFlag(game, flag)) &&
          // …et un légendaire quitte les lieux l'affaire réglée.
          (!n.mon || !hasFlag(game, `battu:${n.id}`)),
      ),
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
      // Champion : les vaincus d'hier redemandent du service, en plus fort.
      if (
        npc.trainer &&
        hasFlag(game, "insigne:ligue") &&
        !hasFlag(game, `revanche:${npc.id}`)
      ) {
        setPhase({
          kind: "text",
          lines: [
            `${npc.trainer.name} vous barre la route, un sourire aux lèvres.`,
            "« On m'a dit que tu avais battu Eren. Voyons voir ça. »",
          ],
          i: 0,
          then: { do: "revanche", npc: npc.id },
        });
        return;
      }
      if (npc.daycare) {
        setPhase({ kind: "text", lines: npc.lines, i: 0, then: { do: "pension" } });
        return;
      }
      if (npc.relearn) {
        setPhase({ kind: "text", lines: npc.lines, i: 0, then: { do: "maitre" } });
        return;
      }
      if (npc.tower) {
        setPhase({ kind: "text", lines: npc.lines, i: 0, then: { do: "tour" } });
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
        } else if (game.caught.length >= DEX_REWARD && !hasFlag(game, "master")) {
          setGame((g) => ({
            ...withFlag(g, "master"),
            bag: { ...g.bag, masterball: countOf(g.bag, "masterball") + 1 },
          }));
          setPhase({
            kind: "text",
            lines: [
              `${game.caught.length} espèces enregistrées ! C'est du travail de chercheur.`,
              "Tiens, prends ceci. Je n'en avais qu'une.",
              "Vous obtenez une Master Ball !",
              "Elle ne rate jamais. Choisis bien sur qui tu la lances.",
            ],
            i: 0,
            then: null,
          });
        } else {
          setPhase({
            kind: "text",
            lines: [
              "Alors, comment se porte ton Pokémon ?",
              game.caught.length >= DEX_REWARD
                ? "Ton Pokédex fait plaisir à voir."
                : `${game.caught.length} espèces sur les ${DEX_REWARD} qu'il me faudrait. Continue !`,
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
    (npcId: string, revanche = false) => {
      const npc = npcById(npcId);
      if (!npc?.trainer) return;
      const boost = revanche ? REMATCH_BOOST : 0;
      const team = npc.trainer.team.map((t) =>
        createMon(t.id, Math.min(MAX_LEVEL, t.level + boost)),
      );
      // À l'Arène, l'as de la Championne répond au starter du joueur.
      if (npc.trainer.mirror && team.length) {
        const last = team[team.length - 1];
        team[team.length - 1] = createMon(counterStarter(game.starter), last.level);
      }
      const state = startTrainer(game.party, team, {
        name: npc.trainer.name,
        title: npc.trainer.title,
        // Une revanche paie le double : ils reviennent nettement plus forts.
        reward: npc.trainer.reward * (revanche ? 2 : 1),
      }, game.bag);
      openBattle(
        state,
        [
          `${npc.trainer.title} ${npc.trainer.name} veut se battre !`,
          `${npc.trainer.name} envoie ${state.foe.name} !`,
          `En avant, ${activeMon(state).name} !`,
        ],
        { kind: "dresseur", npc: npcId, revanche },
      );
    },
    [game, npcById, openBattle],
  );

  /**
   * Un duel de la Tour. L'adversaire est tiré au sort dans le Pokédex, à un
   * niveau et un effectif qui montent avec la série.
   */
  const startTowerBattle = useCallback(() => {
    const foe = towerFoe(game.towerRun);
    const team = Array.from({ length: foe.team }, () =>
      createMon(WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)], foe.level),
    );
    const state = startTrainer(
      game.party,
      team,
      { name: foe.name, title: "As de la Tour", reward: towerReward(game.towerRun) },
      game.bag,
    );
    openBattle(
      state,
      [
        `Duel n°${game.towerRun + 1} — ${foe.name} entre en lice !`,
        `${foe.name} envoie ${state.foe.name} !`,
        `En avant, ${activeMon(state).name} !`,
      ],
      { kind: "dresseur", npc: "hotesse-tour", tour: true },
    );
  }, [game, openBattle]);

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
        // Le baptême attend la fin des messages du combat.
        setABaptiser(s.caught);
      }

      if (s.outcome === "victoire") music.play("victoire");

      /** La Ligue vient de tomber : le texte se termine au Panthéon. */
      let sacre = false;

      // Un Pokémon posté cède la place dès qu'il est vaincu ou capturé.
      if (
        ui.origin.kind === "sauvage" &&
        ui.origin.npc &&
        (s.outcome === "victoire" || s.outcome === "capture")
      ) {
        next = withFlag(next, `battu:${ui.origin.npc}`);
      }

      // La Tour tient ses propres comptes : ni drapeau, ni PNJ battu.
      if (ui.origin.kind === "dresseur" && ui.origin.tour) {
        if (s.outcome === "victoire") {
          next = towerWin(next);
          lines.push(
            `Série de ${next.towerRun} ! ${towerReward(next.towerRun - 1)} P vous sont remis.`,
          );
        } else if (s.outcome === "defaite") {
          next = towerLose(next);
          lines.push("La série s'arrête là. Le record, lui, reste acquis.");
        }
        setGame(next);
        setPhase(
          s.outcome === "victoire"
            ? { kind: "text", lines, i: 0, then: { do: "tour" } }
            : { kind: "text", lines, i: 0, then: null },
        );
        return;
      }

      if (s.outcome === "victoire" && ui.origin.kind === "dresseur") {
        const npc = npcById(ui.origin.npc);
        next = withFlag(next, `battu:${ui.origin.npc}`);
        if (ui.origin.revanche) next = withFlag(next, `revanche:${ui.origin.npc}`);
        next = { ...next, money: next.money + (s.trainer?.reward ?? 0) };
        if (npc?.trainer) {
          lines.push(...npc.trainer.defeat, ...npc.trainer.after);
          if (npc.trainer.badge) next = withFlag(next, `insigne:${npc.trainer.badge}`);
          // Battre la Ligue vaut le sacre : on fige l'équipe du jour.
          if (npc.trainer.badge === "ligue") {
            next = enterHallOfFame(next);
            sacre = true;
          }
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
      if (sacre) {
        setPhase({ kind: "text", lines, i: 0, then: { do: "pantheon" } });
        return;
      }
      setPhase(lines.length ? { kind: "text", lines, i: 0, then: null } : { kind: "world" });
    },
    [game, npcById],
  );

  /** Premier Pokémon envoyable : le curseur ne se pose jamais sur un K.O. */
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
    [finishBattle],
  );

  const runTurn = useCallback(
    (ui: BattleUi, turn: { state: BattleState; messages: string[] }, throwing = false) => {
      // Le bruitage suit ce que le tour a produit, dans l'ordre d'importance.
      const dit = turn.messages.join(" ");
      if (throwing) music.sfx("ball");
      else if (turn.state.outcome === "capture") music.sfx("capture");
      else if (dit.includes("K.O.")) music.sfx("ko");
      else if (dit.includes("super efficace")) music.sfx("efficace");
      else if (dit.includes("récupère") || dit.includes("altération")) music.sfx("soin");
      else if (dit.includes("utilise")) music.sfx("coup");
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

      // Chaque pas fait avancer la Pension et rapproche les œufs portés. Sans
      // œuf ni pensionnaire, il n'y a rien à compter : on ne touche à rien.
      if (game.eggs.length || game.daycare.mons.length) {
        const eggs = walkEggs(game.eggs);
        const eclos = eggs.filter((e) => e.steps <= 0);
        const daycare = walkDaycare(game.daycare);

        if (!eclos.length) {
          setGame((g) => ({ ...g, daycare, eggs }));
        } else {
          // Un œuf arrivé à terme devient un Pokémon : dans l'équipe s'il y a
          // de la place, au PC sinon.
          let suite: GameState = {
            ...game,
            daycare,
            eggs: eggs.filter((e) => e.steps > 0),
          };
          const nes: string[] = [];
          for (const oeuf of eclos) {
            const petit = hatch(oeuf);
            nes.push(petit.name);
            suite = addCaught(suite, petit);
          }
          setGame(suite);
          // Une éclosion arrive en pleine marche, loin de toute porte : on
          // l'enregistre sans attendre, sinon un onglet fermé l'effacerait.
          saveGame({
            ...suite,
            x: player.current.x,
            y: player.current.y,
            dir: player.current.dir,
          });
          setPhase({
            kind: "text",
            lines: [
              "Tiens ? L'œuf bouge…",
              `Il éclôt ! ${nes.join(", ")} vient au monde.`,
            ],
            i: 0,
            then: null,
          });
        }
      }

      const dispo = game.party.some((m) => !isKo(m));

      // En mer, la faune est la même partout : les espèces d'eau du Pokédex.
      if (game.surfing && isWater(current, x, y) && dispo) {
        if (Math.random() < ENCOUNTER_RATE) {
          const roll = rollWaterEncounter();
          startWildBattle(roll.id, roll.level);
        }
        return;
      }

      if (tileChar(current, x, y) === "," && dispo) {
        if (Math.random() < ENCOUNTER_RATE) {
          const roll = rollEncounter(current);
          // La nuit fait sortir d'autres bestioles que le plein jour.
          if (roll) startWildBattle(atNight(roll.id, momentNow()), roll.level);
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

    // L'eau devant soi : on embarque, si l'on sait surfer et qu'on a de
    // quoi porter. À l'inverse, depuis l'eau, on regagne la terre ferme.
    if (isWater(map, tx, ty) && !game.surfing) {
      const porteur = game.party.find((m) => !isKo(m));
      if (!canSurf(game)) {
        setPhase({
          kind: "text",
          lines: [
            "L'eau est profonde et le courant vif.",
            "Sans l'insigne Roc, personne ne s'y aventure.",
          ],
          i: 0,
          then: null,
        });
        return;
      }
      if (!porteur) {
        setPhase({
          kind: "text",
          lines: ["Aucun Pokémon en état de vous porter."],
          i: 0,
          then: null,
        });
        return;
      }
      setGame((g) => ({ ...g, surfing: true, riding: false }));
      setPhase({
        kind: "text",
        lines: [`${porteur.name} vous prend sur son dos !`],
        i: 0,
        then: null,
      });
      return;
    }
    if (game.surfing && !isWater(map, tx, ty) && tileAt(map, tx, ty) && !tileAt(map, tx, ty)!.solid) {
      setGame((g) => ({ ...g, surfing: false }));
      setPhase({ kind: "text", lines: ["Vous regagnez la terre ferme."], i: 0, then: null });
      return;
    }

    // Le Pokémon de tête occupe la case que l'on vient de quitter.
    const suiveur = walker ? followerSpot(player.current) : null;
    if (suiveur && Math.round(suiveur.x) === tx && Math.round(suiveur.y) === ty) {
      const lead = game.party.find((m) => !isKo(m));
      if (lead) {
        setPhase({ kind: "text", lines: followerLine(lead), i: 0, then: null });
        return;
      }
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
  }, [map, talk, game, walker]);

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

  /** L'état à écrire : la position vit dans une ref, pas dans `game`. */
  const snapshot = useCallback(
    (): GameState => ({
      ...game,
      x: player.current.x,
      y: player.current.y,
      dir: player.current.dir,
    }),
    [game],
  );

  /** Télécharge la partie. Le navigateur ne sait pas écrire ailleurs. */
  const downloadSave = useCallback(() => {
    const state = snapshot();
    const blob = new Blob([exportSave(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = exportName(state);
    lien.click();
    // Le navigateur garde l'objet tant qu'on ne le libère pas.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [snapshot]);

  /** Ouvre le sélecteur de fichier et charge ce qu'on y dépose. */
  const uploadSave = useCallback(() => {
    const champ = document.createElement("input");
    champ.type = "file";
    champ.accept = "application/json,.json";
    champ.onchange = async () => {
      const fichier = champ.files?.[0];
      if (!fichier) return;
      const lu = importSave(await fichier.text());
      if ("erreur" in lu) {
        setPhase({ kind: "sauvegarde", message: lu.erreur });
        return;
      }
      setGame(lu.state);
      player.current = newPlayer(lu.state.x, lu.state.y, lu.state.dir);
      setPhase({
        kind: "text",
        lines: [
          `Partie de ${lu.state.name || "Dresseur"} chargée.`,
          "Pensez à l'enregistrer dans un emplacement.",
        ],
        i: 0,
        then: null,
      });
    };
    champ.click();
  }, []);

  const save = useCallback(() => {
    setCursor(0);
    setPhase({ kind: "sauvegarde", message: null });
  }, []);

  /** Écrit la partie dans l'emplacement choisi. */
  const saveTo = useCallback(
    (slot: Slot) => {
      const next = snapshot();
      setGame(next);
      saveGame(next, slot);
      setPhase({
        kind: "text",
        lines: [
          `${next.name || "Dresseur"} enregistre dans l'emplacement ${slot}…`,
          "C'est fait !",
        ],
        i: 0,
        then: null,
      });
    },
    [snapshot],
  );

  /* -------------------------------------------------- fin de dialogue */

  const resolveThen = useCallback(
    (then: Then | null) => {
      // Un Pokémon vient d'être pris : on lui propose un surnom avant de
      // rendre la main au monde.
      if (aBaptiser) {
        const pris = aBaptiser;
        setABaptiser(null);
        setDraftName("");
        setPhase({ kind: "surnom", mon: pris });
        setTimeout(() => nameRef.current?.focus(), 40);
        return;
      }
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
        case "tour":
          setCursor(0);
          setPhase({ kind: "tour" });
          break;
        case "pension":
          setCursor(0);
          setPhase({ kind: "pension", on: "menu", message: null });
          break;
        case "maitre":
          setCursor(0);
          setPhase({ kind: "maitre", on: "qui", message: null });
          break;
        case "pantheon":
          setCursor(0);
          // Le dernier inscrit est celui que l'on vient d'ajouter.
          setPhase({ kind: "pantheon", index: Math.max(0, game.hall.length - 1) });
          break;
        case "revanche":
          startTrainerBattle(then.npc, true);
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
    [game, aBaptiser, startTrainerBattle, startStaticBattle],
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
    if (game.surfing) return;
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

  const choices = useMemo(
    () =>
      battleUi
        ? battleScreen(battleUi, monLine)
        : worldScreen(phase, game, monLine, sacTotal),
    [battleUi, phase, game, monLine, sacTotal],
  );

  /* ---------------------------------------------------------- entrées */

  const pick = useCallback(
    (index: number) => {
      const choice = choices.list[index];
      // Un refus se distingue à l'oreille d'une validation.
      music.sfx(!choice || choice.disabled ? "refus" : "valider");

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

      if (phase.kind === "surnom") {
        const surnom = draftName.trim().slice(0, 12);
        if (surnom) {
          const cible = phase.mon.uid;
          const renomme = (m: Mon) => (m.uid === cible ? { ...m, name: surnom } : m);
          setGame((g) => ({
            ...g,
            party: g.party.map(renomme),
            box: g.box.map(renomme),
          }));
        }
        setDraftName("");
        setPhase({ kind: "world" });
        return;
      }

      if (phase.kind === "tour") {
        if (choice.id === "duel") startTowerBattle();
        else setPhase({ kind: "world" });
        return;
      }

      if (phase.kind === "carte-dresseur") {
        if (choice.id === "pantheon") {
          setCursor(0);
          setPhase({ kind: "pantheon", index: Math.max(0, game.hall.length - 1) });
          return;
        }
        setPhase({ kind: "world" });
        return;
      }

      if (phase.kind === "pension") {
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
          return;
        }
        if (choice.id === "back") {
          setCursor(0);
          setPhase({ kind: "pension", on: "menu", message: null });
          return;
        }
        if (choice.id === "confier") {
          setCursor(0);
          setPhase({ kind: "pension", on: "confier", message: null });
          return;
        }
        if (choice.id === "reprendre") {
          setCursor(0);
          setPhase({ kind: "pension", on: "reprendre", message: null });
          return;
        }
        if (choice.id === "oeuf") {
          const oeuf = game.daycare.ready;
          if (!oeuf) return;
          setGame((g) => ({
            ...g,
            eggs: [...g.eggs, oeuf],
            daycare: { ...g.daycare, ready: null },
          }));
          setCursor(0);
          setPhase({
            kind: "pension",
            on: "menu",
            message: "Vous recevez un œuf ! Marchez, il finira par bouger.",
          });
          return;
        }

        const [quoi, rang] = choice.id.split(":");
        const i = Number(rang);
        if (quoi === "confier") {
          const mon = game.party[i];
          setGame((g) => ({
            ...g,
            party: g.party.filter((_, k) => k !== i),
            daycare: { ...g.daycare, mons: [...g.daycare.mons, healMon(mon)] },
          }));
          setCursor(0);
          setPhase({
            kind: "pension",
            on: "menu",
            message: `${mon.name} reste à la Pension. Il y sera soigné.`,
          });
          return;
        }
        if (quoi === "reprendre") {
          const mon = game.daycare.mons[i];
          setGame((g) => ({
            ...g,
            party: [...g.party, mon],
            // Reprendre un pensionnaire annule l'œuf en préparation.
            daycare: {
              ...g.daycare,
              mons: g.daycare.mons.filter((_, k) => k !== i),
              steps: 0,
            },
          }));
          setCursor(0);
          setPhase({
            kind: "pension",
            on: "menu",
            message: `${mon.name} vous revient.`,
          });
          return;
        }
        return;
      }

      if (phase.kind === "maitre") {
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
          return;
        }
        if (choice.id === "back") {
          setCursor(0);
          setPhase({ kind: "maitre", on: "qui", message: null });
          return;
        }
        const [quoi, valeur] = choice.id.split(":");
        if (quoi === "qui") {
          setCursor(0);
          setPhase({ kind: "maitre", on: "quoi", cible: Number(valeur), message: null });
          return;
        }
        if (quoi === "move") {
          const cible = phase.cible ?? 0;
          const move = valeur as MoveId;
          // Quatre attaques déjà : il faut en céder une.
          if (game.party[cible].moves.length >= 4) {
            setCursor(0);
            setPhase({ kind: "maitre", on: "oubli", cible, move, message: null });
            return;
          }
          const appris = relearnMove(game, cible, move, -1);
          setGame(appris.state);
          setCursor(0);
          setPhase({ kind: "maitre", on: "qui", message: appris.message });
          return;
        }
        if (quoi === "oubli") {
          const appris = relearnMove(
            game,
            phase.cible ?? 0,
            phase.move ?? "charge",
            Number(valeur),
          );
          setGame(appris.state);
          setCursor(0);
          setPhase({ kind: "maitre", on: "qui", message: appris.message });
          return;
        }
        return;
      }

      if (phase.kind === "pantheon") {
        setCursor(0);
        setPhase({ kind: "carte-dresseur" });
        return;
      }

      if (phase.kind === "sauvegarde") {
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
        } else if (choice.id === "exporter") {
          downloadSave();
          setPhase({ kind: "sauvegarde", message: "Fichier téléchargé." });
        } else if (choice.id === "importer") {
          uploadSave();
        } else {
          saveTo(Number(choice.id.split(":")[1]) as Slot);
        }
        return;
      }

      if (phase.kind === "tri") {
        if (choice.id !== "back") {
          setGame((g) => ({ ...g, boxOrder: choice.id.split(":")[1] as BoxOrder }));
        }
        setCursor(0);
        setPhase({ kind: "pc", on: "menu", message: null });
        return;
      }

      if (phase.kind === "equipe") {
        if (choice.id === "leave") {
          setPhase({ kind: "world" });
          return;
        }
        setCursor(0);
        setPhase({ kind: "fiche", index: Number(choice.id.split(":")[1]) });
        return;
      }

      if (phase.kind === "fiche") {
        if (choice.id === "tenu") {
          // La ligne n'est active que s'il porte quelque chose.
          setGame(takeHeld(game, phase.index).state);
          return;
        }
        setCursor(0);
        setPhase({ kind: "equipe" });
        return;
      }

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

        const item = phase.item ?? "potion";
        const move = ctMove(item);

        if (phase.on === "oubli") {
          const appris = teachMove(game, item, phase.cible ?? 0, Number(choice.id.split(":")[1]));
          setGame(appris.state);
          setCursor(0);
          setPhase({ kind: "sac", on: "objets", message: appris.message });
          return;
        }

        if (isPP(item)) {
          const [quoi, rang] = choice.id.split(":");
          // Premier passage : on choisit le porteur. Second : l'attaque.
          if (quoi === "mon") {
            const cible = Number(rang);
            if (ITEMS[item].pp?.toutes) {
              const soin = applyPP(game, item, cible, 0);
              setGame(soin.state);
              setCursor(0);
              setPhase({ kind: "sac", on: "objets", message: soin.message });
              return;
            }
            setCursor(0);
            setPhase({ kind: "sac", on: "cible", item, cible, message: null });
            return;
          }
          const soin = applyPP(game, item, phase.cible ?? 0, Number(rang));
          setGame(soin.state);
          setCursor(0);
          setPhase({ kind: "sac", on: "objets", message: soin.message });
          return;
        }

        if (isHeld(item)) {
          const donne = giveHeld(game, item, Number(choice.id.split(":")[1]));
          setGame(donne.state);
          setCursor(0);
          setPhase({ kind: "sac", on: "objets", message: donne.message });
          return;
        }

        if (move) {
          const cible = Number(choice.id.split(":")[1]);
          // Quatre attaques déjà : il faut en céder une.
          if (game.party[cible].moves.length >= 4) {
            setCursor(0);
            setPhase({ kind: "sac", on: "oubli", item, cible, message: null });
            return;
          }
          const appris = teachMove(game, item, cible, -1);
          setGame(appris.state);
          setCursor(0);
          setPhase({ kind: "sac", on: "objets", message: appris.message });
          return;
        }

        const soin = applyItem(game, item, Number(choice.id.split(":")[1]));
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
          if (choice.id === "trier") {
            setPhase({ kind: "tri" });
            return;
          }
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
        const action = battleAction(battleUi, choice, index);
        if (action.do === "tour") {
          runTurn(battleUi, action.turn, action.throwing);
        } else if (action.do === "vue") {
          setCursor(action.cursor ?? 0);
          setPhase({
            kind: "battle",
            ui: { ...battleUi, view: action.view, item: action.item ?? battleUi.item },
          });
        }
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
        } else if (choice.id === "carte-dresseur") {
          setCursor(0);
          setPhase({ kind: "carte-dresseur" });
        } else if (choice.id === "equipe") {
          setCursor(0);
          setPhase({ kind: "equipe" });
        } else if (choice.id === "carte") setPhase({ kind: "carte" });
        else if (choice.id === "dex") onOpenDex();
        else if (choice.id === "save") save();
        else if (choice.id === "music") setGame((g) => ({ ...g, music: !g.music }));
        else if (choice.id === "suiveur") setGame((g) => ({ ...g, follower: !g.follower }));
        else if (choice.id === "title") onExit();
      }
    },
    [choices, phase, game, battleUi, draftName, chooseStarter, runTurn, startTowerBattle, save, saveTo, downloadSave, uploadSave, buy, onOpenDex, onExit],
  );

  const moveCursor = useCallback(
    (dx: number, dy: number) => {
      const count = choices.list.length;
      if (!count) return;
      music.sfx("choix");
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

        case "pension":
        case "maitre":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") {
            setCursor(0);
            // B remonte d'un cran, puis ferme.
            if (phase.kind === "pension") {
              if (phase.on === "menu") setPhase({ kind: "world" });
              else setPhase({ kind: "pension", on: "menu", message: null });
            } else if (phase.on === "qui") setPhase({ kind: "world" });
            else setPhase({ kind: "maitre", on: "qui", message: null });
          }
          return;

        case "pantheon":
          // Les flèches feuillettent les sacres, du premier au dernier.
          if ((button === "left" || button === "right") && game.hall.length > 1) {
            const pas = button === "right" ? 1 : -1;
            const suivant =
              (phase.index + pas + game.hall.length) % game.hall.length;
            setPhase({ kind: "pantheon", index: suivant });
          } else if (button === "a" || button === "b") {
            setCursor(0);
            setPhase({ kind: "carte-dresseur" });
          }
          return;

        case "tour":
        case "carte-dresseur":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") setPhase({ kind: "world" });
          return;

        case "sauvegarde":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") setPhase({ kind: "world" });
          return;

        case "tri":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") {
            setCursor(0);
            setPhase({ kind: "pc", on: "menu", message: null });
          }
          return;

        case "equipe":
          if (button === "up") moveCursor(0, -1);
          else if (button === "down") moveCursor(0, 1);
          else if (button === "a") pick(cursor);
          else if (button === "b") setPhase({ kind: "world" });
          return;

        case "fiche":
          // Les flèches feuillettent l'équipe sans repasser par la liste.
          if (button === "left" || button === "right") {
            const pas = button === "right" ? 1 : -1;
            const suivant = (phase.index + pas + game.party.length) % game.party.length;
            setPhase({ kind: "fiche", index: suivant });
          } else if (button === "a" || button === "b") {
            setCursor(0);
            setPhase({ kind: "equipe" });
          }
          return;

        case "surnom":
          if (button === "a" || button === "start") pick(0);
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
    [active, phase, cursor, game.party.length, game.hall.length, pick, moveCursor, advanceBattle, interact, save, toggleBike, trackCheat, grantDreamTeam, onOpenDex, onExit, resolveThen],
  );

  /* ---------------------------------------------------------- musique */

  const track: TrackId = useMemo(() => {
    if (phase.kind === "battle") {
      return phase.ui.origin.kind === "dresseur" ? "dresseur" : "combat";
    }
    return trackForMap(game.map, game.surfing);
  }, [phase, game.map, game.surfing]);

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
        : phase.kind === "pension"
        ? (phase.message ?? "Que puis-je pour vous ?")
        : phase.kind === "maitre"
          ? (phase.message ?? "Quelle attaque faut-il réveiller ?")
          : phase.kind === "sauvegarde"
        ? (phase.message ?? "Où voulez-vous enregistrer votre partie ?")
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
          surfing={game.surfing}
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
      naming={phase.kind === "name" || phase.kind === "surnom"}
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
      phase.kind === "equipe" ||
      phase.kind === "tri" ||
      phase.kind === "sauvegarde" ||
      phase.kind === "tour" ||
      phase.kind === "carte-dresseur" ||
      phase.kind === "pantheon" ||
      phase.kind === "pension" ||
      phase.kind === "maitre" ||
      phase.kind === "fiche" ||
      phase.kind === "surnom" ||
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
