"use client";

import { animatedBackUrl, animatedUrl, staticBackUrl, staticUrl } from "@/lib/pokeapi";
import { expForLevel, species } from "@/lib/game/data";
import { activeMon, maxHp, type BattleState, type Mon } from "@/lib/game/battle";
import { trainerPortrait } from "@/lib/game/sprites";
import type { NpcSprite } from "@/lib/game/world";

type Props = {
  state: BattleState;
  message: string | null;
  /** Le lanceur de Poké Ball est en vol. */
  throwing: boolean;
  /** Le dresseur est encore en scène, avant d'envoyer son premier Pokémon. */
  trainerSprite?: NpcSprite | null;
};

const pct = (value: number, total: number) =>
  `${Math.max(0, Math.min(100, (value / total) * 100))}%`;

function HpBar({ mon }: { mon: Mon }) {
  const max = maxHp(mon);
  const ratio = mon.hp / max;
  const tone = ratio > 0.5 ? "high" : ratio > 0.2 ? "mid" : "low";
  return (
    <span className="hpbar">
      <span className={`hpbar__fill hpbar__fill--${tone}`} style={{ width: pct(mon.hp, max) }} />
    </span>
  );
}

/** Les étoiles qui saluent l'entrée d'un chromatique. */
function Sparks() {
  return (
    <span className="sparks" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <i key={i} />
      ))}
    </span>
  );
}

function Plate({ mon, own }: { mon: Mon; own: boolean }) {
  const max = maxHp(mon);
  const floor = expForLevel(mon.level);
  const ceiling = expForLevel(mon.level + 1);
  return (
    <div className={`plate${own ? " plate--own" : ""}`}>
      <div className="plate__row">
        <span className="plate__name">{mon.name}</span>
        {mon.shiny && (
          <span className="shiny-mark" title="Chromatique">
            ✦
          </span>
        )}
        <span className="plate__lvl">N.{mon.level}</span>
      </div>
      <div className="plate__row">
        <span className="plate__tag">PV</span>
        <HpBar mon={mon} />
      </div>
      {own && (
        <>
          <div className="plate__hp">
            {mon.hp} / {max}
          </div>
          <span className="expbar">
            <span
              className="expbar__fill"
              style={{ width: pct(mon.exp - floor, Math.max(1, ceiling - floor)) }}
            />
          </span>
        </>
      )}
    </div>
  );
}

/** L'écran du haut pendant un combat : terrain, jauges et boîte de texte. */
export default function BattleView({ state, message, throwing, trainerSprite }: Props) {
  const mine = activeMon(state);
  const foe = state.foe;

  return (
    <div className="battle">
      <div className="battle__field">
        <div className="battle__slot battle__slot--foe">
          <span className="battle__pad" />
          {trainerSprite ? (
            <img
              className="battle__trainer-sprite"
              src={trainerPortrait(trainerSprite)}
              alt={`${state.trainer?.title} ${state.trainer?.name}`}
            />
          ) : (
            <img
              key={`foe-${foe.uid}`}
              className={`battle__sprite${foe.hp <= 0 ? " battle__sprite--down" : ""}`}
              src={animatedUrl(foe.id, foe.shiny) ?? staticUrl(foe.id, foe.shiny)}
              alt={foe.name}
              onError={(e) => {
                e.currentTarget.src = staticUrl(foe.id, foe.shiny);
              }}
            />
          )}
          {!trainerSprite && foe.shiny && <Sparks />}
          {throwing && <span className="battle__ball" aria-hidden="true" />}
        </div>

        <div className="battle__slot battle__slot--mine">
          <span className="battle__pad" />
          <img
            key={`mine-${mine.uid}`}
            className={`battle__sprite battle__sprite--back${mine.hp <= 0 ? " battle__sprite--down" : ""}`}
            src={animatedBackUrl(mine.id, mine.shiny) ?? staticBackUrl(mine.id, mine.shiny)}
            alt={mine.name}
            onError={(e) => {
              e.currentTarget.src = staticBackUrl(mine.id, mine.shiny);
            }}
          />
          {mine.shiny && <Sparks />}
        </div>

        {!trainerSprite && (
          <div className="battle__plate battle__plate--foe">
            <Plate mon={foe} own={false} />
            {state.kind === "sauvage" && (
              <span className="battle__wild">{species(foe.id).genus}</span>
            )}
          </div>
        )}
        <div className="battle__plate battle__plate--mine">
          <Plate mon={mine} own />
        </div>

        {state.kind === "dresseur" && state.trainer && (
          <div className="battle__trainer">
            {state.trainer.title} {state.trainer.name}
            <span className="battle__balls">
              {"●".repeat(state.foeTeam.length + (foe.hp > 0 ? 1 : 0))}
            </span>
          </div>
        )}
      </div>

      <div className="battle__text">
        {message ? (
          <>
            <p>{message}</p>
            <span className="battle__next" aria-hidden="true">
              ▼
            </span>
          </>
        ) : (
          <p className="battle__prompt">
            Que doit faire <strong>{mine.name}</strong> ?
          </p>
        )}
      </div>
    </div>
  );
}
