import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Les modules du jeu s'importent entre eux avec l'alias `@`, celui de
 * Next.js. Sans ce rappel, un test placé hors de `src/lib` ne sait pas le
 * résoudre.
 */
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
