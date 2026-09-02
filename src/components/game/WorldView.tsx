"use client";

import { useEffect, useRef } from "react";
import { TILE, drawCharacter, drawTile, variantFor } from "@/lib/game/sprites";
import {
  MAPS,
  STEP,
  TILES,
  tileChar,
  walkable,
  type Dir,
  type MapId,
  type NpcSpec,
} from "@/lib/game/world";
import type { DsButton } from "../DSConsole";

export type PlayerPos = {
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  /** Avancement sur la case en cours, de 0 à 1. */
  progress: number;
  /** Pose de marche : 0 au repos, 1 et 2 en alternance. */
  frame: number;
  /** Petit temps d'arrêt quand on pivote sans avancer. */
  turnDelay: number;
};

export const newPlayer = (x: number, y: number, dir: Dir): PlayerPos => ({
  x, y, dir, moving: false, progress: 0, frame: 0, turnDelay: 0,
});

type Props = {
  mapId: MapId;
  npcs: NpcSpec[];
  player: React.RefObject<PlayerPos>;
  held: React.RefObject<ReadonlySet<DsButton>>;
  paused: boolean;
  onStep: (x: number, y: number) => void;
};

const VIEW_W = 512;
const VIEW_H = 384;
const WALK_MS = 210;
const RUN_MS = 120;
const TURN_MS = 80;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** L'écran du haut pendant l'exploration : la carte, les PNJ et le héros. */
export default function WorldView({
  mapId,
  npcs,
  player,
  held,
  paused,
  onStep,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // La boucle d'animation lit toujours les dernières valeurs sans redémarrer.
  const latest = useRef({ mapId, npcs, paused, onStep });
  useEffect(() => {
    latest.current = { mapId, npcs, paused, onStep };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    const update = (dt: number) => {
      const p = player.current;
      if (!p || latest.current.paused) return;
      const map = MAPS[latest.current.mapId];
      const buttons = held.current ?? new Set<DsButton>();

      if (p.moving) {
        p.progress += dt / (buttons.has("b") ? RUN_MS : WALK_MS);
        if (p.progress < 1) return;
        const { dx, dy } = STEP[p.dir];
        p.x += dx;
        p.y += dy;
        p.progress = 0;
        p.moving = false;
        latest.current.onStep(p.x, p.y);
        return;
      }

      const dir: Dir | null = buttons.has("up")
        ? "up"
        : buttons.has("down")
          ? "down"
          : buttons.has("left")
            ? "left"
            : buttons.has("right")
              ? "right"
              : null;

      if (!dir) {
        p.frame = 0;
        p.turnDelay = 0;
        return;
      }
      if (p.dir !== dir) {
        p.dir = dir;
        p.turnDelay = TURN_MS;
        return;
      }
      if (p.turnDelay > 0) {
        p.turnDelay -= dt;
        return;
      }

      const { dx, dy } = STEP[dir];
      if (walkable(map, p.x + dx, p.y + dy, latest.current.npcs)) {
        p.moving = true;
        p.progress = 0;
        p.frame = p.frame === 1 ? 2 : 1;
      }
    };

    const draw = () => {
      const p = player.current;
      if (!p) return;
      const map = MAPS[latest.current.mapId];
      const cols = map.tiles[0].length;
      const rows = map.tiles.length;
      const mapW = cols * TILE;
      const mapH = rows * TILE;

      const { dx, dy } = STEP[p.dir];
      const px = (p.x + (p.moving ? dx * p.progress : 0)) * TILE;
      const py = (p.y + (p.moving ? dy * p.progress : 0)) * TILE;

      const camX = Math.round(
        mapW <= VIEW_W ? (mapW - VIEW_W) / 2 : clamp(px + TILE / 2 - VIEW_W / 2, 0, mapW - VIEW_W),
      );
      const camY = Math.round(
        mapH <= VIEW_H ? (mapH - VIEW_H) / 2 : clamp(py + TILE / 2 - VIEW_H / 2, 0, mapH - VIEW_H),
      );

      ctx.fillStyle = map.indoor ? "#1d1a22" : "#20402a";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      const anim = Math.floor(elapsed / 360) % 4;
      const x0 = Math.max(0, Math.floor(camX / TILE));
      const x1 = Math.min(cols - 1, Math.ceil((camX + VIEW_W) / TILE));
      const y0 = Math.max(0, Math.floor(camY / TILE));
      const y1 = Math.min(rows - 1, Math.ceil((camY + VIEW_H) / TILE));

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const tile = TILES[tileChar(map, x, y)];
          if (!tile) continue;
          drawTile(
            ctx,
            tile.kind,
            variantFor(tile.kind, x, y, anim),
            x * TILE - camX,
            y * TILE - camY,
          );
        }
      }

      // Les personnages sont triés par profondeur pour se chevaucher juste.
      const actors: { y: number; paint: () => void }[] = [];
      for (const npc of latest.current.npcs) {
        actors.push({
          y: npc.y,
          paint: () =>
            drawCharacter(ctx, npc.sprite, npc.dir, 0, npc.x * TILE - camX, npc.y * TILE - camY),
        });
      }
      actors.push({
        y: p.y,
        paint: () => drawCharacter(ctx, "joueur", p.dir, p.frame, px - camX, py - camY),
      });
      actors.sort((a, b) => a.y - b.y).forEach((a) => a.paint());

      // Les hautes herbes repassent devant les jambes : on y est vraiment.
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (tileChar(map, x, y) !== ",") continue;
          const sx = x * TILE - camX;
          const sy = y * TILE - camY;
          ctx.save();
          ctx.beginPath();
          ctx.rect(sx, sy + 20, TILE, 12);
          ctx.clip();
          drawTile(ctx, "tall", variantFor("tall", x, y, anim), sx, sy);
          ctx.restore();
        }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      elapsed += dt;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [held, player]);

  return (
    <canvas
      ref={canvasRef}
      className="world"
      width={VIEW_W}
      height={VIEW_H}
      aria-label={`Carte : ${MAPS[mapId].name}`}
    />
  );
}
