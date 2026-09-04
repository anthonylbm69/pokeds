/**
 * La musique du jeu, entièrement synthétisée par l'API Web Audio : aucun
 * fichier audio dans le dépôt. Les thèmes sont originaux — la bande-son des
 * jeux est protégée — mais ils gardent la couleur chiptune de la console.
 *
 * Une piste est une suite de voix jouées en boucle. Chaque pas vaut une
 * double-croche ; « - » marque un silence.
 */

const SEMITONES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** « A4 », « F#3 » → fréquence en hertz. */
export function frequency(name: string): number {
  const parsed = /^([a-g])(#|b)?(-?\d)$/i.exec(name);
  if (!parsed) return 0;
  const [, letter, accidental, octave] = parsed;
  const semitone =
    SEMITONES[letter.toLowerCase()] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return 440 * 2 ** ((semitone - 9) / 12 + (Number(octave) - 4));
}

export type Step = { note: string; len: number };

/** « C4:4 E4:2 -:2 » → suite de pas. */
export function parseVoice(source: string): Step[] {
  return source
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [note, len] = token.split(":");
      return { note, len: Number(len) };
    });
}

export const voiceLength = (steps: Step[]) =>
  steps.reduce((total, step) => total + step.len, 0);

type Voice = {
  source: string;
  wave: OscillatorType;
  gain: number;
  /** Proportion du pas réellement tenue : en dessous de 1, les notes piquent. */
  hold?: number;
};

export type Track = {
  tempo: number;
  loop: boolean;
  voices: Voice[];
};

export type TrackId = keyof typeof TRACKS;

export const TRACKS = {
  /* Bourgades et intérieurs : do majeur, tranquille. */
  ville: {
    tempo: 120,
    loop: true,
    voices: [
      {
        wave: "square",
        gain: 0.16,
        source: `
          G4:2 A4:2 C5:4 B4:4 G4:4
          A4:2 G4:2 E4:4 G4:8
          F4:2 G4:2 A4:4 G4:4 E4:4
          D4:2 E4:2 C4:4 C4:8
        `,
      },
      {
        wave: "triangle",
        gain: 0.2,
        source: "C3:8 E3:8 G3:8 C3:8 F3:8 A3:8 G3:8 G2:8",
      },
    ],
  },

  /* Les routes : ré majeur, allant et martelé. */
  route: {
    tempo: 148,
    loop: true,
    voices: [
      {
        wave: "square",
        gain: 0.15,
        source: `
          D4:2 D4:2 F#4:4 A4:4 D5:4
          C#5:2 B4:2 A4:4 F#4:8
          G4:2 G4:2 B4:4 D5:4 B4:4
          A4:2 G4:2 F#4:4 D4:8
        `,
      },
      {
        wave: "triangle",
        gain: 0.2,
        hold: 0.6,
        source: `
          D3:4 D3:4 A2:4 A2:4 D3:4 D3:4 F#3:4 F#3:4
          G3:4 G3:4 D3:4 D3:4 A2:4 A2:4 D3:8
        `,
      },
    ],
  },

  /* Combat sauvage : la mineur, nerveux. */
  combat: {
    tempo: 168,
    loop: true,
    voices: [
      {
        wave: "square",
        gain: 0.15,
        source: `
          A4:2 A4:2 C5:2 E5:2 A5:4 G5:4
          E5:2 D5:2 C5:2 B4:2 A4:8
          F4:2 F4:2 A4:2 C5:2 F5:4 E5:4
          D5:2 C5:2 B4:2 A4:2 E4:8
        `,
      },
      {
        wave: "sawtooth",
        gain: 0.12,
        hold: 0.5,
        source: `
          A2:2 A2:2 A2:2 A2:2 A2:2 A2:2 A2:2 A2:2
          E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2
          F2:2 F2:2 F2:2 F2:2 F2:2 F2:2 F2:2 F2:2
          E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2
        `,
      },
    ],
  },

  /* Combat de Dresseurs et Arène : mi mineur, plus mordant. */
  dresseur: {
    tempo: 176,
    loop: true,
    voices: [
      {
        wave: "square",
        gain: 0.16,
        source: `
          E4:2 G4:2 B4:2 E5:2 D5:4 B4:4
          A4:2 B4:2 G4:2 A4:2 E4:8
          C5:2 B4:2 A4:2 G4:2 F#4:4 A4:4
          G4:2 F#4:2 E4:2 D4:2 E4:8
        `,
      },
      {
        wave: "sawtooth",
        gain: 0.12,
        hold: 0.5,
        source: `
          E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2
          B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2
          C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2
          B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2
        `,
      },
    ],
  },

  /* Les sables : ré mineur teinté de seconde bémol, lancinant. */
  desert: {
    tempo: 132,
    loop: true,
    voices: [
      {
        wave: "square",
        gain: 0.15,
        source: `
          D4:4 Eb4:4 F4:4 D4:4
          G4:4 F4:2 Eb4:2 D4:8
          A4:4 Bb4:4 A4:4 F4:4
          Eb4:4 D4:4 C4:4 D4:4
        `,
      },
      {
        wave: "triangle",
        gain: 0.19,
        source: "D3:8 D3:8 Bb2:8 Bb2:8 F3:8 F3:8 A2:8 A2:8",
      },
    ],
  },

  /* Les cimes : la mineur, lent et aéré, pour la neige et la crête. */
  cime: {
    tempo: 96,
    loop: true,
    voices: [
      {
        wave: "triangle",
        gain: 0.18,
        source: `
          A4:8 C5:8
          E5:8 D5:4 C5:4
          B4:8 G4:8
          A4:8 -:8
        `,
      },
      {
        wave: "square",
        gain: 0.1,
        hold: 0.9,
        source: "A2:8 A2:8 F2:8 F2:8 G2:8 G2:8 A2:8 A2:8",
      },
    ],
  },

  /* La Ligue : mi mineur, ample et pressant. */
  ligue: {
    tempo: 160,
    loop: true,
    voices: [
      {
        wave: "square",
        gain: 0.16,
        source: `
          E4:2 B4:2 E5:4 D5:2 C5:2 B4:4
          A4:2 B4:2 C5:4 B4:2 A4:2 G4:4
          F#4:2 A4:2 D5:4 C5:2 B4:2 A4:4
          G4:2 F#4:2 E4:4 B4:4 E5:4
        `,
      },
      {
        wave: "sawtooth",
        gain: 0.12,
        hold: 0.5,
        source: `
          E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 E2:2
          C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2 C3:2
          D3:2 D3:2 D3:2 D3:2 D3:2 D3:2 D3:2 D3:2
          B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2 B2:2
        `,
      },
    ],
  },

  /* Jingle de soin, joué une fois. */
  soin: {
    tempo: 132,
    loop: false,
    voices: [
      { wave: "square", gain: 0.18, source: "C5:2 E5:2 G5:2 C6:6" },
      { wave: "triangle", gain: 0.18, source: "C4:6 G4:6" },
    ],
  },

  /* Fanfare de victoire, joué une fois. */
  victoire: {
    tempo: 150,
    loop: false,
    voices: [
      { wave: "square", gain: 0.18, source: "G4:2 G4:2 G4:2 G4:6 E4:2 F4:2 G4:4 -:4" },
      { wave: "triangle", gain: 0.18, source: "C3:8 C3:8 C3:8" },
    ],
  },
} as const satisfies Record<string, Track>;

/**
 * Le thème d'un lieu. Les préfixes comptent : toute nouvelle Arène ou salle
 * de Ligue hérite du bon morceau sans qu'on ait à y penser — c'est l'oubli
 * qui avait laissé deux Arènes sur la musique de ville.
 */
export function trackForMap(map: string): TrackId {
  if (map.startsWith("arene")) return "dresseur";
  if (map.startsWith("ligue")) return "ligue";
  if (map === "route5") return "desert";
  if (map === "route6" || map === "route7" || map === "route8") return "cime";
  return map.startsWith("route") ? "route" : "ville";
}

type Event = { note: string; len: number; voice: Voice };

/** Range les notes d'une piste par position, pour un ordonnancement direct. */
function compile(track: Track): { byStep: Map<number, Event[]>; length: number } {
  const byStep = new Map<number, Event[]>();
  let length = 0;

  for (const voice of track.voices) {
    let at = 0;
    for (const step of parseVoice(voice.source)) {
      if (step.note !== "-") {
        const bucket = byStep.get(at) ?? [];
        bucket.push({ note: step.note, len: step.len, voice });
        byStep.set(at, bucket);
      }
      at += step.len;
    }
    length = Math.max(length, at);
  }

  return { byStep, length };
}

const LOOKAHEAD_MS = 25;
const HORIZON_S = 0.2;

/**
 * Lecteur : il programme les notes un peu à l'avance pour rester régulier,
 * même quand le rendu du jeu accapare le fil principal.
 */
class Player {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private compiled: { byStep: Map<number, Event[]>; length: number } | null = null;
  private track: Track | null = null;
  private cursor = 0;
  private nextTime = 0;
  private current: TrackId | null = null;
  /** Piste à reprendre après un jingle. */
  private resumeTo: TrackId | null = null;
  private muted = false;

  get playing(): TrackId | null {
    return this.current;
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    // Le navigateur suspend le contexte tant qu'aucun geste n'a eu lieu.
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  play(id: TrackId): void {
    if (this.current === id) return;
    const ctx = this.ensure();
    if (!ctx) return;

    const track = TRACKS[id] as Track;
    if (!track.loop) this.resumeTo = this.current;

    this.stopTimer();
    this.track = track;
    this.compiled = compile(track);
    this.cursor = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.current = id;
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  /** Coupe la musique, par exemple en quittant le jeu. */
  stop(): void {
    this.stopTimer();
    this.current = null;
    this.resumeTo = null;
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const track = this.track;
    const compiled = this.compiled;
    if (!ctx || !track || !compiled || compiled.length === 0) return;

    const stepDuration = 60 / track.tempo / 4;

    while (this.nextTime < ctx.currentTime + HORIZON_S) {
      if (!track.loop && this.cursor >= compiled.length) {
        // Le jingle est fini : on rend la main au thème précédent.
        const back = this.resumeTo;
        this.stopTimer();
        this.current = null;
        this.resumeTo = null;
        if (back) this.play(back);
        return;
      }

      const events = compiled.byStep.get(this.cursor % compiled.length);
      if (events) {
        for (const event of events) {
          this.emit(event, this.nextTime, event.len * stepDuration);
        }
      }
      this.cursor += 1;
      this.nextTime += stepDuration;
    }
  }

  private emit(event: Event, when: number, duration: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    const hold = duration * (event.voice.hold ?? 0.85);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = event.voice.wave;
    osc.frequency.value = frequency(event.note);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(event.voice.gain, when + 0.012);
    gain.gain.setValueAtTime(event.voice.gain, when + hold * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + hold);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + hold + 0.02);
  }
}

/** Un seul lecteur pour toute la partie. */
export const music = new Player();
