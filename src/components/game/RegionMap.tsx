"use client";

import { REGION, regionNodeOf, type MapId } from "@/lib/game/world";

/**
 * La carte de la région, telle qu'on la déplie sur la dalle du haut : les
 * villes, les routes et le trait qui les relie, du sud au nord. Le lieu où
 * l'on se trouve clignote — intérieurs compris, une Arène comptant pour sa
 * ville.
 */
export default function RegionMap({ current }: { current: MapId }) {
  const here = regionNodeOf(current);

  return (
    <div className="atlas">
      <header className="atlas__head">
        <span className="atlas__title">CARTE DE LA RÉGION</span>
        <span className="atlas__here">{here?.label ?? "Lieu inconnu"}</span>
      </header>

      <div className="atlas__sheet">
        <svg
          className="atlas__links"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {REGION.slice(1).map((node, i) => (
            <line
              key={node.map}
              x1={REGION[i].x}
              y1={REGION[i].y}
              x2={node.x}
              y2={node.y}
            />
          ))}
        </svg>

        {REGION.map((node) => (
          <span
            key={node.map}
            className={[
              "atlas__node",
              `atlas__node--${node.kind}`,
              `atlas__node--${node.biome}`,
              here?.map === node.map && "atlas__node--here",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span className="atlas__dot" aria-hidden="true" />
            <span className="atlas__label">{node.short}</span>
          </span>
        ))}
      </div>

      <ul className="atlas__legend">
        {(
          [
            ["plaine", "Plaine"],
            ["foret", "Forêt"],
            ["desert", "Désert"],
            ["montagne", "Montagne"],
          ] as const
        ).map(([biome, label]) => (
          <li key={biome}>
            <span className={`atlas__chip atlas__node--${biome}`} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
