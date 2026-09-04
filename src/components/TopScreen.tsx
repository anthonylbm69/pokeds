"use client";

import {
  formatHeight,
  formatWeight,
  iconUrl,
  padDex,
  staticUrl,
  TYPE_LABELS,
  type PokemonDetail,
} from "@/lib/pokeapi";

export type DexTab = "info" | "stats" | "evo";

type Props = {
  detail: PokemonDetail | null;
  pending: boolean;
  error: string | null;
  tab: DexTab;
  onSelect: (id: number) => void;
};

/** Écran supérieur de la DS : purement de l'affichage, aucune commande. */
export default function TopScreen({
  detail,
  pending,
  error,
  tab,
  onSelect,
}: Props) {
  if (error && !detail) {
    return (
      <div className="boot">
        <p className="boot__title">ERREUR DE LIAISON</p>
        <p className="boot__sub">{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="boot">
        <span className="boot__ring" />
        <p className="boot__title">INITIALISATION DU POKÉDEX</p>
        <p className="boot__sub">Connexion à la base de données…</p>
      </div>
    );
  }

  return (
    <div className={`dex${pending ? " dex--pending" : ""}`}>
      <header className="dex__head">
        <span className="dex__no">N°{padDex(detail.id)}</span>
        <h1 className="dex__name">{detail.name}</h1>
        <span className="dex__genus">
          {detail.nameFr && detail.nameFr !== detail.name
            ? `${detail.nameFr} · ${detail.genus}`
            : detail.genus}
        </span>
      </header>

      <div className="dex__body">
        <figure className="stage">
          <div className="stage__halo" />
          {/* L'illustration officielle, en filigrane derrière le sprite. */}
          <img
            key={`art-${detail.id}`}
            className="stage__art"
            src={detail.artwork}
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
          {/* Sprite animé Génération V — l'image même de Noir/Blanc. */}
          <img
            key={detail.id}
            className="stage__sprite"
            src={detail.sprite}
            alt={detail.name}
            onError={(e) => {
              e.currentTarget.src = staticUrl(detail.id);
            }}
          />
          <div className="stage__pad" />
          <figcaption className="stage__types">
            {detail.types.map((t) => (
              <span key={t} className={`type type--${t}`}>
                {TYPE_LABELS[t] ?? t}
              </span>
            ))}
          </figcaption>
        </figure>

        <div className="panel">
          {tab === "info" && <InfoTab detail={detail} />}
          {tab === "stats" && <StatsTab detail={detail} />}
          {tab === "evo" && <EvoTab detail={detail} onSelect={onSelect} />}
        </div>
      </div>
    </div>
  );
}

function InfoTab({ detail }: { detail: PokemonDetail }) {
  return (
    <div className="info">
      <dl className="info__grid">
        <div className="info__cell">
          <dt>TAILLE</dt>
          <dd>{formatHeight(detail.height)}</dd>
        </div>
        <div className="info__cell">
          <dt>POIDS</dt>
          <dd>{formatWeight(detail.weight)}</dd>
        </div>
        <div className="info__cell info__cell--wide">
          <dt>TALENTS</dt>
          <dd>{detail.abilities.join(" · ")}</dd>
        </div>
      </dl>
      <div className="entry">
        <span className="entry__label">ENTRÉE DU POKÉDEX</span>
        <p className="entry__text">{detail.flavor}</p>
      </div>
    </div>
  );
}

/** 255 est le maximum théorique, mais l'échelle 200 lit mieux à l'écran. */
const STAT_SCALE = 200;

function StatsTab({ detail }: { detail: PokemonDetail }) {
  return (
    <div className="stats">
      {detail.stats.map((s) => (
        <div key={s.key} className="stat">
          <span className="stat__label">{s.label}</span>
          <span className="stat__value">{s.value}</span>
          <span className="stat__track">
            <span
              className={`stat__fill stat__fill--${s.key}`}
              style={{
                width: `${Math.min(s.value / STAT_SCALE, 1) * 100}%`,
              }}
            />
          </span>
        </div>
      ))}
      <div className="stat stat--total">
        <span className="stat__label">TOTAL</span>
        <span className="stat__value">{detail.total}</span>
        <span className="stat__track">
          <span
            className="stat__fill stat__fill--total"
            style={{ width: `${Math.min(detail.total / 720, 1) * 100}%` }}
          />
        </span>
      </div>
    </div>
  );
}

function EvoTab({
  detail,
  onSelect,
}: {
  detail: PokemonDetail;
  onSelect: (id: number) => void;
}) {
  if (detail.evolution.length <= 1) {
    return (
      <div className="evo evo--empty">
        <p>Ce Pokémon n&apos;évolue pas.</p>
      </div>
    );
  }

  return (
    <div className="evo">
      {detail.evolution.map((level, i) => (
        <div className="evo__level" key={i}>
          {i > 0 && <span className="evo__arrow" aria-hidden="true" />}
          <div className="evo__row">
            {level.map((node) => (
              <button
                type="button"
                key={node.id}
                className={`evo__node${
                  node.id === detail.id ? " evo__node--current" : ""
                }`}
                onClick={() => onSelect(node.id)}
              >
                <img
                  src={iconUrl(node.id)}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = staticUrl(node.id);
                  }}
                />
                <span className="evo__name">{node.name}</span>
                {node.detail && (
                  <span className="evo__detail">{node.detail}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
