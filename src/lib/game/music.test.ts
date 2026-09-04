import { describe, expect, it } from "vitest";
import { MAPS } from "./world";
import { TRACKS, frequency, parseVoice, trackForMap, voiceLength } from "./music";

describe("hauteurs", () => {
  it("place le la du diapason et ses octaves", () => {
    expect(frequency("A4")).toBeCloseTo(440, 3);
    expect(frequency("A5")).toBeCloseTo(880, 3);
    expect(frequency("A3")).toBeCloseTo(220, 3);
  });

  it("lit les altérations", () => {
    expect(frequency("C4")).toBeCloseTo(261.626, 2);
    expect(frequency("F#4")).toBeCloseTo(369.994, 2);
    expect(frequency("Bb4")).toBeCloseTo(466.164, 2);
  });
});

describe("lecture d'une voix", () => {
  it("découpe les pas", () => {
    expect(parseVoice("C4:4 -:2 G4:2")).toEqual([
      { note: "C4", len: 4 },
      { note: "-", len: 2 },
      { note: "G4", len: 2 },
    ]);
  });
});

describe("le thème de chaque lieu", () => {
  const lieux = Object.keys(MAPS);

  it("existe, et boucle, pour toutes les cartes", () => {
    for (const lieu of lieux) {
      const piste = trackForMap(lieu);
      expect(TRACKS[piste], `${lieu} → piste inconnue`).toBeDefined();
      expect(TRACKS[piste].loop, `${lieu} → ${piste} ne boucle pas`).toBe(true);
    }
  });

  it("donne aux trois Arènes le thème de combat", () => {
    for (const arene of ["arene", "arene2", "arene3"]) {
      expect(trackForMap(arene), arene).toBe("dresseur");
    }
  });

  it("donne au Plateau et à ses cinq salles le thème de la Ligue", () => {
    for (const salle of ["ligue", "ligue1", "ligue2", "ligue3", "ligue4", "ligue5"]) {
      expect(trackForMap(salle), salle).toBe("ligue");
    }
  });

  it("distingue les sables et les cimes des routes ordinaires", () => {
    expect(trackForMap("route5")).toBe("desert");
    expect(trackForMap("route6")).toBe("cime");
    expect(trackForMap("route7")).toBe("cime");
    expect(trackForMap("route8")).toBe("cime");
    expect(trackForMap("route1")).toBe("route");
    expect(trackForMap("route4")).toBe("route");
  });

  it("laisse villes et intérieurs sur le thème de ville", () => {
    for (const lieu of ["bourg", "maillard", "aigueperse", "mions", "centre", "maison"]) {
      expect(trackForMap(lieu), lieu).toBe("ville");
    }
  });
});

describe.each(Object.entries(TRACKS))("piste %s", (name, track) => {
  const voices = track.voices.map((voice) => parseVoice(voice.source));

  it("n'emploie que des notes lisibles", () => {
    for (const steps of voices) {
      for (const step of steps) {
        expect(step.len, `${name} : durée invalide`).toBeGreaterThan(0);
        if (step.note === "-") continue;
        expect(frequency(step.note), `${name} : note « ${step.note} »`).toBeGreaterThan(0);
      }
    }
  });

  it("garde toutes ses voix de la même longueur", () => {
    const lengths = voices.map(voiceLength);
    expect(new Set(lengths).size, `${name} : voix désalignées (${lengths.join(", ")})`).toBe(1);
  });

  it("tient dans un nombre entier de mesures", () => {
    expect(voiceLength(voices[0]) % 4, `${name} : boucle bancale`).toBe(0);
  });

  it("annonce un tempo plausible", () => {
    expect(track.tempo).toBeGreaterThanOrEqual(60);
    expect(track.tempo).toBeLessThanOrEqual(220);
  });
});
