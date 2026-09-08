import { beforeEach, describe, expect, it } from "vitest";
import {
  SLOTS,
  clearSlot,
  exportName,
  exportSave,
  giveStarter,
  giveHeld,
  takeHeld,
  TOWER_BASE_LEVEL,
  TOWER_MAX_TEAM,
  towerFoe,
  towerLose,
  towerReward,
  towerWin,
  hasSave,
  importSave,
  loadGame,
  newGame,
  reviveGame,
  saveGame,
  slotInfo,
  withFlag,
  type GameState,
} from "./state";
import { createMon, maxHp } from "./battle";
import { emptyBag } from "./items";

/** Un `localStorage` de fortune : les tests tournent hors navigateur. */
class MemoireLocale {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const memoire = new MemoireLocale();
beforeEach(() => {
  memoire.clear();
  (globalThis as { localStorage?: unknown }).localStorage = memoire;
});

const partie = (nom = "Anthony"): GameState => {
  const base = giveStarter(newGame(nom), 495);
  return withFlag(withFlag(base, "insigne:trio"), "insigne:sylve");
};

describe("les emplacements", () => {
  it("sont deux, et se distinguent", () => {
    expect(SLOTS).toEqual([1, 2]);
    saveGame({ ...partie("Un"), money: 111 }, 1);
    saveGame({ ...partie("Deux"), money: 222 }, 2);
    expect(loadGame(1)?.name).toBe("Un");
    expect(loadGame(2)?.name).toBe("Deux");
    expect(loadGame(1)?.money).toBe(111);
  });

  it("gardent la clé historique pour le premier", () => {
    saveGame(partie(), 1);
    // Une partie déjà commencée doit se retrouver où elle était.
    expect(memoire.getItem("pokeds:partie")).not.toBeNull();
    expect(memoire.getItem("pokeds:partie:2")).toBeNull();
  });

  it("se signalent vides quand ils le sont", () => {
    expect(loadGame(2)).toBeNull();
    expect(hasSave(2)).toBe(false);
    expect(slotInfo(2)).toBeNull();

    saveGame(partie(), 2);
    expect(hasSave(2)).toBe(true);
  });

  it("se résument sans tout charger", () => {
    saveGame(partie("Anthony"), 1);
    const info = slotInfo(1);
    expect(info?.name).toBe("Anthony");
    expect(info?.badges).toBe(2);
    expect(info?.party).toBe(1);
    expect(info?.map).toBe("bourg");
  });

  it("s'effacent un par un", () => {
    saveGame(partie("Un"), 1);
    saveGame(partie("Deux"), 2);
    clearSlot(1);
    expect(hasSave(1)).toBe(false);
    expect(hasSave(2)).toBe(true);
  });
});

describe("l'export vers un fichier", () => {
  it("emballe la partie avec de quoi la reconnaître", () => {
    const fichier = JSON.parse(exportSave(partie()));
    expect(fichier.jeu).toBe("pokeds");
    expect(fichier.version).toBe(1);
    expect(typeof fichier.exporte).toBe("string");
    expect(fichier.partie.name).toBe("Anthony");
  });

  it("nomme le fichier d'après le dresseur et le jour", () => {
    const nom = exportName(partie("Anthony"));
    expect(nom).toMatch(/^pokeds-anthony-\d{4}-\d{2}-\d{2}\.json$/);
    // Un nom exotique ne doit pas produire un fichier illisible.
    expect(exportName(partie("Éric l'Ancien"))).toMatch(/^pokeds-[a-z0-9-]+-/);
  });

  it("fait l'aller-retour sans rien perdre", () => {
    const avant = { ...partie(), money: 4242, caught: [1, 25, 143] };
    const lu = importSave(exportSave(avant));
    expect("erreur" in lu).toBe(false);
    if ("erreur" in lu) return;
    expect(lu.state.name).toBe(avant.name);
    expect(lu.state.money).toBe(4242);
    expect(lu.state.caught).toEqual([1, 25, 143]);
    expect(lu.state.party[0].id).toBe(avant.party[0].id);
    expect(lu.state.flags).toEqual(avant.flags);
  });
});

describe("l'import d'un fichier", () => {
  it("refuse ce qui n'est pas du JSON", () => {
    const lu = importSave("ceci n'est pas un fichier");
    expect("erreur" in lu && lu.erreur).toContain("lisible");
  });

  it("refuse un JSON qui vient d'ailleurs", () => {
    const lu = importSave(JSON.stringify({ hello: "world" }));
    expect("erreur" in lu && lu.erreur).toContain("ne vient pas de ce jeu");
  });

  it("refuse une sauvegarde abîmée", () => {
    const lu = importSave(
      JSON.stringify({ jeu: "pokeds", version: 1, partie: { version: 9, party: null } }),
    );
    expect("erreur" in lu && lu.erreur).toContain("abîmée");
  });

  it("remet d'aplomb une partie d'avant les ajouts récents", () => {
    // Le format d'origine : ni sac, ni boîte, ni nature.
    const ancienne = {
      version: 1,
      name: "Vieux",
      map: "bourg",
      x: 6,
      y: 6,
      dir: "down",
      party: [
        {
          uid: "a",
          id: 495,
          name: "Vipélierre",
          level: 20,
          exp: 8000,
          ivs: { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 },
          hp: 9999,
          moves: [{ id: "charge", pp: 30, max: 30 }],
        },
      ],
      balls: 7,
      potions: 4,
      money: 500,
      flags: ["starter"],
      seen: [],
      caught: [],
      respawn: { map: "bourg", x: 6, y: 6 },
    };
    const lu = importSave(JSON.stringify({ jeu: "pokeds", version: 1, partie: ancienne }));
    expect("erreur" in lu).toBe(false);
    if ("erreur" in lu) return;

    const mon = lu.state.party[0];
    expect(lu.state.bag.ball).toBe(7);
    expect(lu.state.bag.potion).toBe(4);
    expect(lu.state.box).toEqual([]);
    expect(mon.nature).toBe(0);
    expect(mon.status).toBeNull();
    // Les PV gonflés d'un fichier bricolé sont ramenés au maximum.
    expect(mon.hp).toBe(maxHp(mon));
  });
});

describe("la remise d'aplomb", () => {
  it("écarte tout ce qui n'a pas la forme d'une partie", () => {
    expect(reviveGame(null)).toBeNull();
    expect(reviveGame({ version: 2, party: [] })).toBeNull();
    expect(reviveGame({ version: 1, party: "pas un tableau" })).toBeNull();
  });

  it("ne reprend jamais une partie au milieu de l'eau ni en selle", () => {
    const state = reviveGame({ ...partie(), surfing: true, riding: true, bag: emptyBag() });
    expect(state?.surfing).toBe(false);
    expect(state?.riding).toBe(false);
    // Le vélo, lui, reste acquis.
    expect(reviveGame({ ...partie(), bike: true })?.bike).toBe(true);
  });
});

describe("les objets tenus", () => {
  const equipe = (): GameState => {
    const base = giveStarter(newGame("Test"), 495);
    return {
      ...base,
      party: [...base.party, createMon(500, 20, false)],
      bag: { ...emptyBag(), restes: 2, ceinture: 1 },
    };
  };

  it("se confient, et se voient sur le Pokémon", () => {
    const { state, message } = giveHeld(equipe(), "restes", 0);
    expect(state.party[0].held).toBe("restes");
    expect(state.bag.restes).toBe(1);
    expect(message).toContain("porte maintenant");
  });

  it("rendent au sac celui qu'on remplace, plutôt que de l'écraser", () => {
    const avec = giveHeld(equipe(), "restes", 0).state;
    const { state, message } = giveHeld(avec, "ceinture", 0);
    expect(state.party[0].held).toBe("ceinture");
    // Les Restes sont revenus au sac : rien ne se perd.
    expect(state.bag.restes).toBe(2);
    expect(state.bag.ceinture).toBe(0);
    expect(message).toContain("rend");
  });

  it("se reprennent et retournent au sac", () => {
    const avec = giveHeld(equipe(), "restes", 0).state;
    const { state, message } = takeHeld(avec, 0);
    expect(state.party[0].held).toBeNull();
    expect(state.bag.restes).toBe(2);
    expect(message).toContain("rend");
  });

  it("refusent ce qu'on n'a pas, ou un rang absent", () => {
    const sans = { ...equipe(), bag: emptyBag() };
    expect(giveHeld(sans, "restes", 0).state).toBe(sans);

    const avec = equipe();
    expect(giveHeld(avec, "restes", 9).state).toBe(avec);
    expect(takeHeld(avec, 0).message).toContain("ne porte rien");
  });

  it("ne se donnent pas deux fois au même", () => {
    const avec = giveHeld(equipe(), "restes", 0).state;
    const encore = giveHeld(avec, "restes", 0);
    expect(encore.state).toBe(avec);
    expect(encore.message).toContain("porte déjà");
  });

  it("survivent à l'aller-retour par un fichier", () => {
    const avec = giveHeld(equipe(), "restes", 0).state;
    const lu = importSave(exportSave(avec));
    expect("erreur" in lu).toBe(false);
    if ("erreur" in lu) return;
    expect(lu.state.party[0].held).toBe("restes");
  });
});

describe("la Tour de Combat", () => {
  it("monte d'un niveau à chaque duel, et d'un Pokémon tous les trois", () => {
    expect(towerFoe(0).level).toBe(TOWER_BASE_LEVEL);
    expect(towerFoe(0).team).toBe(1);
    expect(towerFoe(1).level).toBe(TOWER_BASE_LEVEL + 1);
    expect(towerFoe(3).team).toBe(2);
    expect(towerFoe(6).team).toBe(3);
  });

  it("plafonne le niveau et l'effectif", () => {
    expect(towerFoe(200).level).toBe(100);
    expect(towerFoe(200).team).toBe(TOWER_MAX_TEAM);
  });

  it("donne un nom à chaque adversaire, et les fait tourner", () => {
    const noms = new Set(Array.from({ length: 12 }, (_, i) => towerFoe(i).name));
    expect(noms.size).toBeGreaterThan(5);
    for (const i of [0, 5, 40]) expect(towerFoe(i).name.length).toBeGreaterThan(0);
  });

  it("paie de plus en plus", () => {
    expect(towerReward(1)).toBeGreaterThan(towerReward(0));
    expect(towerReward(10)).toBeGreaterThan(towerReward(1));
  });

  it("allonge la série et retient le record", () => {
    let state = { ...newGame("Test"), money: 0 };
    state = towerWin(state);
    expect(state.towerRun).toBe(1);
    expect(state.towerBest).toBe(1);
    expect(state.wins).toBe(1);
    expect(state.money).toBe(towerReward(0));

    state = towerWin(state);
    expect(state.towerRun).toBe(2);
    expect(state.towerBest).toBe(2);
  });

  it("remet la série à zéro sans effacer le record", () => {
    let state = towerWin(towerWin(newGame("Test")));
    const record = state.towerBest;
    state = towerLose(state);
    expect(state.towerRun).toBe(0);
    expect(state.towerBest).toBe(record);
  });

  it("ne reprend jamais une série en cours après un rechargement", () => {
    const avec = { ...towerWin(newGame("Test")), towerRun: 7 };
    saveGame(avec, 1);
    const relu = loadGame(1);
    expect(relu?.towerRun).toBe(0);
    // Le record, lui, survit.
    expect(relu?.towerBest).toBe(avec.towerBest);
  });
});

describe("les compteurs de la carte de Dresseur", () => {
  it("partent de zéro", () => {
    const neuf = newGame("Test");
    expect(neuf.played).toBe(0);
    expect(neuf.wins).toBe(0);
    expect(neuf.towerBest).toBe(0);
  });

  it("survivent à l'aller-retour par un fichier", () => {
    const avant = { ...newGame("Test"), played: 7200, wins: 42, towerBest: 9 };
    const lu = importSave(exportSave(avant));
    expect("erreur" in lu).toBe(false);
    if ("erreur" in lu) return;
    expect(lu.state.played).toBe(7200);
    expect(lu.state.wins).toBe(42);
    expect(lu.state.towerBest).toBe(9);
  });

  it("se remplissent à zéro pour une partie d'avant", () => {
    const state = reviveGame({ ...newGame("Test"), played: undefined, wins: undefined });
    expect(state?.played).toBe(0);
    expect(state?.wins).toBe(0);
  });
});
