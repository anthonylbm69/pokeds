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

const TAB_ORDER: DexTab[] = ["info", "stats", "evo"];

export default function Pokedex({ index: initialIndex }: { index: IndexEntry[] }) {
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

  // Le cri accompagne chaque nouvelle fiche, comme dans le jeu.
  const lastCried = useRef<number | null>(null);
  useEffect(() => {
    if (!detail || pending) return;
    if (lastCried.current === detail.id) return;
    lastCried.current = detail.id;
    playCry(detail.cry);
  }, [detail, pending, playCry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT";

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          step(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          step(-1);
          break;
        case "PageDown":
          e.preventDefault();
          step(10);
          break;
        case "PageUp":
          e.preventDefault();
          step(-10);
          break;
        case "ArrowRight":
          if (typing) return;
          e.preventDefault();
          setTab((t) => TAB_ORDER[(TAB_ORDER.indexOf(t) + 1) % TAB_ORDER.length]);
          break;
        case "ArrowLeft":
          if (typing) return;
          e.preventDefault();
          setTab(
            (t) =>
              TAB_ORDER[
                (TAB_ORDER.indexOf(t) - 1 + TAB_ORDER.length) % TAB_ORDER.length
              ],
          );
          break;
        case "Enter":
          if (typing && entries.length) {
            e.preventDefault();
            setSelectedId(entries[0].id);
            searchRef.current?.blur();
          } else if (detail) {
            playCry(detail.cry);
          }
          break;
        case "Escape":
          if (query) {
            setQuery("");
            searchRef.current?.blur();
          }
          break;
        case "/":
          if (typing) return;
          e.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.select();
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, entries, detail, query, playCry]);

  return (
    <div className="console">
      <div className="console__body">
        <TopScreen
          detail={detail}
          pending={pending}
          error={error}
          tab={tab}
          onSelect={setSelectedId}
        />

        <div className="hinge">
          <span className="hinge__brand">POKéDEX</span>
          <span className="hinge__grill" aria-hidden="true" />
          <span className="hinge__count">
            {entries.length}/{index.length || "…"}
          </span>
        </div>

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
        />
      </div>
    </div>
  );
}
