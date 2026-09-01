"use client";

import { useEffect, useRef } from "react";
import {
  GENERATIONS,
  displayName,
  iconUrl,
  padDex,
  staticUrl,
  type IndexEntry,
} from "@/lib/pokeapi";
import type { DexTab } from "./TopScreen";

type Props = {
  entries: IndexEntry[];
  selectedId: number;
  onSelect: (id: number) => void;
  query: string;
  onQuery: (value: string) => void;
  gen: number;
  onGen: (value: number) => void;
  tab: DexTab;
  onTab: (value: DexTab) => void;
  onCry: () => void;
  sound: boolean;
  onSound: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  hasCry: boolean;
};

const TABS: { id: DexTab; label: string }[] = [
  { id: "info", label: "INFOS" },
  { id: "stats", label: "STATS" },
  { id: "evo", label: "ÉVOLUTION" },
];

/** Écran tactile du bas : recherche, filtres, liste et commandes. */
export default function BottomScreen({
  entries,
  selectedId,
  onSelect,
  query,
  onQuery,
  gen,
  onGen,
  tab,
  onTab,
  onCry,
  sound,
  onSound,
  searchRef,
  hasCry,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  // Garde la ligne sélectionnée visible, y compris en navigation clavier.
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-id="${selectedId}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedId, entries]);

  return (
    <section className="screen screen--bottom" aria-label="Écran tactile">
      <div className="screen__glass screen__glass--touch">
        <div className="touch">
          <div className="touch__search">
            <span className="touch__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              ref={searchRef}
              className="touch__input"
              type="search"
              value={query}
              placeholder="Nom ou numéro…"
              aria-label="Rechercher un Pokémon"
              onChange={(e) => onQuery(e.target.value)}
            />
            <button
              type="button"
              className={`touch__sound${sound ? " is-on" : ""}`}
              onClick={onSound}
              aria-pressed={sound}
              title={sound ? "Couper le son" : "Activer le son"}
            >
              {sound ? "♪" : "✕"}
            </button>
          </div>

          <div className="gens" role="group" aria-label="Filtrer par génération">
            {GENERATIONS.map((g) => (
              <button
                type="button"
                key={g.id}
                className={`gens__chip${gen === g.id ? " is-active" : ""}`}
                onClick={() => onGen(g.id)}
                title={g.region}
              >
                {g.label}
              </button>
            ))}
          </div>

          <ul className="list" ref={listRef}>
            {entries.map((entry) => {
              const active = entry.id === selectedId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    data-id={entry.id}
                    className={`row${active ? " row--active" : ""}`}
                    onClick={() => onSelect(entry.id)}
                    aria-current={active}
                  >
                    <span className="row__cursor" aria-hidden="true">
                      ▶
                    </span>
                    <img
                      className="row__icon"
                      src={iconUrl(entry.id)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = staticUrl(entry.id);
                      }}
                    />
                    <span className="row__no">{padDex(entry.id)}</span>
                    <span className="row__name">{displayName(entry.name)}</span>
                  </button>
                </li>
              );
            })}
            {!entries.length && (
              <li className="list__empty">Aucun Pokémon trouvé.</li>
            )}
          </ul>

          <div className="controls">
            <div className="controls__tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`controls__tab${tab === t.id ? " is-active" : ""}`}
                  onClick={() => onTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="controls__cry"
              onClick={onCry}
              disabled={!hasCry}
              title="Écouter le cri"
            >
              CRI
            </button>
          </div>

          <p className="hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd> naviguer · <kbd>←</kbd>
            <kbd>→</kbd> onglets · <kbd>Entrée</kbd> cri · <kbd>/</kbd>{" "}
            rechercher
          </p>
        </div>
      </div>
    </section>
  );
}
