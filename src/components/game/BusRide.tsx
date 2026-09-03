"use client";

import { coachSprite } from "@/lib/game/sprites";

/**
 * Le trajet en autocar : le décor défile, le car tangue, et la destination
 * s'affiche le temps du voyage. Purement décoratif — l'arrivée est déclenchée
 * par une minuterie du côté du jeu.
 */
export default function BusRide({ destination }: { destination: string }) {
  return (
    <div className="ride">
      <span className="ride__sky" aria-hidden="true" />
      <span className="ride__hills" aria-hidden="true" />
      <span className="ride__trees" aria-hidden="true" />
      <span className="ride__road" aria-hidden="true" />
      <span className="ride__dashes" aria-hidden="true" />

      <img className="ride__coach" src={coachSprite()} alt="Autocar des Cars Faure" />

      <div className="ride__panel">
        <span className="ride__brand">CARS FAURE</span>
        <span className="ride__to">Direction {destination}</span>
        <span className="ride__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
