import { describe, expect, it } from "vitest";
import { MON_COLORS, hex, poster, reduce } from "./palette";

const rgb = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;
const parts = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe("la mise sur paliers", () => {
  it("rend une couleur valide pour n'importe quelle entrée", () => {
    for (let r = 0; r <= 255; r += 17) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 17) {
          const out = poster(r, g, b);
          expect(Number.isInteger(out)).toBe(true);
          for (const canal of parts(out)) {
            expect(canal, `${r},${g},${b}`).toBeGreaterThanOrEqual(0);
            expect(canal).toBeLessThanOrEqual(255);
          }
        }
      }
    }
  });

  it("garde la teinte dominante de l'entrée", () => {
    const [r, g, b] = parts(poster(220, 40, 40));
    expect(r, "un rouge doit rester rouge").toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);

    const [r2, g2, b2] = parts(poster(40, 60, 200));
    expect(b2, "un bleu doit rester bleu").toBeGreaterThan(r2);
    expect(b2).toBeGreaterThan(g2);
  });

  it("écarte le blanc pur et le noir pur, réservés au liseré", () => {
    const entrees: [number, number, number][] = [
      [255, 255, 255],
      [0, 0, 0],
      [8, 8, 8],
    ];
    for (const entree of entrees) {
      const canaux = parts(poster(entree[0], entree[1], entree[2]));
      const clair = Math.max(...canaux);
      const sombre = Math.min(...canaux);
      expect(clair, `${entree}`).toBeLessThan(255);
      expect(sombre, `${entree}`).toBeGreaterThan(0);
    }
  });

  it("ne rend qu'un petit nombre de couleurs distinctes", () => {
    const vues = new Set<number>();
    for (let r = 0; r <= 255; r += 5) {
      for (let g = 0; g <= 255; g += 5) {
        for (let b = 0; b <= 255; b += 5) vues.add(poster(r, g, b));
      }
    }
    // Douze teintes × quatre saturations × quatre clartés, au grand maximum.
    expect(vues.size).toBeLessThanOrEqual(12 * 4 * 4);
  });

  it("range deux nuances voisines sur le même palier", () => {
    expect(poster(200, 60, 60)).toBe(poster(203, 62, 58));
  });
});

describe("la réduction de palette", () => {
  it("ne garde jamais plus de teintes que la limite", () => {
    const pixels: number[] = [];
    for (let i = 0; i < 200; i++) pixels.push(poster(i, (i * 7) % 256, (i * 13) % 256));
    const table = reduce(pixels);
    expect(new Set(table.values()).size).toBeLessThanOrEqual(MON_COLORS);
  });

  it("répond pour chaque couleur reçue", () => {
    const pixels = [rgb(200, 0, 0), rgb(0, 200, 0), rgb(0, 0, 200), rgb(200, 0, 0)];
    const table = reduce(pixels);
    for (const p of pixels) expect(table.has(p)).toBe(true);
  });

  it("garde les teintes les plus présentes", () => {
    const dominante = rgb(210, 40, 40);
    const rare = rgb(20, 200, 40);
    const pixels = [...Array(50).fill(dominante), rare];
    const table = reduce(pixels);
    expect(table.get(dominante)).toBe(dominante);
    // Le vert isolé survit : il reste de la place dans la palette.
    expect(table.get(rare)).toBe(rare);
  });

  it("rabat une teinte de trop sur la plus proche, pas sur n'importe laquelle", () => {
    // Sept couleurs pour six places : la moins fréquente doit se replier.
    const base = [
      rgb(200, 0, 0), rgb(0, 200, 0), rgb(0, 0, 200),
      rgb(200, 200, 0), rgb(0, 200, 200), rgb(200, 0, 200),
    ];
    const pixels = base.flatMap((c) => Array(20).fill(c));
    const intrus = rgb(190, 10, 10); // presque le premier rouge
    pixels.push(intrus);
    const table = reduce(pixels);
    expect(new Set(table.values()).size).toBeLessThanOrEqual(MON_COLORS);
    expect(table.get(intrus)).toBe(base[0]);
  });

  it("ne bronche pas sur une image vide", () => {
    expect(reduce([]).size).toBe(0);
  });
});

describe("l'écriture des couleurs", () => {
  it("rend un code hexadécimal complet, zéros compris", () => {
    expect(hex(rgb(0, 0, 0))).toBe("#000000");
    expect(hex(rgb(255, 255, 255))).toBe("#ffffff");
    expect(hex(rgb(1, 2, 3))).toBe("#010203");
    expect(hex(rgb(23, 26, 32))).toBe("#171a20");
  });

  it("écrit ce que la mise sur paliers produit", () => {
    for (let i = 0; i < 64; i++) {
      const code = hex(poster(i * 4, 255 - i * 4, (i * 9) % 256));
      expect(code).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
