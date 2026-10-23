// Pure, deterministic battle rules. Coordinates are zero-based; movement is orthogonal.
import { generateMap, normalizeSeed, randomSeed } from "./maps.js";
import {
  normalizeLevel, validateLevel, levelTerrain,
  deploymentCells, defaultDeploymentCells, suggestedLevelTeam,
} from "./levels.js";
import { ELEMENTS, DEFAULT_TEAM, normalizeTeam, createAlly } from "./roster.js";
import { createEnemy } from "./enemies.js";

export const SIZE = 8;
export const MAX_ROUNDS = 5;
export const REINFORCEMENTS = [
  { round: 2, kinds: ["melee"] },
  { round: 3, kinds: ["melee", "ranged"] },
  { round: 4, kinds: ["lobber"] },
  { round: 5, kinds: ["melee", "ranged"] },
];
export const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export { ELEMENTS } from "./roster.js";
export const key = (x, y) => `${x},${y}`;
export const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const STRUCTURES = {
  tree: { name: "Árvore", maxHp: 2 },
  rock: { name: "Pedra", maxHp: 2 },
  wall: { name: "Muralha em ruínas", maxHp: 2 },
  crate: { name: "Caixa de madeira", maxHp: 1 },
  "hot-rock": { name: "Pedra incandescente", maxHp: 2 },
  pillar: { name: "Pilar", maxHp: 2 },
  log: { name: "Tronco", maxHp: 2 },
};

// Fixed layout retained for custom scenarios and historical regression fixtures.
// New missions use generateMap(seed).
export function initialTerrain() {
  const map = Array.from({ length: SIZE }, () => Array(SIZE).fill("grass"));
  [
    [3, 0],
    [3, 1],
    [3, 2],
    [4, 2],
    [4, 3],
    [4, 4],
    [4, 5],
    [3, 6],
    [4, 6],
    [3, 7],
  ].forEach(([x, y]) => {
    map[y][x] = "water";
  });
  [
    [1, 0],
    [6, 0],
    [0, 3],
    [7, 4],
    [0, 6],
    [6, 7],
  ].forEach(([x, y]) => {
    map[y][x] = "tree";
  });
  [
    [5, 2],
    [2, 4],
    [5, 6],
  ].forEach(([x, y]) => {
    map[y][x] = "rock";
  });
  return map;
}

export class Battle {
  constructor(options = {}) {
    const level = options.level ? normalizeLevel(options.level) : null;
    this.options = {
      waves: options.waves !== false,
      team: normalizeTeam(options.team === undefined ? (level ? suggestedLevelTeam(level) : DEFAULT_TEAM) : options.team),
      deployment: options.deployment === true,
      maxRounds:
        options.maxRounds === undefined ? MAX_ROUNDS : options.maxRounds,
      seed: normalizeSeed(options.seed ?? randomSeed()),
      ...(options.terrain ? { terrain: structuredClone(options.terrain) } : {}),
      ...(options.spawns ? { spawns: structuredClone(options.spawns) } : {}),
      ...(level ? { level } : {}),
    };
    if (this.options.level && validateLevel(this.options.level).errors.length)
      throw new Error(validateLevel(this.options.level).errors.join(" "));
    this.reset();
  }

  // 1. Inicialização / 14. Reinício da missão
  reset() {
    const level = this.options.level;
    this.levelLayers = level
      ? {
          ground: structuredClone(level.ground),
          effects: structuredClone(level.effects),
          directions: structuredClone(level.directions),
        }
      : null;
    const generated = level
      ? {
          seed: "fase-personalizada",
          waterKind: "custom",
          terrain: levelTerrain(level),
          spawns: {},
        }
      : this.options.terrain
        ? {
            seed: this.options.seed,
            waterKind: "custom",
            terrain: structuredClone(this.options.terrain),
            spawns: this.options.spawns || {},
          }
        : generateMap(this.options.seed);
    this.mapSeed = generated.seed;
    this.waterKind = generated.waterKind;
    this.terrain = generated.terrain;
    this.terrainRevision = 0;
    this.barrier = null;
    this.structureSerial = 0;
    this.structures = new Map();
    this.terrain.forEach((row, y) =>
      row.forEach((_, x) => this.structureAt(x, y)),
    );
    this.team = this.options.team.slice();
    const startingSlots = DEFAULT_TEAM.map(
      (id, i) =>
        generated.spawns[id] ||
        [
          { x: 1, y: 5 },
          { x: 2, y: 6 },
          { x: 1, y: 7 },
        ][i],
    );
    this.units = [
      ...this.team.map((id, i) => createAlly(id, startingSlots[i])),
      {
        id: "enemy-1",
        kind: "melee",
        team: "enemy",
        name: "Sentinela I",
        x: 3,
        y: 5,
        hp: 2,
        maxHp: 2,
        range: 2,
      },
      {
        id: "enemy-2",
        kind: "ranged",
        attackRange: 4,
        team: "enemy",
        name: "Besteiro II",
        x: 6,
        y: 2,
        hp: 1,
        maxHp: 1,
        range: 2,
      },
      {
        id: "enemy-3",
        kind: "melee",
        team: "enemy",
        name: "Sentinela III",
        x: 5,
        y: 7,
        hp: 2,
        maxHp: 2,
        range: 2,
      },
    ].map((u) => ({
      ...u,
      ...(u.team === "enemy" ? generated.spawns[u.id] : {}),
      moved: false,
      acted: false,
      intent: null,
    }));
    if (level) {
      const authoredSlots = level.units.filter((u) => u.team === "ally")
        .map(({ x, y }) => ({ x, y }));
      const slots = [
        ...authoredSlots,
        ...deploymentCells(level).filter((p) =>
          !authoredSlots.some((s) => s.x === p.x && s.y === p.y)),
      ];
      this.units = [
        ...this.team.map((element, i) => createAlly(element, slots[i])),
        ...level.units
          .filter((u) => u.team === "enemy")
          .map((u) => createEnemy(u.kind, u.id, u)),
      ];
    }
    this.round = 1;
    this.maxRounds = level ? level.rules.maxRounds : this.options.maxRounds;
    this.reinforcementQueue = level
      ? level.rules.waves.flatMap((wave) =>
          wave.kinds.map((kind) => ({ round: wave.round, kind })),
        )
      : this.options.waves
        ? REINFORCEMENTS.flatMap((wave) =>
            wave.kinds.map((kind) => ({ round: wave.round, kind })),
          )
        : [];
    this.totalEnemies = this.enemies.length + this.reinforcementQueue.length;
    this.enemySerial = Math.max(
      0,
      ...this.enemies.map((u) => Number(u.id.slice(6))),
    );
    this.kills = 0;
    this.resultReason = null;
    this.phase = "player";
    this.selectedId = this.team[0];
    this.mode = "move";
    this.log = [];
    this.lastEffect = null;
    this.visualEvents = [];
    this.deploymentCells = level
      ? deploymentCells(level)
      : this.options.deployment
        ? defaultDeploymentCells(this.terrain, this.allies, this.enemies)
        : [];
    if (this.deploymentCells.length) {
      // Keep valid author positions, then place remaining heroes in free slots.
      const reserved = new Set(
        this.allies.filter((u) => this.inDeploymentArea(u.x, u.y))
          .map((u) => key(u.x, u.y)),
      );
      for (const ally of this.allies) {
        if (this.inDeploymentArea(ally.x, ally.y)) continue;
        const slot = this.deploymentCells.find(
          (p) => !reserved.has(key(p.x, p.y)),
        );
        if (!slot) throw new Error("A área inicial não comporta o esquadrão.");
        Object.assign(ally, slot);
        reserved.add(key(slot.x, slot.y));
      }
      this.phase = "deployment";
      this.addLog("Posicione seu esquadrão nas casas azuis e confirme para começar o combate.");
    } else this.startCombat();
  }

  inDeploymentArea(x, y) {
    return this.deploymentCells.some((p) => p.x === x && p.y === y);
  }

  deploy(x, y) {
    const unit = this.selected;
    if (
      this.phase !== "deployment" || !unit ||
      !Number.isInteger(x) || !Number.isInteger(y) ||
      !this.inDeploymentArea(x, y) || this.obstacle(x, y)
    ) return false;
    const occupant = this.unitAt(x, y);
    if (occupant?.team === "enemy") return false;
    if (occupant && occupant !== unit) {
      if (!this.inDeploymentArea(unit.x, unit.y)) return false;
      Object.assign(occupant, { x: unit.x, y: unit.y });
    }
    Object.assign(unit, { x, y });
    return true;
  }

  confirmDeployment() {
    if (
      this.phase !== "deployment" || this.allies.length !== 3 ||
      this.allies.some((u) => !this.inDeploymentArea(u.x, u.y) || this.obstacle(u.x, u.y)) ||
      new Set(this.units.map((u) => key(u.x, u.y))).size !== this.units.length
    ) return false;
    this.startCombat();
    return true;
  }

  startCombat() {
    this.phase = "player";
    this.mode = "move";
    this.prepareEnemies(!this.options.level);
    this.addLog(`Missão iniciada.${this.maxRounds ? ` Elimine todas as ondas até o turno ${this.maxRounds}.` : " Observe as intenções inimigas."}`, "info");
  }

  newMap(seed = randomSeed()) {
    this.options.seed = normalizeSeed(seed);
    delete this.options.terrain;
    delete this.options.spawns;
    delete this.options.level;
    this.reset();
    return true;
  }

  loadLevel(input) {
    const level = normalizeLevel(input),
      report = validateLevel(level);
    if (report.errors.length) throw new Error(report.errors.join(" "));
    this.options.level = level;
    this.options.team = suggestedLevelTeam(level, this.options.team);
    delete this.options.terrain;
    delete this.options.spawns;
    this.reset();
    return true;
  }

  setTeam(team) {
    const chosen = normalizeTeam(team);
    this.options.team = chosen;
    this.reset();
    return true;
  }

  get pendingReinforcements() {
    return this.reinforcementQueue.length;
  }
  get nextWaveCount() {
    if (this.maxRounds && this.round >= this.maxRounds) return 0;
    return Math.min(
      2,
      this.reinforcementQueue.filter((entry) => entry.round <= this.round + 1)
        .length,
    );
  }
  get waveNumber() {
    return this.round;
  }

  spawnReinforcements() {
    const due = this.reinforcementQueue
      .filter((entry) => entry.round <= this.round)
      .slice(0, 2);
    let spawned = 0;
    for (const entry of due) {
      const cells = [];
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const entrances = this.levelLayers?.effects;
          const marked = entrances?.flat().includes("reinforcement");
          if (
            marked
              ? entrances[y][x] !== "reinforcement"
              : x !== 0 && y !== 0 && x !== SIZE - 1 && y !== SIZE - 1
          )
            continue;
          if (!this.free(x, y)) continue;
          const nearest = Math.min(
            ...this.allies.map((ally) => distance(ally, { x, y })),
          );
          if (nearest >= 2 || marked) cells.push({ x, y, nearest });
        }
      cells.sort((a, b) => a.nearest - b.nearest || b.y - a.y || b.x - a.x);
      const destination = cells[0];
      if (!destination) break;
      const serial = ++this.enemySerial;
      this.units.push(createEnemy(entry.kind, `enemy-${serial}`, destination));
      this.reinforcementQueue.splice(this.reinforcementQueue.indexOf(entry), 1);
      spawned++;
    }
    if (spawned)
      this.addLog(
        `Onda ${this.round}: ${spawned} reforço${spawned === 1 ? " entrou" : "s entraram"} na clareira.`,
        "danger",
      );
    if (due.length > spawned)
      this.addLog("Reforços aguardam uma entrada livre nas bordas.", "info");
    return spawned;
  }

  get allies() {
    return this.units.filter((u) => u.team === "ally");
  }
  get enemies() {
    return this.units.filter((u) => u.team === "enemy");
  }
  get selected() {
    return this.units.find((u) => u.id === this.selectedId) || null;
  }
  unitAt(x, y) {
    return this.units.find((u) => u.x === x && u.y === y) || null;
  }
  barrierAt(x, y) {
    return this.barrier?.x === x && this.barrier?.y === y ? this.barrier : null;
  }
  structureAt(x, y) {
    const barrier = this.barrierAt(x, y);
    if (barrier) {
      barrier.id ||= `barrier-${++this.structureSerial}`;
      barrier.name ||= "Barreira de Terra";
      barrier.type = "barrier";
      barrier.maxHp ||= 2;
      return barrier;
    }
    const type = this.terrain[y]?.[x],
      definition = STRUCTURES[type];
    if (!definition) return null;
    const id = key(x, y);
    if (this.structures.get(id)?.type !== type) {
      this.structures.set(id, {
        id: `${type}-${++this.structureSerial}`,
        x,
        y,
        type,
        ...definition,
        hp: definition.maxHp,
        underlay: this.levelLayers?.ground[y][x] || "grass",
      });
    }
    return this.structures.get(id);
  }
  movableStructureAt(x, y) {
    const structure = this.structureAt(x, y);
    return structure &&
      ["rock", "hot-rock", "crate", "barrier"].includes(structure.type)
      ? structure
      : null;
  }
  obstacle(x, y) {
    return (
      !inside(x, y) ||
      !!STRUCTURES[this.terrain[y][x]] ||
      ["deep-water", "abyss"].includes(
        this.terrain[y][x] === "bush"
          ? this.levelLayers?.ground[y][x]
          : this.terrain[y][x],
      ) ||
      !!this.barrierAt(x, y)
    );
  }
  blocksShot(x, y) {
    return !inside(x, y) || this.opaqueTerrain(x, y) || !!this.barrierAt(x, y);
  }
  opaqueTerrain(x, y) {
    return (
      !!STRUCTURES[this.terrain[y]?.[x]] ||
      this.levelLayers?.effects[y]?.[x] === "steam"
    );
  }
  movementCost(x, y) {
    if (this.terrain[y]?.[x] === "bridge") return 1;
    const ground =
      this.terrain[y]?.[x] === "bush"
        ? this.levelLayers?.ground[y][x]
        : this.terrain[y]?.[x];
    return ground === "mud" ? 2 : 1;
  }
  free(x, y) {
    return !this.obstacle(x, y) && !this.unitAt(x, y);
  }
  addLog(text, type = "info") {
    this.log.unshift({ text, type, round: this.round });
    this.log = this.log.slice(0, 30);
  }

  // 2. Seleção de unidades
  select(id) {
    const unit = this.units.find((u) => u.id === id && u.team === "ally");
    if (!["player", "deployment"].includes(this.phase) || !unit) return false;
    this.selectedId = id;
    this.mode = unit.moved && !unit.acted ? "punch" : "move";
    return true;
  }

  // 3. Cálculo de movimento (BFS, sem diagonais ou travessia de unidades)
  reachable(unit = this.selected, maxSteps = unit?.range || 0) {
    const cells = new Map();
    if (!unit) return cells;
    const queue = [{ x: unit.x, y: unit.y, steps: 0, path: [] }];
    const seen = new Map([[key(unit.x, unit.y), 0]]);
    while (queue.length) {
      queue.sort((a, b) => a.steps - b.steps);
      const current = queue.shift();
      if (current.steps >= maxSteps) continue;
      for (const [dx, dy] of DIRECTIONS) {
        const x = current.x + dx,
          y = current.y + dy,
          k = key(x, y);
        const cost = current.steps + this.movementCost(x, y);
        if (
          cost > maxSteps ||
          (seen.has(k) && seen.get(k) <= cost) ||
          !this.free(x, y)
        )
          continue;
        seen.set(k, cost);
        const next = {
          x,
          y,
          steps: cost,
          path: [...current.path, { x, y }],
        };
        cells.set(k, next);
        queue.push(next);
      }
    }
    return cells;
  }

  // 4. Movimentação
  move(x, y) {
    const unit = this.selected;
    if (this.phase !== "player" || !unit || unit.moved || unit.acted)
      return false;
    const destination = this.reachable(unit).get(key(x, y));
    if (!destination) return false;
    const from = { x: unit.x, y: unit.y };
    unit.moveUndo = {
      round: this.round,
      from,
      to: { x, y },
      path: destination.path.map((step) => ({ ...step })),
    };
    unit.x = x;
    unit.y = y;
    unit.moved = true;
    this.mode = "punch";
    this.lastEffect = {
      type: "move",
      from,
      to: { x, y },
      id: unit.id,
      path: destination.path,
    };
    this.addLog(
      `${unit.name} avançou ${destination.path.length} casa${destination.path.length === 1 ? "" : "s"}.${destination.steps > destination.path.length ? ` Custo: ${destination.steps} pontos de movimento.` : ""}`,
    );
    return true;
  }

  invalidateMoveUndo(unit) {
    if (unit) delete unit.moveUndo;
  }

  canUndoMove(unit = this.selected) {
    const previous = unit?.moveUndo;
    if (
      this.phase !== "player" ||
      !unit ||
      unit.team !== "ally" ||
      !this.units.includes(unit) ||
      !unit.moved ||
      unit.acted ||
      unit.hp <= 0 ||
      !previous ||
      previous.round !== this.round ||
      unit.x !== previous.to.x ||
      unit.y !== previous.to.y
    )
      return false;
    // Return along the original route, without undoing later changes to the board.
    return [previous.from, ...previous.path.slice(0, -1)].every((step) =>
      this.free(step.x, step.y),
    );
  }

  undoMove() {
    const unit = this.selected;
    if (!this.canUndoMove(unit)) return false;
    const previous = unit.moveUndo;
    this.lastEffect = {
      type: "move",
      from: { x: unit.x, y: unit.y },
      to: { ...previous.from },
      id: unit.id,
      path: [previous.from, ...previous.path]
        .reverse()
        .slice(1)
        .map((step) => ({ ...step })),
    };
    unit.x = previous.from.x;
    unit.y = previous.from.y;
    unit.moved = false;
    this.invalidateMoveUndo(unit);
    this.mode = "move";
    this.addLog(`${unit.name} desfez o movimento.`);
    return true;
  }

  // 5. Seleção de ataques
  setMode(mode) {
    if (this.phase !== "player" || !this.selected || this.selected.acted)
      return false;
    if (
      !["move", "punch", "special"].includes(mode) ||
      (mode === "move" && this.selected.moved)
    )
      return false;
    this.mode = mode;
    return true;
  }

  targets(mode = this.mode, unit = this.selected) {
    if (!unit || unit.acted || this.phase !== "player") return [];
    if (mode === "move")
      return unit.moved ? [] : [...this.reachable(unit).values()];
    if (mode === "punch")
      return DIRECTIONS.map(([dx, dy]) => ({
        x: unit.x + dx,
        y: unit.y + dy,
      })).filter((p) => inside(p.x, p.y) && this.terrain[p.y][p.x] !== "tree");
    if (mode !== "special") return [];
    if (unit.element === "fire") {
      const cells = [];
      for (const [dx, dy] of DIRECTIONS) {
        for (let i = 1; i <= 4; i++) {
          const x = unit.x + dx * i,
            y = unit.y + dy * i;
          if (!inside(x, y) || this.blocksShot(x, y)) break;
          const target = this.unitAt(x, y);
          if (target?.team === "ally") break;
          cells.push({ x, y });
          if (target) break;
        }
      }
      return cells;
    }
    if (unit.element === "water") return [{ x: unit.x, y: unit.y }];
    if (unit.element === "wind")
      return Array.from({ length: SIZE * SIZE }, (_, i) => ({
        x: i % SIZE,
        y: Math.floor(i / SIZE),
      }));
    if (unit.element === "lightning") {
      return DIRECTIONS.flatMap(([dx, dy]) => {
        const plan = this.dashPlan(unit.x + dx, unit.y + dy, unit);
        return plan
          ? [...plan.path.slice(1), { x: plan.target.x, y: plan.target.y }]
          : [];
      });
    }
    const adjacent = DIRECTIONS.map(([dx, dy]) => ({
      x: unit.x + dx,
      y: unit.y + dy,
    })).filter((p) => inside(p.x, p.y));
    return unit.element === "earth"
      ? adjacent.filter(
          (p) => this.terrain[p.y][p.x] === "grass" && this.free(p.x, p.y),
        )
      : adjacent;
  }

  waveArea(unit = this.selected) {
    if (!unit || unit.element !== "water") return [];
    return DIRECTIONS.map(([dx, dy]) => ({
      x: unit.x + dx,
      y: unit.y + dy,
    })).filter((p) => inside(p.x, p.y));
  }

  // Forecasts run the real rules on an isolated copy: hovering never spends an action.
  fork() {
    return Object.assign(
      Object.create(Battle.prototype),
      structuredClone(this),
    );
  }

  previewAction(x, y, mode = this.mode) {
    if (
      this.phase !== "player" ||
      !this.selected ||
      this.selected.acted ||
      !inside(x, y) ||
      !["punch", "special"].includes(mode)
    )
      return null;
    const simulation = this.fork();
    simulation.mode = mode;
    simulation.log = [];
    simulation.visualEvents = [];
    const beforeUnits = structuredClone(simulation.units);
    const structuresOf = (battle) => {
      const entries = new Map();
      for (let ty = 0; ty < SIZE; ty++)
        for (let tx = 0; tx < SIZE; tx++) {
          const structure = battle.structureAt(tx, ty);
          if (structure) entries.set(key(tx, ty), { ...structure });
        }
      return entries;
    };
    const beforeStructures = structuresOf(simulation);
    if (!simulation.act(x, y)) return null;
    const events = structuredClone(simulation.visualEvents);
    const afterUnits = structuredClone(simulation.units);
    const afterStructures = structuresOf(simulation);
    const pushes = events
      .filter((e) => e.type === "push")
      .map((e) => ({
        id: e.id,
        from: e.path[0],
        to: e.path.at(-1),
        team: beforeUnits.find((u) => u.id === e.id).team,
      }));
    const collisions = events.filter((e) => e.type === "collision");
    const beforeById = new Map(
      [...beforeStructures.values()].map((structure) => [
        structure.id,
        structure,
      ]),
    );
    const afterById = new Map(
      [...afterStructures.values()].map((structure) => [
        structure.id,
        structure,
      ]),
    );
    const structureMoves = events
      .filter((event) => event.type === "structure-push")
      .map((event) => {
        const before = beforeById.get(event.id),
          after = afterById.get(event.id);
        return {
          id: event.id,
          name: before.name,
          type: before.type,
          from: event.path[0],
          to: event.path.at(-1),
          hpBefore: before.hp,
          hpAfter: after.hp,
          maxHp: after.maxHp,
        };
      });
    const actor = beforeUnits.find((u) => u.id === this.selectedId);
    const isWave =
      mode === "special" && ["water", "wind"].includes(actor.element);
    const isDash = mode === "special" && actor.element === "lightning";
    const origin =
      isWave && actor.element === "wind"
        ? { x, y }
        : isDash
          ? simulation.lastEffect.impactFrom
          : actor;
    const impact = isDash ? simulation.lastEffect.to : { x, y };
    const attempts = [...beforeUnits, ...beforeStructures.values()].filter(
      (u) =>
        isWave
          ? (u.team ||
              ["rock", "hot-rock", "crate", "barrier"].includes(u.type)) &&
            distance(origin, u) === 1
          : (mode === "punch" || isDash) &&
            (u.team === "enemy" ||
              ["rock", "hot-rock", "crate", "barrier"].includes(u.type)) &&
            u.x === impact.x &&
            u.y === impact.y &&
            (u.team === "enemy" || u.hp > 1),
    );
    const blocked = attempts
      .filter((u) => ![...pushes, ...structureMoves].some((p) => p.id === u.id))
      .map((u) => {
        const destination = {
          x: u.x + Math.sign(u.x - origin.x),
          y: u.y + Math.sign(u.y - origin.y),
        };
        const structure = beforeStructures.get(
          key(destination.x, destination.y),
        );
        const occupant = beforeUnits.find(
          (other) => other.x === destination.x && other.y === destination.y,
        );
        return {
          id: u.id,
          from: { x: u.x, y: u.y },
          to: destination,
          reason: !inside(destination.x, destination.y)
            ? "edge"
            : structure
              ? "structure"
              : occupant
                ? "unit"
                : "terrain",
          obstacle:
            structure?.name ||
            (structure ? "Barreira de Terra" : occupant?.name),
        };
      });
    const units = beforeUnits.flatMap((before) => {
      const after = afterUnits.find((u) => u.id === before.id);
      const moved = after && distance(before, after) > 0;
      if (
        after?.hp === before.hp &&
        !moved &&
        !attempts.some((u) => u.id === before.id)
      )
        return [];
      return [
        {
          id: before.id,
          name: before.name,
          team: before.team,
          element: before.element,
          kind: before.kind,
          from: { x: before.x, y: before.y },
          to: after ? { x: after.x, y: after.y } : null,
          hpBefore: before.hp,
          hpAfter: after?.hp || 0,
          maxHp: before.maxHp,
          damage: before.hp - (after?.hp || 0),
          defeated: !after,
          moved: !!moved,
          ...(before.team === "enemy"
            ? {
                intent: after?.intent ? { ...after.intent } : null,
                attackCells: after
                  ? simulation.enemyThreatenedCells(after)
                  : [],
              }
            : {}),
        },
      ];
    });
    const structureChanges = [
      ...new Set([...beforeById.keys(), ...afterById.keys()]),
    ].flatMap((id) => {
      const before = beforeById.get(id),
        after = afterById.get(id);
      const moved = !!before && !!after && distance(before, after) > 0;
      if (
        before &&
        after &&
        before.hp === after.hp &&
        before.type === after.type &&
        !moved &&
        !attempts.some((attempt) => attempt.id === id)
      )
        return [];
      const entry = after || before;
      return [
        {
          id,
          x: entry.x,
          y: entry.y,
          name: entry.name || "Barreira de Terra",
          type: entry.type,
          hpBefore: before?.hp || 0,
          hpAfter: after?.hp || 0,
          created: !before,
          destroyed: !after,
          from: before ? { x: before.x, y: before.y } : null,
          to: after ? { x: after.x, y: after.y } : null,
          moved,
        },
      ];
    });
    const immediateOutcome = simulation.phase;
    const effect = structuredClone(simulation.lastEffect);
    const displacedEnemies = pushes.filter(
      (p) => p.team === "enemy" && afterUnits.some((u) => u.id === p.id),
    );
    let nextEnemies = [],
      forecastPhase = null,
      forecastResultReason = null,
      incomingCount = 0;
    if (displacedEnemies.length && simulation.phase === "player") {
      const interrupted = new Map(
        displacedEnemies.map((push) => {
          const immediate = afterUnits.find((u) => u.id === push.id);
          return [
            push.id,
            !!immediate.intent &&
              !simulation.enemyThreatenedCells(immediate).length,
          ];
        }),
      );
      simulation.visualEvents = [];
      simulation.beginEnemyTurn();
      simulation.resolveEnemyTurn();
      forecastPhase = simulation.phase;
      forecastResultReason = simulation.resultReason;
      incomingCount = simulation.enemySerial - this.enemySerial;
      nextEnemies = displacedEnemies.map((push) => {
        const immediate = afterUnits.find((u) => u.id === push.id);
        const next = simulation.units.find((u) => u.id === push.id);
        const movement = simulation.visualEvents.find(
          (e) => e.type === "enemy-move" && e.id === push.id,
        );
        return {
          id: push.id,
          name: immediate.name,
          from: push.to,
          to: next ? { x: next.x, y: next.y } : null,
          path: movement?.path || [push.to],
          status: !next
            ? "defeated"
            : simulation.phase !== "player"
              ? "battle-ended"
              : movement
                ? "moves"
                : "stays",
          attackInterrupted: interrupted.get(push.id),
        };
      });
    }
    return {
      mode,
      at: { x, y },
      actor: { id: actor.id, name: actor.name, element: actor.element },
      units,
      structures: structureChanges,
      structureMoves,
      pushes,
      collisions,
      blocked,
      nextEnemies,
      outcome: immediateOutcome,
      forecastPhase,
      forecastResultReason,
      incomingCount,
      effect,
    };
  }

  finishAction(unit) {
    this.invalidateMoveUndo(unit);
    unit.acted = true;
    unit.moved = true;
    this.mode = "move";
    this.checkResult();
  }

  // 6. Soco
  punch(x, y) {
    const unit = this.selected,
      target = this.unitAt(x, y) || this.structureAt(x, y);
    if (
      this.phase !== "player" ||
      !unit ||
      unit.acted ||
      !target ||
      target.type === "tree" ||
      distance(unit, { x, y }) !== 1 ||
      target.team === "ally"
    )
      return false;
    this.lastEffect = {
      type: "punch",
      from: { x: unit.x, y: unit.y },
      to: { x, y },
    };
    this.damage(target, 1);
    const pushed = this.knockback(target, unit);
    this.addLog(
      `${unit.name} usou Soco. −1 PV.${pushed ? " Alvo empurrado 1 casa." : ""}`,
      "attack",
    );
    this.finishAction(unit);
    return true;
  }

  // Characters resolve knockback even when the initial hit was lethal.
  knockback(target, origin) {
    if (
      !target.team &&
      !(
        target.hp > 0 &&
        ["rock", "hot-rock", "crate", "barrier"].includes(target.type)
      )
    )
      return false;
    const destination = {
      x: target.x + Math.sign(target.x - origin.x),
      y: target.y + Math.sign(target.y - origin.y),
    };
    if (this.free(destination.x, destination.y)) {
      if (target.team) this.pushUnit(target, destination);
      else this.moveStructure(target, destination);
      return true;
    }
    const obstacle =
      this.structureAt(destination.x, destination.y) ||
      this.unitAt(destination.x, destination.y);
    if (obstacle) this.collide(target, obstacle);
    return false;
  }

  dashPlan(x, y, unit = this.selected) {
    if (
      !unit ||
      !inside(x, y) ||
      (unit.x !== x && unit.y !== y) ||
      (unit.x === x && unit.y === y)
    )
      return null;
    const dx = Math.sign(x - unit.x),
      dy = Math.sign(y - unit.y);
    const path = [{ x: unit.x, y: unit.y }];
    for (let i = 1; i < SIZE; i++) {
      const tx = unit.x + dx * i,
        ty = unit.y + dy * i;
      if (!inside(tx, ty)) return null;
      const target = this.unitAt(tx, ty) || this.structureAt(tx, ty);
      if (target?.team === "ally") return null;
      if (target) {
        // A click past the first obstacle does not target through it.
        if (Math.abs(x - unit.x) + Math.abs(y - unit.y) > i) return null;
        return { target, path, destination: path.at(-1) };
      }
      if (this.obstacle(tx, ty)) return null;
      path.push({ x: tx, y: ty });
    }
    return null;
  }

  lightning(x, y) {
    const unit = this.selected;
    if (
      this.phase !== "player" ||
      !unit ||
      unit.element !== "lightning" ||
      unit.acted
    )
      return false;
    const plan = this.dashPlan(x, y, unit);
    if (!plan) return false;
    const from = { x: unit.x, y: unit.y },
      targetPosition = { x: plan.target.x, y: plan.target.y };
    Object.assign(unit, plan.destination);
    this.invalidateMoveUndo(unit);
    this.visualEvents.push({ type: "dash", id: unit.id, path: plan.path });
    this.visualEvents.push({
      type: "impact",
      id: unit.id,
      from: { ...plan.destination },
      to: targetPosition,
      obstacleType: plan.target.team ? "unit" : "structure",
      obstacleId: plan.target.id,
    });
    this.damage(plan.target, 1);
    this.knockback(plan.target, unit);
    this.damage(unit, 1);
    this.lastEffect = {
      type: "lightning",
      from,
      to: targetPosition,
      impactFrom: { ...plan.destination },
      path: plan.path,
    };
    this.addLog(
      `${unit.name} usou Dash Relâmpago. −1 PV no alvo e empurrão; −1 PV em ${unit.name}.`,
      "attack",
    );
    this.finishAction(unit);
    return true;
  }

  // 7. Especial de Fogo
  fire(x, y) {
    const unit = this.selected;
    if (
      this.phase !== "player" ||
      !unit ||
      unit.element !== "fire" ||
      unit.acted ||
      !this.targets("special", unit).some((p) => p.x === x && p.y === y)
    )
      return false;
    const dx = Math.sign(x - unit.x),
      dy = Math.sign(y - unit.y);
    let end = { x: unit.x, y: unit.y },
      hit = null;
    for (let i = 1; i <= 4; i++) {
      const tx = unit.x + dx * i,
        ty = unit.y + dy * i;
      if (!inside(tx, ty) || this.blocksShot(tx, ty)) break;
      end = { x: tx, y: ty };
      const other = this.unitAt(tx, ty);
      if (other) {
        if (other.team === "enemy") hit = other;
        break;
      }
    }
    if (hit) this.damage(hit, 1);
    this.lastEffect = { type: "fire", from: { x: unit.x, y: unit.y }, to: end };
    this.addLog(
      `${unit.name} lançou Projétil de Fogo.${hit ? " −1 PV." : " Nenhum alvo atingido."}`,
      "attack",
    );
    this.finishAction(unit);
    return true;
  }

  // Empurrões e colisões compartilhados por Soco e Onda.
  pushUnit(unit, destination) {
    const offset = { x: destination.x - unit.x, y: destination.y - unit.y };
    this.invalidateMoveUndo(unit);
    this.visualEvents.push({
      type: "push",
      id: unit.id,
      path: [
        { x: unit.x, y: unit.y },
        { x: destination.x, y: destination.y },
      ],
      ...(unit.hp === 0
        ? { defeatedUnit: { ...unit, x: destination.x, y: destination.y } }
        : {}),
    });
    unit.x = destination.x;
    unit.y = destination.y;
    // An armed attack travels with its owner; a shove never rotates or retargets it.
    if (unit.team === "enemy" && unit.intent)
      unit.intent = {
        x: unit.intent.x + offset.x,
        y: unit.intent.y + offset.y,
      };
  }

  moveStructure(structure, destination) {
    if (
      !structure ||
      !["rock", "hot-rock", "crate", "barrier"].includes(structure.type) ||
      structure.hp <= 0 ||
      !this.free(destination.x, destination.y)
    )
      return false;
    const from = { x: structure.x, y: structure.y };
    if (["rock", "hot-rock", "crate"].includes(structure.type)) {
      this.structures.delete(key(from.x, from.y));
      this.terrain[from.y][from.x] = structure.underlay || "grass";
      structure.underlay = this.terrain[destination.y][destination.x];
      this.terrain[destination.y][destination.x] = structure.type;
      this.structures.set(key(destination.x, destination.y), structure);
      this.terrainRevision++;
    }
    structure.x = destination.x;
    structure.y = destination.y;
    this.visualEvents.push({
      type: "structure-push",
      id: structure.id,
      structure: { ...structure },
      path: [from, { x: destination.x, y: destination.y }],
    });
    return true;
  }

  collide(unit, obstacle) {
    this.visualEvents.push({
      type: "collision",
      id: unit.id,
      from: { x: unit.x, y: unit.y },
      to: { x: obstacle.x, y: obstacle.y },
      obstacleType: obstacle.team ? "unit" : "structure",
      obstacleId: obstacle.id || null,
    });
    this.damage(unit, 1);
    this.damage(obstacle, 1);
    this.addLog(
      `${unit.name} colidiu com ${obstacle.name || "Barreira de Terra"}. −1 PV em cada.`,
      "attack",
    );
  }

  // 8. Especial de Água (destinos avaliados simultaneamente)
  wave() {
    const unit = this.selected;
    if (
      this.phase !== "player" ||
      !unit ||
      unit.element !== "water" ||
      unit.acted
    )
      return false;
    return this.radialPush(unit, { x: unit.x, y: unit.y }, "water");
  }

  wind(x, y) {
    const unit = this.selected;
    if (
      this.phase !== "player" ||
      !unit ||
      unit.element !== "wind" ||
      unit.acted ||
      !inside(x, y)
    )
      return false;
    return this.radialPush(unit, { x, y }, "wind");
  }

  radialPush(unit, center, element) {
    const from = { x: unit.x, y: unit.y };
    const nearbyStructures = DIRECTIONS.map(([dx, dy]) =>
      this.movableStructureAt(center.x + dx, center.y + dy),
    ).filter(Boolean);
    const attempts = [...this.units, ...nearbyStructures]
      .filter((other) => distance(center, other) === 1)
      .map((other) => ({
        unit: other,
        x: other.x + Math.sign(other.x - center.x),
        y: other.y + Math.sign(other.y - center.y),
      }));
    // Snapshot every destination before applying movement, damage or destruction.
    const pushes = attempts.filter((p) => this.free(p.x, p.y));
    const collisions = attempts
      .map((p) => ({
        ...p,
        obstacle: this.structureAt(p.x, p.y) || this.unitAt(p.x, p.y),
      }))
      .filter((p) => p.obstacle);
    pushes.forEach((p) =>
      p.unit.team ? this.pushUnit(p.unit, p) : this.moveStructure(p.unit, p),
    );
    for (const impact of collisions) this.collide(impact.unit, impact.obstacle);
    this.lastEffect = {
      type: element,
      from,
      to: { ...center },
      collisions: collisions.map((p) => ({
        from: { x: p.unit.x, y: p.unit.y },
        to: { x: p.x, y: p.y },
      })),
    };
    this.addLog(
      `${unit.name} usou ${ELEMENTS[element].special}. ${pushes.length} unidade${pushes.length === 1 ? "" : "s"} empurrada${pushes.length === 1 ? "" : "s"}.`,
      "water",
    );
    this.finishAction(unit);
    return true;
  }

  // 9. Especial de Terra
  earth(x, y) {
    const unit = this.selected;
    if (
      this.phase !== "player" ||
      !unit ||
      unit.element !== "earth" ||
      unit.acted ||
      !this.targets("special", unit).some((p) => p.x === x && p.y === y)
    )
      return false;
    this.barrier = {
      id: `barrier-${++this.structureSerial}`,
      name: "Barreira de Terra",
      x,
      y,
      hp: 2,
      maxHp: 2,
      type: "barrier",
    };
    this.lastEffect = {
      type: "earth",
      from: { x: unit.x, y: unit.y },
      to: { x, y },
    };
    this.addLog(`${unit.name} ergueu uma Barreira de Terra. 2 PV.`, "earth");
    this.finishAction(unit);
    return true;
  }

  act(x, y) {
    if (this.mode === "move") return this.move(x, y);
    if (this.mode === "punch") return this.punch(x, y);
    if (this.mode === "special")
      return this.selected?.element === "fire"
        ? this.fire(x, y)
        : this.selected?.element === "water"
          ? x === this.selected.x && y === this.selected.y && this.wave()
          : this.selected?.element === "lightning"
            ? this.lightning(x, y)
            : this.selected?.element === "wind"
              ? this.wind(x, y)
              : this.earth(x, y);
    return false;
  }

  wait() {
    const unit = this.selected;
    if (this.phase !== "player" || !unit || unit.acted) return false;
    this.addLog(`${unit.name} aguardou em posição.`);
    this.finishAction(unit);
    return true;
  }

  enemyAttackInRange(enemy, target = enemy.intent) {
    if (!target) return false;
    const steps = distance(enemy, target);
    return (
      steps > 0 &&
      (enemy.x === target.x || enemy.y === target.y) &&
      (enemy.kind === "lobber" ||
        steps <= (enemy.kind === "ranged" ? enemy.attackRange || 4 : 1))
    );
  }

  enemyAttackPath(enemy, target = enemy.intent) {
    if (!this.enemyAttackInRange(enemy, target)) return [];
    const dx = Math.sign(target.x - enemy.x),
      dy = Math.sign(target.y - enemy.y);
    const cells = [];
    for (let i = 1; i <= distance(enemy, target); i++) {
      const point = { x: enemy.x + dx * i, y: enemy.y + dy * i };
      if (!inside(point.x, point.y)) break;
      cells.push(point);
    }
    return cells;
  }

  enemyThreatenedCells(enemy) {
    // The flight path is safe: an overhead shot damages only its exact endpoint.
    // Never clamp an off-board endpoint to the last cell of its flight path.
    if (enemy.kind === "lobber")
      return this.enemyAttackValid(enemy) ? [{ ...enemy.intent }] : [];
    const cells = [];
    for (const point of this.enemyAttackPath(enemy)) {
      if (
        STRUCTURES[this.terrain[point.y][point.x]] ||
        (enemy.kind === "ranged" &&
          this.levelLayers?.effects[point.y][point.x] === "steam")
      )
        break;
      cells.push(point);
      if (this.unitAt(point.x, point.y) || this.barrierAt(point.x, point.y))
        break;
    }
    return cells;
  }

  enemyAttackValid(enemy, target = enemy.intent) {
    if (!this.enemyAttackInRange(enemy, target)) return false;
    if (enemy.kind === "lobber") return inside(target.x, target.y);
    if (enemy.kind !== "ranged")
      return this.enemyAttackPath(enemy, target).length > 0;
    const path = this.enemyAttackPath(enemy, target);
    if (!path.length) return false;
    for (let i = 0; i < path.length; i++) {
      const { x, y } = path[i];
      if (this.opaqueTerrain(x, y)) return false;
      const blocker = this.unitAt(x, y);
      if (
        i < path.length - 1 &&
        (this.barrierAt(x, y) || (blocker && blocker.id !== enemy.id))
      )
        return false;
    }
    return true;
  }

  // 10. Aproximação e preparação de um ataque direcional a cada turno.
  prepareEnemies(advance = true) {
    for (const enemy of this.enemies) {
      if (!this.allies.length) break;
      enemy.advanceSteps = 0;
      const canHit = (position, ally) =>
        enemy.kind === "ranged" || enemy.kind === "lobber"
          ? this.enemyAttackValid({ ...enemy, ...position }, ally)
          : distance(position, ally) === 1;
      const adjacent = this.allies.find((a) => canHit(enemy, a));
      if (advance && !adjacent) {
        const reachable = [
          { x: enemy.x, y: enemy.y, steps: 0, path: [] },
          ...this.reachable(enemy, SIZE * SIZE * 2).values(),
        ];
        const options = reachable.flatMap((p) =>
          this.allies
            .filter((a) => canHit(p, a))
            .map((a) => ({ ...p, target: a })),
        );
        options.sort(
          (a, b) =>
            a.steps - b.steps ||
            distance(enemy, a.target) - distance(enemy, b.target) ||
            a.target.id.localeCompare(b.target.id),
        );
        if (options.length) {
          const path = options[0].path;
          if (path.length) {
            const steps = [];
            let spent = 0;
            for (const point of path) {
              spent += this.movementCost(point.x, point.y);
              if (spent > enemy.range) break;
              steps.push(point);
            }
            if (steps.length) {
              enemy.advanceSteps = steps.length;
              this.visualEvents.push({
                type: "enemy-move",
                id: enemy.id,
                path: [{ x: enemy.x, y: enemy.y }, ...steps],
              });
              const next = steps.at(-1);
              enemy.x = next.x;
              enemy.y = next.y;
            }
          }
        }
      }
      const target = [...this.allies].sort(
        (a, b) =>
          distance(enemy, a) - distance(enemy, b) || a.id.localeCompare(b.id),
      )[0];
      if (!target) continue;
      if (enemy.kind === "ranged" || enemy.kind === "lobber") {
        const visible = [...this.allies]
          .filter((ally) => this.enemyAttackValid(enemy, ally))
          .sort(
            (a, b) =>
              distance(enemy, a) - distance(enemy, b) ||
              a.id.localeCompare(b.id),
          )[0];
        if (visible) enemy.intent = { x: visible.x, y: visible.y };
        else if (enemy.kind === "lobber") {
          // If this advance cannot align an ally yet, announce a real tile on
          // the closest cardinal projection. It remains fixed until the shot.
          enemy.intent = [
            { x: target.x, y: enemy.y },
            { x: enemy.x, y: target.y },
          ]
            .filter((p) => this.enemyAttackValid(enemy, p))
            .sort((a, b) => distance(a, target) - distance(b, target))[0];
        } else {
          const [dx, dy] = [...DIRECTIONS].sort(
            (a, b) =>
              distance({ x: enemy.x + a[0], y: enemy.y + a[1] }, target) -
              distance({ x: enemy.x + b[0], y: enemy.y + b[1] }, target),
          )[0];
          enemy.intent = {
            x: enemy.x + dx * (enemy.attackRange || 4),
            y: enemy.y + dy * (enemy.attackRange || 4),
          };
        }
      } else {
        const direction = DIRECTIONS.map(([dx, dy]) => ({
          x: enemy.x + dx,
          y: enemy.y + dy,
        }))
          .filter(
            (p) => inside(p.x, p.y) && !STRUCTURES[this.terrain[p.y][p.x]],
          )
          .sort((a, b) => distance(a, target) - distance(b, target))[0];
        enemy.intent = direction
          ? { x: direction.x, y: direction.y }
          : { x: enemy.x, y: enemy.y - 1 };
      }
      this.visualEvents.push({
        type: "enemy-ready",
        id: enemy.id,
        at: { x: enemy.x, y: enemy.y },
        intent: { ...enemy.intent },
        kind: enemy.kind,
        steps: enemy.advanceSteps,
      });
    }
  }

  // 11. Resolução do turno. Intenções são resolvidas como um único lote.
  beginEnemyTurn() {
    if (this.phase !== "player") return false;
    this.units.forEach((unit) => this.invalidateMoveUndo(unit));
    this.phase = "enemy";
    this.mode = "move";
    return true;
  }
  resolveEnemyTurn() {
    if (this.phase !== "enemy") return false;
    const strikes = this.enemies
      .filter((e) => e.intent)
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        attackRange: e.attackRange,
        from: { x: e.x, y: e.y },
        to: { ...e.intent },
      }));
    for (const strike of strikes) {
      if (!this.enemies.some((enemy) => enemy.id === strike.id)) {
        strike.cancelled = true;
        continue;
      }
      if (
        !this.enemyAttackInRange(
          {
            ...strike.from,
            kind: strike.kind,
            attackRange: strike.attackRange,
          },
          strike.to,
        )
      ) {
        strike.cancelled = true;
        this.addLog(
          `${strike.name} não tem uma direção de ataque válida.`,
          "evade",
        );
        continue;
      }
      if (strike.kind === "lobber") {
        if (!inside(strike.to.x, strike.to.y)) {
          this.addLog(
            `${strike.name} disparou por cima para fora do tabuleiro.`, "evade",
          );
          continue;
        }
        strike.hit = { ...strike.to };
        const target =
          this.unitAt(strike.to.x, strike.to.y) ||
          this.structureAt(strike.to.x, strike.to.y);
        if (target) {
          this.damage(target, 1);
          this.addLog(`${strike.name} disparou por cima em ${target.name}. −1 PV.`, "danger");
        } else this.addLog(`${strike.name} disparou por cima em uma casa vazia.`, "evade");
        continue;
      }
      if (strike.kind === "ranged") {
        let hit = false;
        for (const { x, y } of this.enemyAttackPath(
          {
            ...strike.from,
            kind: strike.kind,
            attackRange: strike.attackRange,
          },
          strike.to,
        )) {
          strike.hit = { x, y };
          if (this.opaqueTerrain(x, y)) break;
          const target = this.unitAt(x, y) || this.barrierAt(x, y);
          if (target) {
            this.damage(target, 1);
            this.addLog(
              `${strike.name} disparou em ${target.name || "a barreira"}. −1 PV.`,
              "danger",
            );
            hit = true;
            break;
          }
        }
        if (!hit)
          this.addLog(
            `${strike.name} disparou sem atingir uma unidade.`,
            "evade",
          );
        continue;
      }
      if (!inside(strike.to.x, strike.to.y)) {
        this.addLog(`${strike.name} atacou para fora do tabuleiro.`, "evade");
        continue;
      }
      const target =
        this.unitAt(strike.to.x, strike.to.y) ||
        this.barrierAt(strike.to.x, strike.to.y);
      if (target) {
        this.damage(target, 1);
        this.addLog(
          `${strike.name} atingiu ${target.name || "a barreira"}. −1 PV.`,
          "danger",
        );
      } else this.addLog(`${strike.name} atacou uma casa vazia.`, "evade");
    }
    this.lastEffect = { type: "enemy", strikes };
    if (this.checkResult()) return true;
    if (this.maxRounds && this.round >= this.maxRounds) {
      this.phase = "defeat";
      this.resultReason = "timeout";
      this.addLog(
        `Tempo esgotado: a clareira não foi limpa em ${this.maxRounds} turnos.`,
        "danger",
      );
      return true;
    }
    this.round++;
    this.allies.forEach((u) => {
      u.moved = false;
      u.acted = false;
    });
    this.spawnReinforcements();
    this.prepareEnemies();
    this.phase = "player";
    if (!this.selected) this.selectedId = this.allies[0]?.id || null;
    this.addLog(`Turno ${this.round}. Novas intenções reveladas.`);
    return true;
  }

  // 12. Vida e dano
  damage(target, amount) {
    const dealt = Math.min(target.hp, Math.max(0, amount));
    if (!dealt) return;
    target.hp = Math.max(0, target.hp - amount);
    this.visualEvents.push({
      type: "damage",
      id: target.id || `structure-${key(target.x, target.y)}`,
      at: { x: target.x, y: target.y },
      amount: dealt,
      defeated: target.hp === 0,
      unit: target.team ? { ...target } : null,
    });
    if (target.hp > 0) {
      // A wounded tree has a different silhouette in the cached terrain art.
      if (target.type === "tree") this.terrainRevision++;
      return;
    }
    if (target === this.barrier) {
      this.barrier = null;
      this.addLog("Barreira de Terra foi destruída.", "earth");
      return;
    }
    if (this.structures.get(key(target.x, target.y)) === target) {
      this.structures.delete(key(target.x, target.y));
      this.terrain[target.y][target.x] = target.underlay || "grass";
      this.terrainRevision++;
      this.addLog(`${target.name} foi destruída. A casa está livre.`, "earth");
      return;
    }
    this.units = this.units.filter((u) => u !== target);
    if (target.team === "enemy") this.kills++;
    this.addLog(
      `${target.name} foi derrotado.`,
      target.team === "enemy" ? "success" : "danger",
    );
    if (target.id === this.selectedId)
      this.selectedId = this.allies[0]?.id || null;
  }

  // 13. Vitória e derrota
  checkResult() {
    if (!this.allies.length) {
      this.phase = "defeat";
      this.resultReason = "eliminated";
    } else if (!this.enemies.length && !this.pendingReinforcements) {
      this.phase = "victory";
      this.resultReason = "cleared";
    } else return false;
    return true;
  }
}
