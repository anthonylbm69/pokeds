"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IndexEntry } from "@/lib/pokeapi";
import DSConsole, { type DsButton } from "./DSConsole";
import { BootBottom, BootTop, useBoot, type TitleEntry } from "./BootSequence";
import { DEX_LABELS, usePokedex } from "./Pokedex";
import { useGame, type GameParts } from "./game/useGame";

type Mode = "title" | "dex" | "game";

const GAME_LABELS: Partial<Record<DsButton, string>> = {
  up: "Marcher vers le haut",
  down: "Marcher vers le bas",
  left: "Marcher à gauche",
  right: "Marcher à droite",
  a: "Parler · valider",
  b: "Courir · annuler",
  x: "Sauvegarder",
  y: "Ouvrir le Pokédex",
  l: "—",
  r: "—",
  start: "Valider",
  select: "Retour au titre",
};

const TITLE_LABELS: Partial<Record<DsButton, string>> = {
  up: "Choix précédent",
  down: "Choix suivant",
  a: "Valider",
  start: "Valider",
};

/**
 * La console elle-même : elle garde la coque montée et lui donne, selon le
 * mode, l'écran-titre, le Pokédex ou le jeu.
 */
export default function Console({ index }: { index: IndexEntry[] }) {
  const [mode, setMode] = useState<Mode>("title");
  const [dexFrom, setDexFrom] = useState<"title" | "game">("title");

  // L'écran-titre lance la partie sans connaître le jeu : on passe par une
  // référence, sinon les deux crochets se réclameraient l'un l'autre.
  const beginRef = useRef<GameParts["begin"]>(() => {});

  const boot = useBoot({
    onChoose: useCallback((entry: TitleEntry) => {
      if (entry === "dex") {
        setDexFrom("title");
        setMode("dex");
        return;
      }
      beginRef.current(entry === "continuer" ? "continuer" : "nouvelle");
      setMode("game");
    }, []),
  });

  const game = useGame({
    active: mode === "game",
    onOpenDex: useCallback(() => {
      setDexFrom("game");
      setMode("dex");
    }, []),
    onExit: useCallback(() => {
      setMode("title");
      boot.goTitle();
    }, [boot]),
  });

  useEffect(() => {
    beginRef.current = game.begin;
  }, [game.begin]);

  const dex = usePokedex({
    index,
    active: mode === "dex",
    // Depuis le jeu, le Pokédex ne montre que les espèces déjà croisées.
    only: dexFrom === "game" ? game.seen : undefined,
    onExit: useCallback(() => {
      if (dexFrom === "game") {
        setMode("game");
        return;
      }
      setMode("title");
      boot.goTitle();
    }, [dexFrom, boot]),
  });

  const parts = mode === "dex" ? dex : mode === "game" ? game : null;

  const press = useCallback(
    (button: DsButton, repeat = false) => {
      if (boot.booting) {
        boot.press(button);
        return;
      }
      // L'indicateur de répétition doit suivre : le jeu s'en sert pour
      // distinguer un appui volontaire d'une touche maintenue.
      parts?.press(button, repeat);
    },
    [boot, parts],
  );

  return (
    <DSConsole
      onPress={press}
      onHold={game.setHeld}
      labels={boot.booting ? TITLE_LABELS : mode === "game" ? GAME_LABELS : DEX_LABELS}
      count={boot.booting ? "PRÊT" : (parts?.count ?? "")}
      focus={boot.booting ? "top" : parts?.focus}
      flash={boot.phase === "flash"}
      top={
        boot.booting ? (
          <BootTop
            phase={boot.phase}
            entries={boot.entries}
            cursor={boot.cursor}
            onSkip={boot.skip}
            onChoose={boot.choose}
          />
        ) : (
          parts?.top
        )
      }
      bottom={
        boot.booting ? (
          <BootBottom phase={boot.phase} onSkip={boot.skip} />
        ) : (
          parts?.bottom
        )
      }
    />
  );
}
