"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { animatedUrl, staticUrl } from "@/lib/pokeapi";
import { MOVES, TYPE_FR, species } from "@/lib/game/data";
import {
  activeMon,
  createMon,
  isKo,
  playerMove,
  startTrainer,
  startWild,
  switchTo,
  takePotion,
  throwBall,
  tryRun,
  type BattleState,
} from "@/lib/game/battle";
import {
  MAPS,
  STEP,
  rollEncounter,
  seesPlayer,
  signAt,
  tileChar,
  warpAt,
  type NpcSpec,
} from "@/lib/game/world";
import {
  STARTERS,
  addCaught,
  giveStarter,
  hasFlag,
  healParty,
  loadGame,
  markSeen,
  newGame,
  saveGame,
  withFlag,
  type GameState,
} from "@/lib/game/state";
import type { DsButton, ModeParts } from "../DSConsole";
import BattleView from "./BattleView";
import TouchPanel, { type Choice } from "./TouchPanel";
import WorldView, { newPlayer, type PlayerPos } from "./WorldView";

export type GameParts = ModeParts & {
  /** Lance une partie neuve ou reprend la sauvegarde. */
  begin: (mode: "nouvelle" | "continuer") => void;
  /** La coque y dépose les boutons maintenus : c'est ce qui fait marcher. */
  setHeld: (buttons: ReadonlySet<DsButton>) => void;
};

/** Ce qu'il faut faire une fois le dialogue terminé. */
type Then =
  | { do: "starter" }
  | { do: "heal"; respawn: boolean }
  | { do: "trainer"; npc: string }
  | { do: "world" };

type BattleUi = {
  state: BattleState;
  queue: string[];
  view: "message" | "menu" | "moves" | "bag" | "party";
  throwing: boolean;
  origin: { kind: "sauvage" } | { kind: "dresseur"; npc: string };
};

type Phase =
  | { kind: "intro"; step: number }
  | { kind: "name" }
  | { kind: "world" }
  | { kind: "text"; lines: string[]; i: number; then: Then | null }
  | { kind: "starter" }
  | { kind: "battle"; ui: BattleUi };

const INTRO = [
  "Bonjour ! Bienvenue dans le monde des POKéMON !",
  "Je m'appelle Keteleeria. Mais tout le monde m'appelle le Professeur Pokémon.",
  "Ce monde est peuplé de créatures fabuleuses que l'on nomme Pokémon.",
  "Certaines personnes les élèvent, d'autres les affrontent… et d'autres, comme moi, les étudient.",
  "Et toi ? Quel genre de Dresseur vas-tu devenir ?",
  "Avant de commencer, dis-moi…",
];

const ENCOUNTER_RATE = 0.14;

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

  const npcs = useMemo<NpcSpec[]>(() => map.npcs, [map]);

  const npcById = useCallback(
    (id: string) => npcs.find((n) => n.id === id) ?? null,
    [npcs],
  );

  const talk = useCallback(
    (npc: NpcSpec) => {
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
      setPhase({ kind: "text", lines: npc.lines, i: 0, then: null });
    },
    [game],
  );

  /* --------------------------------------------------------- combats */

  const openBattle = useCallback(
    (state: BattleState, queue: string[], origin: BattleUi["origin"]) => {
      setGame((g) => markSeen(g, state.foe.id));
      setCursor(0);
      setPhase({
        kind: "battle",
        ui: { state, queue, view: "message", throwing: false, origin },
      });
    },
    [],
  );

  const startWildBattle = useCallback(
    (id: number, level: number) => {
      const foe = createMon(id, level);
      const state = startWild(game.party, foe, { balls: game.balls, potions: game.potions });
      openBattle(
        state,
        [`Un ${foe.name} sauvage apparaît !`, `En avant, ${activeMon(state).name} !`],
        { kind: "sauvage" },
      );
    },
    [game, openBattle],
  );

  const startTrainerBattle = useCallback(
    (npcId: string) => {
      const npc = npcById(npcId);
      if (!npc?.trainer) return;
      const team = npc.trainer.team.map((t) => createMon(t.id, t.level));
      const state = startTrainer(game.party, team, {
        name: npc.trainer.name,
        title: npc.trainer.title,
        reward: npc.trainer.reward,
      }, { balls: game.balls, potions: game.potions });
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
        balls: s.balls,
        potions: s.potions,
      };
      const lines: string[] = [];

      if (s.outcome === "capture" && s.caught) {
        if (next.party.length >= 6) {
          lines.push(`${s.caught.name} rejoint le PC : votre équipe est pleine.`);
          next = { ...next, caught: [...new Set([...next.caught, s.caught.id])] };
        } else {
          next = addCaught(next, s.caught);
          lines.push(`Les données de ${s.caught.name} sont ajoutées au Pokédex.`);
        }
      }

      if (s.outcome === "victoire" && ui.origin.kind === "dresseur") {
        const npc = npcById(ui.origin.npc);
        next = withFlag(next, `battu:${ui.origin.npc}`);
        next = { ...next, money: next.money + (s.trainer?.reward ?? 0) };
        if (npc?.trainer) lines.push(...npc.trainer.defeat, ...npc.trainer.after);
      }

      if (s.outcome === "defaite") {
        next = healParty(next);
        next = { ...next, map: next.respawn.map, x: next.respawn.x, y: next.respawn.y };
        player.current = newPlayer(next.respawn.x, next.respawn.y, "down");
        lines.push("Vos Pokémon ont été soignés. Reprenez des forces !");
      }

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
        setPhase({ kind: "battle", ui: { ...ui, queue, throwing: false } });
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
        const moved: GameState = { ...game, map: warp.to, x: warp.tx, y: warp.ty, dir: warp.dir ?? game.dir };
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
    const sign = signAt(map, tx, ty);
    if (sign) {
      setPhase({ kind: "text", lines: sign.text, i: 0, then: null });
    }
  }, [map, talk]);

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
        case "trainer":
          startTrainerBattle(then.npc);
          break;
        case "heal": {
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
        default:
          setPhase({ kind: "world" });
      }
    },
    [game, startTrainerBattle],
  );

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
            { id: "bag", label: "SAC", tone: "bag", sub: `${s.balls} Ball · ${s.potions} Potion` },
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
          hint: "A pour utiliser · B pour revenir",
          layout: "list",
          list: [
            { id: "ball", label: "POKÉ BALL", sub: `× ${s.balls}`, disabled: s.balls <= 0 || s.kind === "dresseur", tone: "bag" },
            { id: "potion", label: "POTION", sub: `× ${s.potions}`, disabled: s.potions <= 0, tone: "bag" },
            { id: "back", label: "RETOUR", tone: "back" },
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
      hint: "Croix pour marcher · B pour courir · A pour interagir",
      layout: "row",
      list: [
        { id: "dex", label: "POKÉDEX", sub: `${game.caught.length} capturés` },
        { id: "save", label: "SAUVER", sub: "X" },
        { id: "title", label: "TITRE", sub: "SELECT" },
      ],
    };
  }, [battleUi, phase, game]);

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
      if (!choice || choice.disabled) return;

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
          } else if (choice.id === "ball") {
            runTurn(ui, throwBall(ui.state), true);
          } else if (choice.id === "potion") {
            runTurn(ui, takePotion(ui.state));
          }
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

      if (phase.kind === "world") {
        if (choice.id === "dex") onOpenDex();
        else if (choice.id === "save") save();
        else if (choice.id === "title") onExit();
      }
    },
    [choices, phase, battleUi, draftName, chooseStarter, runTurn, save, firstReady, onOpenDex, onExit],
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
    (button: DsButton) => {
      if (!active) return;

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

        case "world":
          if (button === "a") interact();
          else if (button === "x") save();
          else if (button === "y") onOpenDex();
          else if (button === "select") onExit();
          return;
      }
    },
    [active, phase, cursor, pick, moveCursor, advanceBattle, interact, save, onOpenDex, onExit, resolveThen],
  );

  /* ------------------------------------------------------------ rendu */

  const dialogue =
    phase.kind === "text" ? phase.lines[phase.i] : null;

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
        </div>
      );
    }

    if (phase.kind === "battle") {
      return (
        <BattleView
          state={phase.ui.state}
          message={phase.ui.queue[0] ?? null}
          throwing={phase.ui.throwing}
        />
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
          onStep={onStep}
        />
        <span className="scene__zone">{MAPS[game.map].name}</span>
        {dialogue && (
          <div className="scene__box">
            <p>{dialogue}</p>
            <span className="scene__next" aria-hidden="true">
              ▼
            </span>
          </div>
        )}
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
    count: game.party.length
      ? `${game.party.length}/6 · ${game.caught.length} vus`
      : "AUCUN POKéMON",
  };
}
