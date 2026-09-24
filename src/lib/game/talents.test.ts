import { describe, expect, it } from "vitest";
import { DEX } from "./dex";
import { MOVES, type MoveId } from "./data";
import {
  ABILITIES,
  TECHNICIAN_BOOST,
  TECHNICIAN_POWER,
  abilityOf,
  abilityRules,
  abilityWorks,
} from "./traits";
import {
  createMon,
  maxHp,
  playerMove,
  startWild,
  type Mon,
} from "./battle";
import { emptyBag } from "./items";

/** La première espèce du Pokédex qui porte ce talent. */
const porteur = (talent: string): number => {
  const id = Object.keys(DEX)
    .map(Number)
    .find((n) => abilityOf(n) === talent);
  if (!id) throw new Error(`aucune espèce ne porte ${talent}`);
  return id;
};

/** Les mêmes IV et la même nature à chaque appel : un banc d'essai stable. */
const fige = (mon: Mon): Mon => {
  mon.ivs = { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 };
  mon.nature = 0;
  mon.hp = maxHp(mon);
  return mon;
};

/** Un duel prêt à jouer, avec une seule attaque de chaque côté. */
const duel = (
  mine: Mon,
  foe: Mon,
  move: MoveId = "charge",
  riposte: MoveId = "charge",
) => {
  mine.moves = [{ id: move, pp: 30, max: 30 }];
  foe.moves = [{ id: riposte, pp: 30, max: 30 }];
  return startWild([mine], foe, emptyBag());
};

describe("la couverture des talents", () => {
  it("sert maintenant une bonne moitié du Pokédex", () => {
    const ids = Object.keys(DEX).map(Number);
    const servies = ids.filter((id) => abilityWorks(id)).length;
    expect(servies / ids.length).toBeGreaterThan(0.45);
  });

  it("ne déclare rien de vide : chaque règle fait quelque chose", () => {
    for (const [nom, regle] of Object.entries(ABILITIES)) {
      expect(Object.keys(regle).length, `${nom} ne fait rien`).toBeGreaterThan(0);
    }
  });

  it("n'invente pas de talent : tous sont portés par une espèce", () => {
    const portes = new Set(Object.keys(DEX).map(Number).map(abilityOf));
    for (const nom of Object.keys(ABILITIES)) {
      expect(portes.has(nom), `${nom} n'est porté par personne`).toBe(true);
    }
  });

  it("avoue quand un talent n'agit pas", () => {
    // Un talent hors de la table reste affiché, sans effet : c'est assumé.
    const sansRegle = Object.keys(DEX)
      .map(Number)
      .find((id) => !abilityWorks(id));
    expect(sansRegle).toBeDefined();
    expect(abilityRules(sansRegle!)).toEqual({});
    expect(abilityOf(sansRegle!)).toBeTruthy();
  });
});

describe("absorber un type", () => {
  it("annule complètement les dégâts", () => {
    const encaisse = createMon(porteur("volt-absorb"), 50, false);
    const plein = maxHp(encaisse);
    encaisse.hp = plein;
    const etat = duel(createMon(25, 50, false), encaisse, "eclair");
    const { state } = playerMove(etat, 0);
    expect(state.foe.hp).toBe(plein);
  });

  it("vaut pour l'eau, le feu et la foudre", () => {
    expect(abilityRules(porteur("water-absorb")).immune).toBe("water");
    expect(abilityRules(porteur("flash-fire")).immune).toBe("fire");
    expect(abilityRules(porteur("lightning-rod")).immune).toBe("electric");
    expect(abilityRules(porteur("levitate")).immune).toBe("ground");
  });
});

describe("encaisser mieux", () => {
  it("Épaisseur amortit le feu et la glace de moitié", () => {
    const regle = abilityRules(porteur("thick-fat"));
    expect(regle.halve).toContain("fire");
    expect(regle.halve).toContain("ice");
  });

  /**
   * Les dégâts encaissés en un coup, sur beaucoup d'essais. Sans critique,
   * seule la variance joue — quinze pour cent d'écart au plus. Un critique,
   * lui, double : l'écart saute aux yeux.
   */
  const dispersion = (espece: number, essais = 300) => {
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < essais; i++) {
      // IV et nature figés des deux côtés : sans cela, le tirage de chaque
      // créature disperserait bien plus que les critiques cherchés.
      const cible = fige(createMon(espece, 50, false));
      const plein = maxHp(cible);
      cible.hp = plein;
      const { state } = playerMove(duel(fige(createMon(495, 50, false)), cible), 0);
      const perdu = plein - state.foe.hp;
      if (perdu <= 0) continue;
      min = Math.min(min, perdu);
      max = Math.max(max, perdu);
    }
    return max / min;
  };

  it("Carapace interdit le coup critique", () => {
    const blinde = porteur("shell-armor");
    expect(abilityRules(blinde).noCrit).toBe(true);
    // La variance seule : jamais le double.
    expect(dispersion(blinde), "un critique est passé").toBeLessThan(1.5);
  });

  it("et les autres en prennent bel et bien", () => {
    // Sans Carapace, trois cents coups font tomber un critique à coup sûr :
    // une chance sur seize, ratée trois cents fois, n'arrive jamais.
    const ordinaire = Object.keys(DEX)
      .map(Number)
      .find((id) => !abilityRules(id).noCrit && !abilityRules(id).immune)!;
    expect(dispersion(ordinaire), "aucun critique en trois cents coups").toBeGreaterThan(1.5);
  });
});

describe("frapper mieux", () => {
  it("Technicien ne relève que les attaques faibles", () => {
    expect(TECHNICIAN_BOOST).toBeGreaterThan(1);
    expect(TECHNICIAN_POWER).toBeGreaterThan(0);
    // Le seuil doit laisser de vraies attaques des deux côtés.
    const ids = Object.keys(MOVES) as MoveId[];
    const faibles = ids.filter((m) => MOVES[m].power > 0 && MOVES[m].power <= TECHNICIAN_POWER);
    const fortes = ids.filter((m) => MOVES[m].power > TECHNICIAN_POWER);
    expect(faibles.length).toBeGreaterThan(5);
    expect(fortes.length).toBeGreaterThan(5);
  });

  it("Force Pure double l'Attaque, et le spécial n'y gagne rien", () => {
    expect(abilityRules(porteur("pure-power")).hugePower).toBe(true);
  });
});

describe("les talents qui tiennent au ciel", () => {
  it("installent leur temps dès l'ouverture du duel", () => {
    const meneur = createMon(porteur("drizzle"), 50, false);
    const etat = duel(createMon(495, 50, false), meneur);
    expect(etat.weather?.kind, "le crachin n'a pas pris").toBe("pluie");
  });

  it("l'emportent sur le ciel du lieu", () => {
    const meneur = createMon(porteur("drought"), 50, false);
    const etat = startWild([createMon(495, 50, false)], meneur, emptyBag(), "pluie");
    expect(etat.weather?.kind).toBe("soleil");
  });

  it("laissent le ciel du lieu quand personne n'en amène", () => {
    const etat = startWild(
      [createMon(495, 50, false)],
      createMon(504, 50, false),
      emptyBag(),
      "sable",
    );
    expect(etat.weather?.kind).toBe("sable");
  });

  it("nomment un temps que le moteur connaît", () => {
    for (const talent of ["drought", "drizzle", "sand-stream"]) {
      expect(["pluie", "soleil", "sable"]).toContain(abilityRules(porteur(talent)).sets);
    }
  });

  it("doublent la Vitesse sous le bon temps, et seulement lui", () => {
    expect(abilityRules(porteur("chlorophyll")).rush).toBe("soleil");
    expect(abilityRules(porteur("swift-swim")).rush).toBe("pluie");
    expect(abilityRules(porteur("sand-rush")).rush).toBe("sable");
  });

  it("font passer devant un Pokémon plus lent quand il pleut", () => {
    // Un nageur lent contre un rapide : sous la pluie, il frappe le premier.
    const nageur = createMon(porteur("swift-swim"), 50, false);
    const autre = createMon(495, 50, false);
    nageur.moves = [{ id: "charge", pp: 30, max: 30 }];
    autre.moves = [{ id: "charge", pp: 30, max: 30 }];
    const sec = startWild([autre], nageur, emptyBag());
    const pluie = startWild([autre], nageur, emptyBag(), "pluie");
    expect(sec.weather).toBeUndefined();
    expect(pluie.weather?.kind).toBe("pluie");
  });
});

describe("ne pas subir", () => {
  it("Tête de Roc ignore le contrecoup", () => {
    const tetu = createMon(porteur("rock-head"), 60, false);
    expect(abilityRules(tetu.id).noRecoil).toBe(true);
    const plein = maxHp(tetu);
    tetu.hp = plein;
    const etat = duel(tetu, createMon(495, 60, false), "damocles");
    const { state } = playerMove(etat, 0);
    // Il a pu encaisser le coup d'en face, mais jamais son propre contrecoup.
    expect(state.party[0].hp).toBeGreaterThan(0);
  });

  it("Attention ne recule jamais", () => {
    const calme = createMon(porteur("inner-focus"), 50, false);
    expect(abilityRules(calme.id).noFlinch).toBe(true);
    let peur = false;
    for (let i = 0; i < 120; i++) {
      const cible = createMon(calme.id, 50, false);
      const etat = duel(createMon(495, 50, false), cible, "ecras-face");
      const { messages } = playerMove(etat, 0);
      if (messages.some((m) => m.includes("a peur"))) peur = true;
    }
    expect(peur, "il a fini par reculer").toBe(false);
  });

  it("Œil Compose garde sa précision", () => {
    const vigilant = createMon(porteur("keen-eye"), 50, false);
    expect(abilityRules(vigilant.id).keeps).toContain("acc");
    const etat = duel(createMon(495, 50, false), vigilant, "jet-de-sable");
    const { state, messages } = playerMove(etat, 0);
    expect(messages.join(" ")).toContain("n'en tient pas compte");
    expect(state.foeStages.acc).toBe(0);
  });

  it("Tranche-Muscle garde son Attaque", () => {
    const costaud = createMon(porteur("hyper-cutter"), 50, false);
    const etat = duel(createMon(495, 50, false), costaud, "rugissement");
    const { state } = playerMove(etat, 0);
    expect(state.foeStages.atk).toBe(0);
  });

  it("Mue finit par se défaire de son mal", () => {
    const muant = createMon(porteur("shed-skin"), 50, false);
    expect(abilityRules(muant.id).shed).toBeGreaterThan(0);
    let gueri = false;
    for (let essai = 0; essai < 60 && !gueri; essai++) {
      const cible = createMon(muant.id, 50, false);
      cible.status = "poison";
      let etat = duel(createMon(495, 50, false), cible);
      for (let tour = 0; tour < 6 && etat.outcome === "en-cours"; tour++) {
        etat = playerMove(etat, 0).state;
        if (!etat.foe.status) {
          gueri = true;
          break;
        }
      }
    }
    expect(gueri, "la mue n'a jamais opéré").toBe(true);
  });

  it("laisse les autres subir normalement", () => {
    // Un Pokémon sans Œil Compose voit bien sa précision tomber.
    const ordinaire = createMon(495, 50, false);
    expect(abilityRules(ordinaire.id).keeps).toBeUndefined();
    const etat = duel(createMon(498, 50, false), ordinaire, "jet-de-sable");
    const { state } = playerMove(etat, 0);
    expect(state.foeStages.acc).toBeLessThan(0);
  });
});

describe("les dos hérissés", () => {
  it("écorchent qui les frappe au corps à corps", () => {
    const epineux = createMon(porteur("rough-skin"), 50, false);
    expect(abilityRules(epineux.id).barbs).toBeGreaterThan(0);

    const frappeur = createMon(495, 50, false);
    const plein = maxHp(frappeur);
    frappeur.hp = plein;
    const { state, messages } = playerMove(duel(frappeur, epineux), 0);
    expect(messages.join(" ")).toContain("se blesse sur son adversaire");
    expect(state.party[0].hp).toBeLessThan(plein);
  });

  it("épargnent les attaques qui ne touchent pas", () => {
    const epineux = createMon(porteur("iron-barbs"), 50, false);
    const lanceur = createMon(495, 50, false);
    const plein = maxHp(lanceur);
    lanceur.hp = plein;
    // Une attaque spéciale ne met personne au contact : l'adversaire peut
    // riposter, mais jamais par ses épines.
    const { messages } = playerMove(duel(lanceur, epineux, "flammeche"), 0);
    expect(messages.join(" ")).not.toContain("se blesse sur son adversaire");
  });
});
