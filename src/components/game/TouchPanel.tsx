"use client";

import { useEffect, useRef } from "react";
import { iconUrl, staticUrl } from "@/lib/pokeapi";
import { SPECIES, TYPE_FR, species } from "@/lib/game/data";
import { maxHp, type Mon } from "@/lib/game/battle";
import type { GameState } from "@/lib/game/state";

export type Choice = {
  id: string;
  label: string;
  sub?: string;
  disabled?: boolean;
  tone?: "fight" | "bag" | "party" | "run" | "back" | "plain";
};

type Props = {
  title: string;
  hint: string;
  choices: Choice[];
  layout: "grid" | "list" | "row";
  cursor: number;
  onPick: (index: number) => void;
  game: GameState;
  /** Équipe à afficher : celle du combat si l'on se bat. */
  party: Mon[];
  active: number;
  /** Écran de choix du starter. */
  starters?: number[];
  /** L'équipe n'a pas sa place pendant l'introduction. */
  showParty?: boolean;
  /** Saisie du nom du dresseur. */
  naming?: boolean;
  nameValue?: string;
  onNameChange?: (value: string) => void;
  nameRef?: React.RefObject<HTMLInputElement | null>;
};

function MonCard({ mon, current }: { mon: Mon; current: boolean }) {
  const max = maxHp(mon);
  const ratio = mon.hp / max;
  const tone = ratio > 0.5 ? "high" : ratio > 0.2 ? "mid" : "low";
  return (
    <div className={`monc${current ? " monc--current" : ""}${mon.hp <= 0 ? " monc--ko" : ""}`}>
      <img
        className="monc__icon"
        src={iconUrl(mon.id)}
        alt=""
        onError={(e) => {
          e.currentTarget.src = staticUrl(mon.id);
        }}
      />
      <div className="monc__info">
        <span className="monc__name">{mon.name}</span>
        <span className="monc__lvl">N.{mon.level}</span>
        <span className="hpbar hpbar--small">
          <span
            className={`hpbar__fill hpbar__fill--${tone}`}
            style={{ width: `${Math.max(0, (mon.hp / max) * 100)}%` }}
          />
        </span>
      </div>
      <span className="monc__hp">
        {mon.hp}/{max}
      </span>
    </div>
  );
}

/** L'écran tactile pendant le jeu : équipe, menus et commandes de combat. */
export default function TouchPanel({
  title,
  hint,
  choices,
  layout,
  cursor,
  onPick,
  game,
  party,
  active,
  starters,
  showParty = true,
  naming = false,
  nameValue = "",
  onNameChange,
  nameRef,
}: Props) {
  // Une liste longue — les dix arrêts des Cars Faure — dépasse la dalle :
  // le choix sous le curseur est ramené dans le champ de vision.
  const choicesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const picked = choicesRef.current?.children[cursor];
    picked?.scrollIntoView({ block: "nearest" });
  }, [cursor, choices]);

  return (
    <div className="pad">
      <header className="pad__head">
        <span className="pad__title">{title}</span>
        <span className="pad__wallet">
          {game.name || "…"} · {game.money} P
        </span>
      </header>

      <div className="pad__body">
        {naming && (
          <div className="pad__name">
            <label htmlFor="dresseur">Quel est ton nom ?</label>
            <input
              id="dresseur"
              ref={nameRef}
              className="pad__input"
              value={nameValue}
              maxLength={10}
              placeholder="Dix lettres au plus"
              onChange={(e) => onNameChange?.(e.target.value)}
            />
          </div>
        )}

        {starters && (
          <div className="pad__starters">
            {starters.map((id, i) => (
              <button
                type="button"
                key={id}
                className={`starter${cursor === i ? " starter--on" : ""}`}
                onClick={() => onPick(i)}
              >
                <img
                  src={staticUrl(id)}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = iconUrl(id);
                  }}
                />
                <span className="starter__name">{SPECIES[id].name}</span>
                <span className="starter__type">
                  {species(id).types.map((t) => TYPE_FR[t]).join(" / ")}
                </span>
              </button>
            ))}
          </div>
        )}

        {!starters && !naming && showParty && (
          <div className="pad__party">
            {party.length ? (
              party.map((mon, i) => (
                <MonCard key={mon.uid} mon={mon} current={i === active} />
              ))
            ) : (
              <p className="pad__empty">Aucun Pokémon dans l&apos;équipe.</p>
            )}
          </div>
        )}
      </div>

      {choices.length > 0 && !starters && (
        <div ref={choicesRef} className={`pad__choices pad__choices--${layout}`}>
          {choices.map((choice, i) => (
            <button
              type="button"
              key={choice.id}
              className={`cmd cmd--${choice.tone ?? "plain"}${cursor === i ? " cmd--on" : ""}`}
              disabled={choice.disabled}
              onClick={() => onPick(i)}
            >
              <span className="cmd__label">{choice.label}</span>
              {choice.sub && <span className="cmd__sub">{choice.sub}</span>}
            </button>
          ))}
        </div>
      )}

      <p className="pad__hint">{hint}</p>
    </div>
  );
}
