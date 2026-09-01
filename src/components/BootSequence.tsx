"use client";

import { useCallback, useEffect, useState } from "react";
import { animatedUrl, NATIONAL_DEX_MAX, staticUrl } from "@/lib/pokeapi";

/**
 * Le démarrage de Noir/Blanc, dans l'ordre : allumage de la console, logo
 * GAME FREAK avec son étoile filante, écran de copyright, puis l'écran-titre
 * qui attend START. Chaque étape s'enchaîne toute seule et se saute au clic.
 */
export type BootPhase =
  | "power"
  | "gamefreak"
  | "copyright"
  | "title"
  | "flash"
  | "done";

const STEPS: Partial<Record<BootPhase, { next: BootPhase; ms: number }>> = {
  power: { next: "gamefreak", ms: 1000 },
  gamefreak: { next: "copyright", ms: 2600 },
  copyright: { next: "title", ms: 2100 },
  // "title" attend une pression ; "flash" couvre l'entrée dans le Pokédex.
  flash: { next: "done", ms: 420 },
};

/** Reshiram et Zekrom, les deux légendaires de l'écran-titre. */
const LIGHT = 643;
const DARK = 644;

export function useBoot() {
  const [phase, setPhase] = useState<BootPhase>("power");

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

  /** N'importe quelle commande saute l'intro ; sur le titre, elle lance le jeu. */
  const press = useCallback(() => {
    setPhase((p) => {
      if (p === "flash" || p === "done") return p;
      return p === "title" ? "flash" : "title";
    });
  }, []);

  return {
    phase,
    press,
    /** Les dalles affichent encore l'intro : le Pokédex n'est pas monté. */
    booting: phase !== "flash" && phase !== "done",
  };
}

type Props = { phase: BootPhase; onPress: () => void };

const fallback = (id: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.src = staticUrl(id);
};

/** Écran du haut : logo, copyright puis écran-titre. */
export function BootTop({ phase, onPress }: Props) {
  return (
    <button
      type="button"
      key={phase}
      className={`bios bios--${phase}`}
      onClick={onPress}
      aria-label={
        phase === "title" ? "Démarrer le Pokédex" : "Passer l'introduction"
      }
    >
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
          <span className="bios__press">APPUYEZ SUR START</span>
        </>
      )}
    </button>
  );
}

/** Écran du bas : noir pendant l'intro, invite tactile sur le titre. */
export function BootBottom({ phase, onPress }: Props) {
  return (
    <button
      type="button"
      key={phase}
      className={`bios bios--${phase} bios--lower`}
      onClick={onPress}
      aria-label={
        phase === "title" ? "Démarrer le Pokédex" : "Passer l'introduction"
      }
    >
      {phase === "power" && <span className="bios__crt" aria-hidden="true" />}

      {phase === "title" && (
        <>
          <span className="bios__touch">◉ TOUCHEZ L&apos;ÉCRAN</span>
          <span className="bios__meta">
            POKéDEX NATIONAL · {NATIONAL_DEX_MAX} ESPÈCES
          </span>
        </>
      )}
    </button>
  );
}
