"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { animatedUrl, staticUrl } from "@/lib/pokeapi";
import { hasSave } from "@/lib/game/state";
import type { DsButton } from "./DSConsole";

/**
 * Le démarrage de Noir/Blanc, dans l'ordre : allumage de la console, logo
 * GAME FREAK avec son étoile filante, écran de copyright, puis l'écran-titre
 * et son menu. Chaque étape s'enchaîne toute seule et se saute au clic.
 */
export type BootPhase =
  | "power"
  | "gamefreak"
  | "copyright"
  | "title"
  | "flash"
  | "done";

export type TitleEntry = "continuer" | "nouvelle" | "dex";

const LABELS: Record<TitleEntry, string> = {
  continuer: "CONTINUER",
  nouvelle: "NOUVELLE PARTIE",
  dex: "POKÉDEX",
};

const STEPS: Partial<Record<BootPhase, { next: BootPhase; ms: number }>> = {
  power: { next: "gamefreak", ms: 1000 },
  gamefreak: { next: "copyright", ms: 2600 },
  copyright: { next: "title", ms: 2100 },
  // « title » attend un choix ; « flash » couvre l'entrée dans le jeu.
  flash: { next: "done", ms: 420 },
};

/** Reshiram et Zekrom, les deux légendaires de l'écran-titre. */
const LIGHT = 643;
const DARK = 644;

export function useBoot({ onChoose }: { onChoose: (entry: TitleEntry) => void }) {
  const [phase, setPhase] = useState<BootPhase>("power");
  const [cursor, setCursor] = useState(0);

  // La sauvegarde ne se lit que côté client : le serveur rend toujours un
  // menu sans « CONTINUER », et le client l'ajoute au premier rendu.
  const saved = useSyncExternalStore(
    () => () => {},
    () => hasSave(),
    () => false,
  );

  const entries = useMemo<TitleEntry[]>(
    () => (saved ? ["continuer", "nouvelle", "dex"] : ["nouvelle", "dex"]),
    [saved],
  );

  useEffect(() => {
    const step = STEPS[phase];
    if (!step) return;
    const brief = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(
      () => setPhase(step.next),
      brief ? Math.min(step.ms, 320) : step.ms,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  const choose = useCallback(
    (index: number) => {
      const entry = entries[index];
      if (!entry) return;
      onChoose(entry);
      setPhase("flash");
    },
    [entries, onChoose],
  );

  /** Toute commande saute l'intro ; sur le titre, elle pilote le menu. */
  const press = useCallback(
    (button: DsButton) => {
      if (phase === "flash" || phase === "done") return;
      if (phase !== "title") {
        setPhase("title");
        return;
      }
      if (button === "up") setCursor((c) => Math.max(0, c - 1));
      else if (button === "down") setCursor((c) => Math.min(entries.length - 1, c + 1));
      else if (button === "a" || button === "start") choose(cursor);
    },
    [phase, entries.length, cursor, choose],
  );

  /** Retour à l'écran-titre depuis un mode de la console. */
  const goTitle = useCallback(() => {
    setCursor(0);
    setPhase("title");
  }, []);

  return {
    phase,
    entries,
    cursor,
    press,
    choose,
    skip: () => setPhase("title"),
    goTitle,
    /** Les dalles affichent encore l'intro : aucun mode n'est monté. */
    booting: phase !== "flash" && phase !== "done",
  };
}

type Props = {
  phase: BootPhase;
  entries: TitleEntry[];
  cursor: number;
  onSkip: () => void;
  onChoose: (index: number) => void;
};

const fallback = (id: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.src = staticUrl(id);
};

/** Écran du haut : logo, copyright puis écran-titre et son menu. */
export function BootTop({ phase, entries, cursor, onSkip, onChoose }: Props) {
  return (
    <div className={`bios bios--${phase}`} key={phase}>
      {phase !== "title" && (
        <button
          type="button"
          className="bios__skip"
          onClick={onSkip}
          aria-label="Passer l'introduction"
        />
      )}

      {phase === "power" && <span className="bios__crt" aria-hidden="true" />}

      {phase === "gamefreak" && (
        <>
          <span className="bios__star" aria-hidden="true" />
          <span className="bios__gf">
            <span className="bios__gf-mark">GAME FREAK</span>
            <span className="bios__gf-sub">presents</span>
          </span>
        </>
      )}

      {phase === "copyright" && (
        <span className="bios__legal">
          <span className="bios__legal-line">
            POKéMON © Nintendo · Creatures Inc. · GAME FREAK inc.
          </span>
          <span className="bios__legal-sub">
            Hommage non officiel — données &amp; sprites : PokéAPI
          </span>
        </span>
      )}

      {phase === "title" && (
        <>
          <span className="bios__sky" aria-hidden="true" />
          <img
            className="bios__mon bios__mon--light"
            src={animatedUrl(LIGHT) ?? staticUrl(LIGHT)}
            alt=""
            onError={fallback(LIGHT)}
          />
          <img
            className="bios__mon bios__mon--dark"
            src={animatedUrl(DARK) ?? staticUrl(DARK)}
            alt=""
            onError={fallback(DARK)}
          />
          <span className="bios__logo">
            <span className="bios__word">Pokédex</span>
            <span className="bios__ver">Version Noire &amp; Blanche</span>
          </span>
          <ul className="bios__menu">
            {entries.map((entry, i) => (
              <li key={entry}>
                <button
                  type="button"
                  className={`bios__entry${cursor === i ? " bios__entry--on" : ""}`}
                  onClick={() => onChoose(i)}
                >
                  <span className="bios__cursor" aria-hidden="true">
                    ▶
                  </span>
                  {LABELS[entry]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Écran du bas : noir pendant l'intro, rappel des commandes sur le titre. */
export function BootBottom({ phase, onSkip }: Pick<Props, "phase" | "onSkip">) {
  return (
    <div className={`bios bios--${phase} bios--lower`} key={phase}>
      {phase !== "title" && (
        <button
          type="button"
          className="bios__skip"
          onClick={onSkip}
          aria-label="Passer l'introduction"
        />
      )}

      {phase === "power" && <span className="bios__crt" aria-hidden="true" />}

      {phase === "title" && (
        <>
          <span className="bios__touch">▲ ▼ POUR CHOISIR · A POUR VALIDER</span>
          <span className="bios__meta">
            UNE AVENTURE À UNYS · POKéDEX NATIONAL COMPLET
          </span>
        </>
      )}
    </div>
  );
}
