import { describe, expect, it } from "vitest";
import { CIEL_FR, CIEL_MS, CIEL_SIGNE, skyAt, weatherOf, type Ciel } from "./ciel";
import { MAPS, type MapId, type MapSpec } from "./world";
import { WEATHER_FR, createMon, playerMove, startTrainer, startWild } from "./battle";
import { emptyBag } from "./items";

const maps = Object.entries(MAPS) as [MapId, MapSpec][];
const dehors = maps.filter(([, m]) => !m.indoor);

describe("le ciel d'un lieu", () => {
  it("reste dégagé sous un toit, à toute heure", () => {
    for (const [id, map] of maps) {
      if (!map.indoor) continue;
      for (let t = 0; t < 40; t++) {
        expect(skyAt(map, id, t * CIEL_MS), `${id}`).toBe("beau");
      }
    }
  });

  it("ne change pas pendant tout un quart d'heure", () => {
    const depart = 1_000 * CIEL_MS;
    const attendu = skyAt(MAPS.route1, "route1", depart);
    for (const dt of [0, 1, 1000, 60_000, CIEL_MS - 1]) {
      expect(skyAt(MAPS.route1, "route1", depart + dt)).toBe(attendu);
    }
  });

  it("se retrouve à l'identique : rien n'est gardé en mémoire", () => {
    const quand = 12_345 * CIEL_MS + 777;
    for (const [id, map] of dehors) {
      expect(skyAt(map, id, quand)).toBe(skyAt(map, id, quand));
    }
  });

  it("ne donne jamais qu'un ciel connu", () => {
    const connus: Ciel[] = ["beau", "pluie", "soleil", "sable"];
    for (const [id, map] of dehors) {
      for (let t = 0; t < 60; t++) {
        expect(connus, `${id}`).toContain(skyAt(map, id, t * CIEL_MS));
      }
    }
  });

  it("finit par tourner, plutôt que de figer une carte", () => {
    const vus = new Set<Ciel>();
    for (let t = 0; t < 400; t++) vus.add(skyAt(MAPS.route1, "route1", t * CIEL_MS));
    expect(vus.size, "la Route 1 a toujours le même temps").toBeGreaterThan(1);
  });

  it("ne fait pas le même temps partout au même instant", () => {
    const quand = 9_999 * CIEL_MS;
    const vus = new Set(dehors.map(([id, map]) => skyAt(map, id, quand)));
    expect(vus.size, "toute la région sous le même ciel").toBeGreaterThan(1);
  });

  it("garde le désert plus sec que la forêt, à la longue", () => {
    const compter = (id: MapId, cherche: Ciel) => {
      const map = MAPS[id];
      let n = 0;
      for (let t = 0; t < 3000; t++) {
        if (skyAt(map, id, t * CIEL_MS) === cherche) n += 1;
      }
      return n;
    };
    const desert = dehors.find(([, m]) => m.biome === "desert");
    const foret = dehors.find(([, m]) => m.biome === "foret");
    expect(desert, "aucune carte de désert").toBeDefined();
    expect(foret, "aucune carte de forêt").toBeDefined();
    // Le sable appartient au désert ; la pluie, à la forêt.
    expect(compter(desert![0], "sable")).toBeGreaterThan(compter(foret![0], "sable"));
    expect(compter(foret![0], "pluie")).toBeGreaterThan(compter(desert![0], "pluie"));
  });
});

describe("ce que le ciel installe en combat", () => {
  it("ne pose rien quand il est dégagé", () => {
    expect(weatherOf("beau")).toBeUndefined();
  });

  it("passe la météo telle quelle sinon", () => {
    expect(weatherOf("pluie")).toBe("pluie");
    expect(weatherOf("soleil")).toBe("soleil");
    expect(weatherOf("sable")).toBe("sable");
  });

  it("ouvre un duel sauvage sous ce temps-là", () => {
    const mine = createMon(495, 20, false);
    const foe = createMon(504, 20, false);
    const state = startWild([mine], foe, emptyBag(), "pluie");
    expect(state.weather?.kind).toBe("pluie");
    expect(state.weather?.dehors).toBe(true);
  });

  it("ouvre aussi un duel de dresseur sous ce temps-là", () => {
    const mine = createMon(495, 20, false);
    const team = [createMon(504, 20, false)];
    const state = startTrainer(
      [mine],
      team,
      { name: "Bruno", title: "Dresseur", reward: 100 },
      emptyBag(),
      "sable",
    );
    expect(state.weather?.kind).toBe("sable");
  });

  it("laisse le duel sans météo quand le ciel est dégagé", () => {
    const state = startWild(
      [createMon(495, 20, false)],
      createMon(504, 20, false),
      emptyBag(),
      undefined,
    );
    expect(state.weather).toBeUndefined();
  });

  it("tient tout le duel, au lieu de se dissiper", () => {
    const mine = createMon(495, 60, false);
    const foe = createMon(504, 5, false);
    let etat = startWild([mine], foe, emptyBag(), "pluie");
    // Bien au-delà des quelques tours d'une météo posée par une attaque.
    for (let i = 0; i < 12 && etat.outcome === "en-cours"; i++) {
      etat = playerMove(etat, 0).state;
    }
    expect(etat.weather?.kind, "le ciel s'est dissipé").toBe("pluie");
  });

  it("gratte quand même sous le sable", () => {
    const mine = createMon(495, 30, false);
    const foe = createMon(504, 30, false);
    const etat = startWild([mine], foe, emptyBag(), "sable");
    const { messages } = playerMove(etat, 0);
    expect(messages.join(" ")).toContain("sable");
  });
});

describe("comment on le dit", () => {
  it("nomme chaque ciel, et lui donne un signe", () => {
    for (const ciel of ["beau", "pluie", "soleil", "sable"] as Ciel[]) {
      expect(CIEL_FR[ciel]?.length, `${ciel}`).toBeGreaterThan(0);
      expect(CIEL_SIGNE[ciel]?.length, `${ciel}`).toBeGreaterThan(0);
    }
  });

  it("garde les phrases de combat pour la météo seule", () => {
    for (const ciel of ["pluie", "soleil", "sable"] as const) {
      expect(WEATHER_FR[ciel].length).toBeGreaterThan(0);
    }
  });
});
