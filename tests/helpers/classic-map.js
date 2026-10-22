import { initialTerrain } from "../../src/engine.js";

// The original handcrafted mission remains a controlled fixture for regressions
// that deliberately exercise named cells or replay its established legal route.
export function classicOptions(options = {}) {
  return { terrain: initialTerrain(), seed: "CLASSIC", ...options };
}
