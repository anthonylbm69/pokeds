"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Les douze commandes physiques de la console. */
export type DsButton =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "x"
  | "y"
  | "l"
  | "r"
  | "start"
  | "select";

/**
 * Ce que fournit un « mode » de la console (Pokédex, jeu…) : le contenu des
 * deux dalles, la réaction aux boutons et le petit compteur de la coque.
 */
export type ModeParts = {
  top: React.ReactNode;
  bottom: React.ReactNode;
  press: (button: DsButton) => void;
  count?: string;
};

type Props = {
  top: React.ReactNode;
  bottom: React.ReactNode;
  onPress: (button: DsButton) => void;
  /** Info-bulle de chaque bouton : ce qu'il déclenche dans le Pokédex. */
  labels?: Partial<Record<DsButton, string>>;
  /** Petit compteur gravé sous l'écran tactile. */
  count?: string;
  /** Éclair blanc sur les deux dalles, au lancement du jeu. */
  flash?: boolean;
  /** Boutons maintenus : le jeu s'en sert pour faire marcher le héros. */
  onHold?: (buttons: ReadonlySet<DsButton>) => void;
};

/** Ces boutons se répètent tant qu'on les maintient, comme sur la console. */
const REPEATING = new Set<DsButton>(["up", "down", "left", "right", "l", "r"]);
const REPEAT_DELAY = 380;
const REPEAT_RATE = 90;

/** Clavier → bouton. `typing` : la touche passe même pendant une saisie. */
const KEY_MAP: { key: string; button: DsButton; typing?: boolean }[] = [
  { key: "ArrowUp", button: "up", typing: true },
  { key: "ArrowDown", button: "down", typing: true },
  { key: "ArrowLeft", button: "left" },
  { key: "ArrowRight", button: "right" },
  { key: "PageUp", button: "l", typing: true },
  { key: "PageDown", button: "r", typing: true },
  { key: "Enter", button: "a", typing: true },
  { key: "Escape", button: "b", typing: true },
  { key: "Backspace", button: "b" },
  { key: "x", button: "x" },
  { key: "y", button: "y" },
  { key: "/", button: "start" },
  { key: "s", button: "select" },
];

const KEYS = new Map(KEY_MAP.map((k) => [k.key.toLowerCase(), k]));

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/**
 * La coque : deux dalles empilées, les commandes de part et d'autre de l'écran
 * tactile. Elle traduit clavier et clics en appuis de boutons — c'est le
 * Pokédex qui décide de ce que chaque bouton déclenche.
 */
export default function DSConsole({
  top,
  bottom,
  onPress,
  labels = {},
  count,
  flash = false,
  onHold,
}: Props) {
  const shell = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [held, setHeld] = useState<DsButton | null>(null);
  const [keyed, setKeyed] = useState<ReadonlySet<DsButton>>(new Set());

  // Les minuteries d'auto-répétition tirent longtemps après le rendu courant.
  const press = useRef(onPress);
  useEffect(() => {
    press.current = onPress;
  }, [onPress]);

  /* ------------------------------------------------------ mise à l'échelle */

  // La console a une taille fixe, en pixels de maquette : on la réduit juste
  // ce qu'il faut pour qu'elle tienne dans la fenêtre.
  useEffect(() => {
    const node = shell.current;
    if (!node) return;

    const measure = () => {
      const w = node.offsetWidth || 1;
      const h = node.offsetHeight || 1;
      // Un peu plus d'air en bas : la ligne de crédits s'y glisse.
      setFit(
        clamp(
          Math.min((window.innerWidth - 28) / w, (window.innerHeight - 56) / h),
          0.3,
          1.4,
        ),
      );
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const scale = (fit ?? 1) * zoom;

  /* --------------------------------------------------- déplacement & zoom */

  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  const onGrabDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      ox: pan.x,
      oy: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onGrabMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPan({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
  };

  const onGrabUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const onGrabWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) return; // laissé au zoom du navigateur
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 0.4, 2.4));
  };

  const recenter = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const grab = {
    onPointerDown: onGrabDown,
    onPointerMove: onGrabMove,
    onPointerUp: onGrabUp,
    onPointerCancel: onGrabUp,
    onWheel: onGrabWheel,
    onDoubleClick: recenter,
  };

  /* -------------------------------------------------------------- appuis */

  const delay = useRef<number | null>(null);
  const repeat = useRef<number | null>(null);

  const stopRepeat = useCallback(() => {
    if (delay.current !== null) window.clearTimeout(delay.current);
    if (repeat.current !== null) window.clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  const onButtonDown =
    (button: DsButton) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setHeld(button);
      press.current(button);
      if (!REPEATING.has(button)) return;
      delay.current = window.setTimeout(() => {
        repeat.current = window.setInterval(
          () => press.current(button),
          REPEAT_RATE,
        );
      }, REPEAT_DELAY);
    };

  const onButtonUp = () => {
    stopRepeat();
    setHeld(null);
  };

  // Le clavier pilote la même console : la touche enfoncée s'affiche aussi.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const entry = KEYS.get(e.key.toLowerCase());
      if (!entry) return;

      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement;
      if (typing && !entry.typing) return;
      if (e.repeat && !REPEATING.has(entry.button)) return;

      e.preventDefault();
      setKeyed((set) => new Set(set).add(entry.button));
      press.current(entry.button);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const entry = KEYS.get(e.key.toLowerCase());
      if (!entry) return;
      setKeyed((set) => {
        const next = new Set(set);
        next.delete(entry.button);
        return next;
      });
    };

    const clear = () => setKeyed(new Set());

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // Les boutons maintenus sont republiés à chaque changement : le jeu s'en
  // sert pour la marche continue, là où un simple appui ne suffirait pas.
  useEffect(() => {
    if (!onHold) return;
    const all = new Set(keyed);
    if (held) all.add(held);
    onHold(all);
  }, [held, keyed, onHold]);

  const key = (id: DsButton, className: string, face: string) => (
    <button
      type="button"
      className={className}
      data-pressed={held === id || keyed.has(id)}
      aria-label={labels[id] ?? face}
      title={labels[id] ? `${face} — ${labels[id]}` : face}
      onPointerDown={onButtonDown(id)}
      onPointerUp={onButtonUp}
      onPointerCancel={onButtonUp}
      onLostPointerCapture={onButtonUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span aria-hidden="true">{face}</span>
    </button>
  );

  return (
    <div
      ref={shell}
      className={`ds${dragging ? " is-dragging" : ""}`}
      style={{
        opacity: fit === null ? 0 : 1,
        transform: `translate(${pan.x}px, ${pan.y}px) translate(-50%, -50%) scale(${scale})`,
      }}
    >
      {/* ---------------------------------------------------- écran du haut */}
      <div className="ds__lid">
        <span className="ds__grab" {...grab} aria-hidden="true" />
        <div className="ds__lid-face">
          <span className="ds__speaker" aria-hidden="true" />
          <section className="ds__screen" aria-label="Écran supérieur">
            <div className="ds__glass">{top}</div>
            {flash && <span className="ds__flash" aria-hidden="true" />}
          </section>
          <span className="ds__speaker" aria-hidden="true" />
        </div>
        <span className="ds__led" aria-hidden="true" />
      </div>

      {/* ------------------------------------------------------- charnière */}
      <div className="ds__hinge" {...grab}>
        <span className="ds__hinge-cap" aria-hidden="true" />
        <span className="ds__brand">POKéDEX&nbsp;·&nbsp;DS</span>
        <span className="ds__hinge-cap" aria-hidden="true" />
      </div>

      {/* --------------------------------------- écran tactile & commandes */}
      <div className="ds__base">
        <span className="ds__grab" {...grab} aria-hidden="true" />

        {key("l", "ds__shoulder ds__shoulder--l", "L")}
        {key("r", "ds__shoulder ds__shoulder--r", "R")}

        <div className="ds__deck">
          <div className="ds__dpad">
            {key("up", "ds__btn ds__d ds__d--up", "▲")}
            {key("left", "ds__btn ds__d ds__d--left", "◀")}
            {key("right", "ds__btn ds__d ds__d--right", "▶")}
            {key("down", "ds__btn ds__d ds__d--down", "▼")}
            <span className="ds__dpad-hub" aria-hidden="true" />
          </div>

          <section className="ds__screen" aria-label="Écran tactile">
            <div className="ds__glass">{bottom}</div>
            {flash && <span className="ds__flash" aria-hidden="true" />}
          </section>

          <div className="ds__face">
            {key("x", "ds__btn ds__f ds__f--x", "X")}
            {key("y", "ds__btn ds__f ds__f--y", "Y")}
            {key("a", "ds__btn ds__f ds__f--a", "A")}
            {key("b", "ds__btn ds__f ds__f--b", "B")}
          </div>
        </div>

        <div className="ds__tray">
          <span className="ds__count">{count}</span>
          <span className="ds__mic" aria-hidden="true" />
          <span className="ds__pills">
            {key("select", "ds__pill", "SELECT")}
            {key("start", "ds__pill", "START")}
          </span>
        </div>
      </div>
    </div>
  );
}
