import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/engine.js";
import {
  TILE_CATALOG,
  TILE_BY_ID,
  blankLevel,
  normalizeLevel,
  validateLevel,
  canStand,
  exportPlayableHtml,
  levelFromGenerated,
} from "../src/levels.js";
import { generateMap } from "../src/maps.js";

test("level files round-trip all 28 tiles, layers and directions without sharing caller data", () => {
  assert.equal(TILE_CATALOG.length, 28);
  const level = blankLevel();
  level.units = [];
  for (const [i, t] of TILE_CATALOG.entries()) {
    const x = i % 8,
      y = Math.floor(i / 8);
    level[t.layer][y][x] = t.id;
    level.directions[y][x] = "south";
  }
  const copy = normalizeLevel(JSON.parse(JSON.stringify(level)));
  assert.deepEqual(copy, level);
  copy.ground[0][0] = "mud";
  assert.equal(level.ground[0][0], "grass");
});

test("malformed levels, versions, coordinates, duplicate units, waves and unknown tiles are rejected", () => {
  for (const mutate of [
    (l) => (l.version = 3),
    (l) => l.ground.pop(),
    (l) => (l.ground[0][0] = "unknown"),
    (l) => (l.objects[0][0] = "mud"),
    (l) => (l.units[0].x = 8),
    (l) => l.units.push({ ...l.units[0] }),
    (l) => (l.units[0].element = "wind"),
    (l) => (l.rules.maxRounds = 0),
    (l) => (l.rules.waves = [{ round: 6, kinds: ["melee"] }]),
    (l) => (l.rules.waves = [{ round: 2, kinds: ["dragon"] }]),
    (l) => (l.directions[0][0] = "diagonal"),
  ]) {
    const l = blankLevel();
    mutate(l);
    assert.throws(() => normalizeLevel(l));
  }
});

test("draft files may omit units, but playable validation reports missing allies and enemies", () => {
  const l = blankLevel();
  l.units = [];
  assert.doesNotThrow(() => normalizeLevel(l));
  assert.equal(validateLevel(l).errors.length, 2);
  assert.throws(() => new Battle({ level: l }));
});

test("future terrain effects are retained in JSON and explicitly reported for playtesting", () => {
  const l = blankLevel();
  l.effects[0][0] = "spikes";
  l.ground[0][1] = "ice";
  const report = validateLevel(l);
  assert.deepEqual(report.errors, []);
  assert.match(report.warnings.join(" "), /Espinhos/);
  assert.match(report.warnings.join(" "), /Gelo/);
  assert.equal(normalizeLevel(l).effects[0][0], "spikes");
});

test("a level starts with exactly its placed characters, positions, rules and enemy budget", () => {
  const l = blankLevel();
  l.rules = { maxRounds: 8, waves: [{ round: 3, kinds: ["ranged", "melee"] }] };
  const b = new Battle({ level: l });
  assert.deepEqual(
    b.units.map(({ id, x, y }) => ({ id, x, y })),
    l.units.map(({ id, x, y }) => ({ id, x, y })),
  );
  assert.equal(b.enemies.length, 2);
  assert.equal(b.totalEnemies, 4);
  assert.equal(b.maxRounds, 8);
  assert.equal(b.allies.find((u) => u.element === "earth").range, 3);
  assert.equal(b.units.find((u) => u.id === "enemy-2").hp, 1);
  b.damage(b.allies[0], 1);
  b.terrain[0][0] = "tree";
  b.reset();
  assert.equal(b.allies[0].hp, 3);
  assert.equal(b.terrain[0][0], "grass");
  assert.equal(l.ground[0][0], "grass");
});

test("mud uses weighted shortest paths and a move can still be undone", () => {
  const l = blankLevel();
  l.units[0].x = 0;
  l.units[0].y = 0;
  l.ground[0][1] = "mud";
  l.ground[0][2] = "mud";
  const b = new Battle({ level: l });
  b.select("fire");
  assert.equal(b.reachable().get("1,0").steps, 2);
  assert.equal(b.reachable().has("2,0"), false);
  assert.equal(b.reachable(b.selected, 6).get("2,0").steps, 4);
  assert.equal(b.move(1, 0), true);
  assert.equal(b.undoMove(), true);
  assert.deepEqual([b.selected.x, b.selected.y], [0, 0]);
  // A longer route around an expensive strip must win over a direct costly route.
  l.ground[0][3] = "mud";
  const c = new Battle({ level: l });
  c.select("fire");
  assert.equal(c.reachable(c.selected, 10).get("4,0").steps, 6);
  assert.equal(c.reachable(c.selected, 10).get("4,0").path.length, 6);
});

test("deep water and abyss block walking but allow shots; bridges restore walkability", () => {
  const l = blankLevel();
  Object.assign(l.units[0], { x: 0, y: 0 });
  Object.assign(l.units[3], { x: 3, y: 0 });
  l.ground[0][1] = "deep-water";
  l.ground[0][2] = "abyss";
  const b = new Battle({ level: l });
  assert.equal(b.obstacle(1, 0), true);
  assert.equal(b.obstacle(2, 0), true);
  assert.equal(b.blocksShot(1, 0), false);
  assert.equal(b.fire(3, 0), true);
  assert.equal(b.enemies.find((u) => u.id === "enemy-1").hp, 1);
  l.objects[0][1] = "bridge";
  assert.equal(canStand(l, 1, 0), true);
  const bridge = new Battle({ level: l });
  assert.equal(bridge.obstacle(1, 0), false);
  assert.equal(bridge.move(1, 0), true);
});

test("crates push with the wave and restore their original terrain when destroyed", () => {
  const l = blankLevel();
  Object.assign(l.units[1], { x: 2, y: 3 });
  l.ground[3][3] = "sand";
  l.objects[3][3] = "crate";
  l.ground[3][4] = "mud";
  const b = new Battle({ level: l });
  b.select("water");
  const crate = b.structureAt(3, 3);
  const preview = b.previewAction(2, 3, "special");
  assert.equal(preview.structureMoves[0].type, "crate");
  assert.equal(b.wave(), true);
  assert.equal(b.terrain[3][3], "sand");
  assert.equal(crate.hp, 1);
  assert.equal(b.structureAt(4, 3), crate);
  b.damage(crate, 1);
  assert.equal(b.terrain[3][4], "mud");
  assert.equal(b.structureAt(4, 3), null);
});

test("pillars and log segments take damage without moving", () => {
  for (const type of ["pillar", "log"]) {
    const l = blankLevel();
    Object.assign(l.units[0], { x: 2, y: 3 });
    l.objects[3][3] = type;
    const b = new Battle({ level: l });
    assert.equal(b.punch(3, 3), true);
    assert.equal(b.structureAt(3, 3).hp, 1);
    assert.equal(b.structureAt(4, 3), null);
  }
});

test("custom waves use marked entrances, preserve blocked reinforcements and assign unique IDs", () => {
  const l = blankLevel();
  l.units = l.units.filter((u) => u.team === "ally");
  l.effects[0][0] = "reinforcement";
  l.rules.waves = [{ round: 2, kinds: ["melee", "ranged"] }];
  const b = new Battle({ level: l });
  assert.equal(b.totalEnemies, 2);
  b.round = 2;
  assert.equal(b.spawnReinforcements(), 1);
  assert.deepEqual([b.enemies[0].x, b.enemies[0].y], [0, 0]);
  assert.equal(b.pendingReinforcements, 1);
  b.damage(b.enemies[0], 2);
  assert.equal(b.spawnReinforcements(), 1);
  assert.equal(b.enemies[0].kind, "ranged");
  assert.equal(b.enemies[0].id, "enemy-2");
});

test("a custom phase can be won with legal actions and then replaced with a generated mission", () => {
  const l = blankLevel();
  l.units = l.units.filter((u) => u.team === "ally" || u.kind === "ranged");
  Object.assign(l.units[0], { x: 2, y: 3 });
  Object.assign(l.units[3], { x: 3, y: 3 });
  const b = new Battle({ level: l });
  assert.equal(b.punch(3, 3), true);
  assert.equal(b.phase, "victory");
  assert.equal(b.kills, 1);
  b.newMap("editor-return");
  assert.equal(b.options.level, undefined);
  assert.equal(b.levelLayers, null);
  assert.equal(b.totalEnemies, 9);
});

test("generated maps convert to editable layers without losing any initial placement", () => {
  const map = generateMap("level-roundtrip"),
    level = levelFromGenerated(map),
    battle = new Battle({ level });
  assert.deepEqual(battle.terrain, map.terrain);
  assert.deepEqual(validateLevel(level).errors, []);
  for (const u of level.units)
    assert.deepEqual({ x: u.x, y: u.y }, map.spawns[u.id]);
});

test("vapor blocks fire and crossbow shots but not adjacent melee attacks", () => {
  const level = blankLevel();
  Object.assign(level.units[0], { x: 0, y: 0 });
  Object.assign(level.units[4], { x: 2, y: 0 });
  level.effects[0][1] = "steam";
  const b = new Battle({ level });
  assert.equal(b.fire(2, 0), false);
  assert.equal(b.obstacle(1, 0), false);
  const archer = b.enemies.find((u) => u.kind === "ranged");
  archer.intent = { x: 0, y: 0 };
  assert.equal(b.enemyAttackValid(archer), false);
  assert.deepEqual(b.enemyThreatenedCells(archer), []);
  assert.deepEqual(
    b.enemyThreatenedCells({
      x: 1,
      y: 1,
      kind: "melee",
      intent: { x: 1, y: 0 },
    }),
    [{ x: 1, y: 0 }],
  );
});

test("heated rocks keep their identity and HP when pushed onto another ground tile", () => {
  const level = blankLevel();
  Object.assign(level.units[1], { x: 2, y: 3 });
  level.objects[3][3] = "hot-rock";
  level.ground[3][4] = "sand";
  const b = new Battle({ level });
  b.select("water");
  const rock = b.structureAt(3, 3);
  assert.equal(b.wave(), true);
  assert.equal(b.structureAt(4, 3), rock);
  assert.equal(rock.hp, 2);
  assert.equal(rock.underlay, "sand");
  assert.equal(b.terrain[3][3], "grass");
  assert.equal(b.levelLayers.effects[3][3], null);
});

test("exported HTML embeds a playable level safely even when its name contains script markup", () => {
  const l = blankLevel();
  l.name = "</script><script>window.pwned=true</script>";
  const html = exportPlayableHtml(
    "<html><head></head><body>Triade.createApp</body></html>",
    l,
  );
  const data = html.match(/window\.__TRIADE_LEVEL__=(.*);<\/script>/)[1];
  assert.equal(data.includes("<"), false);
  assert.equal(JSON.parse(data).name, l.name);
  assert.throws(() => exportPlayableHtml("bad", l));
});
