// Seeded terrain generation is independent of the combat model and browser.
const SIZE = 8;
const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const BLOCKED = new Set(["tree", "rock", "wall"]);
const cellKey = ({ x, y }) => `${x},${y}`;
const inside = ({ x, y }) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const neighbors = ({ x, y }) =>
  STEPS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter(inside);
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const allCells = () =>
  Array.from({ length: SIZE * SIZE }, (_, i) => ({
    x: i % SIZE,
    y: Math.floor(i / SIZE),
  }));

export function normalizeSeed(seed) {
  if (
    seed === null ||
    seed === undefined ||
    (typeof seed === "number" && !Number.isFinite(seed))
  )
    return "triade";
  return (
    String(seed)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32)
      .replace(/-+$/g, "") || "triade"
  );
}

export function randomSeed() {
  const value = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(value);
  else {
    value[0] = Date.now() >>> 0;
    value[1] = Math.floor(Math.random() * 0x100000000);
  }
  return `map-${Array.from(value, (part) => part.toString(36)).join("-")}`;
}

function randomSource(seed) {
  let state = 2166136261;
  for (const character of seed)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (items, random) => items[Math.floor(random() * items.length)];
function shuffled(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function river(random) {
  const horizontal = random() < 0.5;
  const water = new Map();
  const add = (major, minor) => {
    const point = horizontal ? { x: major, y: minor } : { x: minor, y: major };
    water.set(cellKey(point), point);
  };
  let previous = 2 + Math.floor(random() * 4);
  for (let major = 0; major < SIZE; major++) {
    const change =
      major === 2 || major === 5
        ? pick([-1, 1], random)
        : pick([-1, 0, 0, 1], random);
    const current = Math.max(1, Math.min(6, previous + (major ? change : 0)));
    for (
      let minor = Math.min(previous, current);
      minor <= Math.max(previous, current);
      minor++
    )
      add(major, minor);
    if (major > 0 && major < SIZE - 1 && random() < 0.28)
      add(major, Math.max(1, Math.min(6, current + pick([-1, 1], random))));
    previous = current;
  }
  // The two forced bends above can meet a bank. A side pool guarantees an
  // organic silhouette even for the rare path that otherwise remains straight.
  if (
    new Set([...water.values()].map((p) => (horizontal ? p.y : p.x))).size < 2
  ) {
    add(3, previous === 6 ? previous - 1 : previous + 1);
  }
  return [...water.values()];
}

function lake(random) {
  const x = 2 + Math.floor(random() * 3),
    y = 2 + Math.floor(random() * 3);
  const water = new Map();
  for (const point of [
    { x, y },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x + 1, y: y + 1 },
  ])
    water.set(cellKey(point), point);
  const target = 8 + Math.floor(random() * 6);
  while (water.size < target) {
    const candidates = new Map();
    for (const point of water.values())
      for (const other of neighbors(point)) {
        if (
          other.x === 0 ||
          other.y === 0 ||
          other.x === 7 ||
          other.y === 7 ||
          water.has(cellKey(other))
        )
          continue;
        candidates.set(cellKey(other), other);
      }
    const center = { x: x + 0.5, y: y + 0.5 };
    const ordered = [...candidates.values()]
      .map((p) => ({ ...p, score: distance(p, center) + random() * 2 }))
      .sort((a, b) => a.score - b.score);
    const point = pick(ordered.slice(0, 4), random);
    water.set(cellKey(point), { x: point.x, y: point.y });
  }
  return [...water.values()];
}

function coast(random) {
  const side = Math.floor(random() * 4);
  let thickness = 2;
  const bands = [];
  for (let major = 0; major < SIZE; major++) {
    thickness = Math.max(1, Math.min(3, thickness + pick([-1, 0, 1], random)));
    bands.push(thickness);
  }
  bands[3] = Math.max(2, bands[3]);
  if (new Set(bands).size === 1) bands[3] = bands[3] === 1 ? 2 : bands[3] - 1;
  // A narrow 8×8 coast leaves enough dry ground for six distinct spawns.
  while (bands.reduce((sum, width) => sum + width, 0) > 20) {
    const index = bands.findIndex((width) => width > 1);
    bands[index]--;
  }
  const water = [];
  for (let major = 0; major < SIZE; major++)
    for (let minor = 0; minor < bands[major]; minor++) {
      water.push(
        side === 0
          ? { x: minor, y: major }
          : side === 1
            ? { x: 7 - minor, y: major }
            : side === 2
              ? { x: major, y: minor }
              : { x: major, y: 7 - minor },
      );
    }
  return water;
}

function reachable(terrain, start) {
  const seen = new Set([cellKey(start)]),
    queue = [start];
  for (const current of queue)
    for (const point of neighbors(current)) {
      if (seen.has(cellKey(point)) || BLOCKED.has(terrain[point.y][point.x]))
        continue;
      seen.add(cellKey(point));
      queue.push(point);
    }
  return seen;
}

function connected(terrain) {
  const open = allCells().filter((p) => !BLOCKED.has(terrain[p.y][p.x]));
  return open.length > 0 && reachable(terrain, open[0]).size === open.length;
}

function place(terrain, points, type) {
  if (points.some((p) => !inside(p) || terrain[p.y][p.x] !== "grass"))
    return false;
  points.forEach((p) => {
    terrain[p.y][p.x] = type;
  });
  if (connected(terrain)) return true;
  points.forEach((p) => {
    terrain[p.y][p.x] = "grass";
  });
  return false;
}

function ruins(terrain, random) {
  // Open L-shaped remnants, rather than a closed city enclosure. Damage and
  // missing upper masonry are rendered separately from this solid footprint.
  const count = 3 + Math.floor(random() * 4);
  for (let attempt = 0; attempt < 160; attempt++) {
    const anchor = {
      x: Math.floor(random() * SIZE),
      y: Math.floor(random() * SIZE),
    };
    const [dx, dy] = pick(STEPS, random),
      turn = random() < 0.5 ? -1 : 1;
    const firstLength = 2 + Math.floor(random() * Math.min(3, count - 1));
    const points = Array.from({ length: firstLength }, (_, i) => ({
      x: anchor.x + i * dx,
      y: anchor.y + i * dy,
    }));
    const end = points.at(-1);
    for (let i = 1; i <= count - firstLength; i++)
      points.push({ x: end.x - dy * turn * i, y: end.y + dx * turn * i });
    if (place(terrain, points, "wall")) return true;
  }
  return false;
}

function scatter(terrain, type, count, random) {
  let placed = 0;
  for (const point of shuffled(allCells(), random)) {
    if (place(terrain, [point], type) && ++placed === count) return true;
  }
  return false;
}

function walkingDistances(terrain, starts) {
  const result = new Map(starts.map((p) => [cellKey(p), 0])),
    queue = starts.slice();
  for (const point of queue)
    for (const next of neighbors(point)) {
      if (BLOCKED.has(terrain[next.y][next.x]) || result.has(cellKey(next)))
        continue;
      result.set(cellKey(next), result.get(cellKey(point)) + 1);
      queue.push(next);
    }
  return result;
}

function spawnPositions(terrain, random) {
  const grass = allCells().filter((p) => terrain[p.y][p.x] === "grass");
  const lowerLeft = grass.filter((p) => p.x <= 3 && p.y >= 4);
  if (lowerLeft.length < 4) return null;
  const fire = pick(
    lowerLeft.filter((p) => p.x >= 1 && p.y <= 6).length
      ? lowerLeft.filter((p) => p.x >= 1 && p.y <= 6)
      : lowerLeft,
    random,
  );
  const near = shuffled(
    grass.filter(
      (p) => p !== fire && p.x <= 4 && p.y >= 3 && distance(p, fire) <= 3,
    ),
    random,
  );
  if (near.length < 2) return null;
  const heroes = [fire, near[0], near[1]],
    used = new Set(heroes.map(cellKey));
  const distances = walkingDistances(terrain, heroes),
    enemies = [];
  for (let i = 0; i < 3; i++) {
    const candidates = grass.filter(
      (p) =>
        !used.has(cellKey(p)) &&
        distances.get(cellKey(p)) >= 3 &&
        distances.get(cellKey(p)) <= 5 &&
        enemies.every((enemy) => distance(enemy, p) >= 2),
    );
    if (!candidates.length) return null;
    const ordered = candidates
      .map((p) => ({ ...p, score: p.x * 0.55 - p.y * 0.15 + random() * 3 }))
      .sort((a, b) => b.score - a.score);
    const chosen = pick(ordered.slice(0, 6), random),
      enemy = { x: chosen.x, y: chosen.y };
    used.add(cellKey(enemy));
    enemies.push(enemy);
  }
  const openEdges = grass.filter(
    (p) =>
      (p.x === 0 || p.y === 0 || p.x === 7 || p.y === 7) &&
      !used.has(cellKey(p)),
  );
  if (openEdges.length < 6) return null;
  return Object.fromEntries(
    ["fire", "water", "earth", "enemy-1", "enemy-2", "enemy-3"].map((id, i) => [
      id,
      { ...[...heroes, ...enemies][i] },
    ]),
  );
}

function fallbackMap(seed, random) {
  // Construct a narrow river beside an open field if rejection ever exhausts
  // its budget. This path has no retries and still varies its banks, vegetation
  // and formation from the supplied seed, without relying on a saved board.
  const terrain = Array.from({ length: SIZE }, () => Array(SIZE).fill("grass"));
  for (let y = 0; y < SIZE; y++) terrain[y][4] = "water";
  const bendStart = 1 + Math.floor(random() * 2);
  for (let y = bendStart; y <= 4; y++) terrain[y][5] = "water";
  for (let y = 5; y <= 6; y++) if (random() < 0.7) terrain[y][3] = "water";
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [random() < 0.5 ? 0 : 1, 1],
  ])
    terrain[y][x] = "wall";
  for (const { x, y } of shuffled(
    [
      { x: 2, y: 0 },
      { x: 6, y: 0 },
      { x: 7, y: 0 },
      { x: 7, y: 7 },
      { x: 0, y: 3 },
    ],
    random,
  ).slice(0, 3))
    terrain[y][x] = "tree";
  for (const { x, y } of shuffled(
    [
      { x: 6, y: 1 },
      { x: 6, y: 2 },
      { x: 6, y: 6 },
      { x: 7, y: 4 },
    ],
    random,
  ).slice(0, 2))
    terrain[y][x] = "rock";
  const spawns = {
    fire: { x: 1 + Math.floor(random() * 2), y: 5 },
    water: { x: 1 + Math.floor(random() * 2), y: 6 },
    earth: { x: 0, y: 7 },
    "enemy-1": { x: 3, y: 3 },
    "enemy-2": { x: 5, y: 5 },
    "enemy-3": { x: 5, y: 7 },
  };
  return { seed, waterKind: "river", terrain, spawns };
}

export function generateMap(seed = "triade") {
  const normalized = normalizeSeed(seed),
    random = randomSource(normalized);
  const waterKind = pick(["river", "lake", "coast"], random);
  // Retry using the same seeded stream when a footprint would obstruct paths
  // or leave no dry formation. No runtime randomness enters a seeded map.
  for (let attempt = 0; attempt < 160; attempt++) {
    const terrain = Array.from({ length: SIZE }, () =>
      Array(SIZE).fill("grass"),
    );
    const water = { river, lake, coast }[waterKind](random);
    water.forEach(({ x, y }) => {
      terrain[y][x] = "water";
    });
    if (
      !ruins(terrain, random) ||
      !scatter(terrain, "tree", 3 + Math.floor(random() * 3), random) ||
      !scatter(terrain, "rock", 2 + Math.floor(random() * 2), random)
    )
      continue;
    const spawns = spawnPositions(terrain, random);
    if (spawns) return { seed: normalized, waterKind, terrain, spawns };
  }
  return fallbackMap(normalized, random);
}
