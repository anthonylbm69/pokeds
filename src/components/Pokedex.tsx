"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GENERATIONS,
  displayName,
  fetchIndex,
  fetchPokemon,
  padDex,
  type IndexEntry,
  type PokemonDetail,
} from "@/lib/pokeapi";
import TopScreen, { type DexTab } from "./TopScreen";
import BottomScreen from "./BottomScreen";
import type { DsButton, ModeParts } from "./DSConsole";

const TAB_ORDER: DexTab[] = ["info", "stats", "evo"];

/** Ce que fait chaque bouton dans le Pokédex : repris en info-bulle. */
export const DEX_LABELS: Partial<Record<DsButton, string>> = {
  up: "Pokémon précédent",
  down: "Pokémon suivant",
  left: "Onglet précédent",
  right: "Onglet suivant",
  a: "Écouter le cri",
  b: "Effacer / revenir",
  x: "Couper le son",
  y: "Pokémon au hasard",
  l: "Reculer de 10",
  r: "Avancer de 10",
  start: "Rechercher",
  select: "Changer de génération",
};

/** Le mode Pokédex de la console : les deux écrans et ses commandes. */
export function usePokedex({
  index: initialIndex,
  active,
  onExit,
}: {
  index: IndexEntry[];
  active: boolean;
  onExit: () => void;
}): ModeParts {
  const [index, setIndex] = useState(initialIndex);
  const [selectedId, setSelectedId] = useState(1);
  const [detail, setDetail] = useState<PokemonDetail | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [gen, setGen] = useState(0);
  const [tab, setTab] = useState<DexTab>("info");
  const [sound, setSound] = useState(true);

  const cache = useRef(new Map<number, PokemonDetail>());
  const searchRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filet de sécurité : si la PokéAPI n'a pas répondu au rendu serveur,
  // on récupère l'index côté client plutôt que d'afficher un dex vide.
  useEffect(() => {
    if (index.length) return;
    let alive = true;
    fetchIndex()
      .then((list) => alive && setIndex(list))
      .catch(() => alive && setError("Index du Pokédex indisponible."));
    return () => {
      alive = false;
    };
  }, [index.length]);

  const playCry = useCallback(
    (url: string | null) => {
      if (!url || !sound) return;
      audioRef.current?.pause();
      const audio = new Audio(url);
      audio.volume = 0.35;
      audioRef.current = audio;
      // Sans geste utilisateur préalable, le navigateur refuse la lecture : on ignore.
      void audio.play().catch(() => {});
    },
    [sound],
  );

  // Chargement de la fiche : le sprite précédent reste affiché pendant la requête.
  useEffect(() => {
    const cached = cache.current.get(selectedId);
    if (cached) {
      setDetail(cached);
      setPending(false);
      setError(null);
      return;
    }

    let alive = true;
    setPending(true);
    fetchPokemon(selectedId)
      .then((data) => {
        if (!alive) return;
        cache.current.set(selectedId, data);
        setDetail(data);
        setError(null);
      })
      .catch(() => alive && setError("Fiche introuvable sur la PokéAPI."))
      .finally(() => alive && setPending(false));

    return () => {
      alive = false;
    };
  }, [selectedId]);

  const entries = useMemo(() => {
    const range = GENERATIONS.find((g) => g.id === gen) ?? GENERATIONS[0];
    const q = query.trim().toLowerCase();
    return index.filter((entry) => {
      if (entry.id < range.from || entry.id > range.to) return false;
      if (!q) return true;
      return (
        entry.name.includes(q) ||
        displayName(entry.name).toLowerCase().includes(q) ||
        padDex(entry.id).startsWith(q)
      );
    });
  }, [index, gen, query]);

  const step = useCallback(
    (delta: number) => {
      if (!entries.length) return;
      const current = entries.findIndex((e) => e.id === selectedId);
      const next = Math.min(
        Math.max((current === -1 ? 0 : current) + delta, 0),
        entries.length - 1,
      );
      setSelectedId(entries[next].id);
    },
    [entries, selectedId],
  );

  const shiftTab = useCallback((delta: number) => {
    setTab(
      (t) =>
        TAB_ORDER[
          (TAB_ORDER.indexOf(t) + delta + TAB_ORDER.length) % TAB_ORDER.length
        ],
    );
  }, []);

  // Le cri accompagne chaque nouvelle fiche, comme dans le jeu.
  const lastCried = useRef<number | null>(null);
  useEffect(() => {
    if (!active || !detail || pending) return;
    if (lastCried.current === detail.id) return;
    lastCried.current = detail.id;
    playCry(detail.cry);
  }, [active, detail, pending, playCry]);

  const press = useCallback(
    (button: DsButton) => {
      if (!active) return;

      switch (button) {
        case "up":
          step(-1);
          break;
        case "down":
          step(1);
          break;
        case "l":
          step(-10);
          break;
        case "r":
          step(10);
          break;
        case "left":
          shiftTab(-1);
          break;
        case "right":
          shiftTab(1);
          break;
        case "a": {
          // Dans la barre de recherche, A valide le premier résultat.
          if (document.activeElement === searchRef.current && entries.length) {
            setSelectedId(entries[0].id);
            searchRef.current?.blur();
          } else {
            playCry(detail?.cry ?? null);
          }
          break;
        }
        case "b":
          // B efface la recherche ; s'il n'y a rien à effacer, on ressort.
          if (query) {
            setQuery("");
            searchRef.current?.blur();
          } else {
            onExit();
          }
          break;
        case "x":
          setSound((s) => !s);
          break;
        case "y":
          if (entries.length) {
            setSelectedId(entries[Math.floor(Math.random() * entries.length)].id);
          }
          break;
        case "start":
          searchRef.current?.focus();
          searchRef.current?.select();
          break;
        case "select":
          setGen((g) => {
            const i = GENERATIONS.findIndex((x) => x.id === g);
            return GENERATIONS[(i + 1) % GENERATIONS.length].id;
          });
          break;
      }
    },
    [active, step, shiftTab, entries, detail, query, playCry, onExit],
  );

  return {
    press,
    count: `${entries.length} / ${index.length || "…"}`,
    top: (
      <TopScreen
        detail={detail}
        pending={pending}
        error={error}
        tab={tab}
        onSelect={setSelectedId}
      />
    ),
    bottom: (
      <BottomScreen
        entries={entries}
        selectedId={selectedId}
        onSelect={setSelectedId}
        query={query}
        onQuery={setQuery}
        gen={gen}
        onGen={setGen}
        tab={tab}
        onTab={setTab}
        onCry={() => playCry(detail?.cry ?? null)}
        sound={sound}
        onSound={() => setSound((s) => !s)}
        searchRef={searchRef}
        hasCry={Boolean(detail?.cry)}
        onExit={onExit}
      />
    ),
  };
}
