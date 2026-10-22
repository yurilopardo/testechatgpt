import { BoardRenderer, ENEMY_STEP_MS } from "./art.js";
import { ELEMENTS, key } from "./engine.js";
import { ISO, projectCell, isometricCellBox } from "./isometric-scene.js";

const P = {
  outline: "#18252b",
  shade: "#253a40",
  cloth: "#3b5360",
  clothLight: "#5b7580",
  stone: "#64756d",
  stoneLight: "#9aa596",
  woodDark: "#4e3b32",
  wood: "#72533b",
  woodLight: "#a17d4e",
  skin: "#d39a6b",
  skinLight: "#efc49a",
  leafDark: "#254d3b",
  leaf: "#366b45",
  leafLight: "#5e914f",
  leafTip: "#94b866",
  waterDark: "#234a68",
  water: "#2b7393",
  waterLight: "#4fa8ba",
  foam: "#a3dadd",
  cream: "#f3f0de",
  gold: "#f1c76b",
  red: "#c74b43",
};
const box = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
// Scanline fills keep the isometric edges stepped, without antialiasing.
function polygon(c, points, color) {
  c.fillStyle = color;
  for (
    let y = Math.ceil(Math.min(...points.map((p) => p[1])));
    y < Math.max(...points.map((p) => p[1]));
    y++
  ) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        scan = y + 0.5;
      if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan))
        intersections.push(
          a[0] + ((scan - a[1]) * (b[0] - a[0])) / (b[1] - a[1]),
        );
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2)
      c.fillRect(
        Math.ceil(intersections[i]),
        y,
        Math.ceil(intersections[i + 1]) - Math.ceil(intersections[i]),
        1,
      );
  }
}
const diamond = (p, inset = 0) => [
  [p.x, p.y - 14 + inset],
  [p.x + 28 - inset * 2, p.y],
  [p.x, p.y + 14 - inset],
  [p.x - 28 + inset * 2, p.y],
];
function outline(c, p, color, inset = 2, dashed = false) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.setLineDash(dashed ? [3, 3] : []);
  c.beginPath();
  diamond(p, inset).forEach(([x, y], i) =>
    i ? c.lineTo(x, y) : c.moveTo(x, y),
  );
  c.closePath();
  c.stroke();
  c.restore();
}
function shadow(c, p, width = 13) {
  polygon(
    c,
    [
      [p.x - width, p.y],
      [p.x, p.y - 5],
      [p.x + width, p.y],
      [p.x, p.y + 6],
    ],
    "#18252b66",
  );
}

function tree(c, p, damaged = false) {
  shadow(c, p, 18);
  box(c, p.x - 3, p.y - 22, 7, 24, P.woodDark);
  box(c, p.x - 2, p.y - 20, 3, 21, P.wood);
  box(c, p.x - 2, p.y - 17, 1, 15, P.woodLight);
  const ox = p.x,
    oy = p.y - 35;
  polygon(
    c,
    [
      [ox - 20, oy - 1],
      [ox - 15, oy - 12],
      [ox - 5, oy - 18],
      [ox + 6, oy - 17],
      [ox + 15, oy - 10],
      [ox + 20, oy + 1],
      [ox + 15, oy + 10],
      [ox + 3, oy + 15],
      [ox - 11, oy + 12],
      [ox - 21, oy + 5],
    ],
    P.outline,
  );
  polygon(
    c,
    [
      [ox - 18, oy - 1],
      [ox - 13, oy - 11],
      [ox - 4, oy - 16],
      [ox + 5, oy - 15],
      [ox + 14, oy - 8],
      [ox + 18, oy + 1],
      [ox + 13, oy + 8],
      [ox + 2, oy + 12],
      [ox - 10, oy + 10],
      [ox - 18, oy + 4],
    ],
    P.leafDark,
  );
  polygon(
    c,
    [
      [ox - 17, oy - 1],
      [ox - 12, oy - 10],
      [ox - 3, oy - 15],
      [ox + 5, oy - 13],
      [ox + 10, oy - 5],
      [ox + 6, oy + 4],
      [ox - 5, oy + 8],
      [ox - 14, oy + 5],
    ],
    P.leaf,
  );
  polygon(
    c,
    [
      [ox - 14, oy - 2],
      [ox - 10, oy - 9],
      [ox - 3, oy - 13],
      [ox + 3, oy - 11],
      [ox + 3, oy - 5],
      [ox - 3, oy - 2],
      [ox - 4, oy + 3],
      [ox - 11, oy + 2],
    ],
    damaged ? P.gold : P.leafLight,
  );
  box(c, ox - 9, oy - 8, 5, 2, P.leafTip);
  box(c, ox - 13, oy - 3, 4, 2, P.leafTip);
  box(c, ox + 6, oy + 3, 6, 3, P.leaf);
  if (damaged) {
    box(c, ox + 7, oy - 12, 10, 9, "#111b26");
    box(c, ox + 9, oy - 6, 3, 8, P.woodLight);
    box(c, ox + 13, oy + 16, 3, 2, P.gold);
  }
}
function rock(c, p, barrier = false) {
  shadow(c, p, 17);
  const x = p.x,
    y = p.y;
  polygon(
    c,
    [
      [x - 19, y - 4],
      [x - 15, y - 18],
      [x - 3, y - 25],
      [x + 11, y - 21],
      [x + 19, y - 10],
      [x + 16, y + 2],
      [x + 2, y + 7],
      [x - 13, y + 3],
    ],
    P.outline,
  );
  polygon(
    c,
    [
      [x - 17, y - 5],
      [x - 13, y - 17],
      [x - 3, y - 23],
      [x + 10, y - 19],
      [x + 16, y - 9],
      [x + 13, y + 1],
      [x + 1, y + 4],
      [x - 12, y + 1],
    ],
    barrier ? P.wood : P.stone,
  );
  polygon(
    c,
    [
      [x - 13, y - 16],
      [x - 3, y - 22],
      [x + 8, y - 18],
      [x + 2, y - 9],
      [x - 8, y - 8],
    ],
    barrier ? P.woodLight : P.stoneLight,
  );
  polygon(
    c,
    [
      [x + 3, y - 9],
      [x + 10, y - 19],
      [x + 16, y - 9],
      [x + 13, y + 1],
      [x + 1, y + 4],
    ],
    P.shade,
  );
  box(c, x - 11, y - 13, 5, 2, barrier ? P.gold : P.cream);
  if (barrier) {
    box(c, x - 6, y - 22, 3, 19, P.woodDark);
    box(c, x + 5, y - 15, 3, 13, P.woodDark);
  }
}

// Small original 3/4-view pixel sprites: shared uniform, distinct silhouette.
export function drawIsometricUnit(
  c,
  unit,
  p,
  time = 0,
  walking = false,
  facing = 1,
) {
  c.save();
  c.translate(Math.round(p.x), Math.round(p.y));
  const enemy = unit.team === "enemy",
    element = unit.element;
  const accent = enemy
    ? "#ff354f"
    : {
        fire: "#e78646",
        water: P.waterLight,
        earth: P.leafTip,
        lightning: P.gold,
        wind: "#9176a3",
      }[element] || P.cream;
  const armor = element === "earth",
    step = walking ? Math.floor(time / 100) % 4 : 0,
    bob = walking && step % 2 ? -1 : 0;
  c.translate(0, bob);
  shadow(c, { x: 0, y: 1 }, 12);
  const tunic = enemy ? "#101114" : P.cloth,
    shade = enemy ? "#030405" : P.shade,
    light = enemy ? "#24272c" : P.clothLight;
  box(c, -9, -12, 7, 13, P.outline);
  box(c, 3, -12, 7, 13, P.outline);
  box(c, -8, -10, 5, 9 + (step === 1 ? 1 : 0), shade);
  box(c, 4, -10, 5, 9 + (step === 3 ? 1 : 0), shade);
  box(c, -10, -2 + (step === 1 ? -2 : 0), 8, 4, P.outline);
  box(c, 3, -1 + (step === 3 ? -2 : 0), 9, 4, P.outline);
  box(c, -10, -24, 20, 17, P.outline);
  box(c, -8, -24, 17, 15, tunic);
  box(c, -8, -23, 5, 12, light);
  box(c, 5, -21, 4, 13, shade);
  box(c, armor ? -15 : -12, -23, armor ? 8 : 6, 11, P.outline);
  box(c, 8, -22, armor ? 8 : 6, 12, P.outline);
  box(
    c,
    armor ? -14 : -11,
    -22,
    armor ? 7 : 5,
    7,
    armor ? P.stoneLight : light,
  );
  box(c, 9, -21, armor ? 6 : 4, 7, armor ? P.stone : shade);
  box(c, -11, -14, 5, 5, enemy ? shade : P.skin);
  box(c, 10, -13, 4, 5, enemy ? shade : P.skin);
  box(c, -8, -12, 17, 3, enemy ? "#24272c" : P.cream);
  box(c, -2, -12, 4, 4, accent);
  box(c, -3, -22, 5, 5, enemy ? shade : P.cream);
  box(c, -2, -21, 3, 2, accent);
  box(c, -9, -40, 17, 16, P.outline);
  box(c, -7, -39, 14, 12, enemy ? shade : "#253a40");
  if (!enemy) {
    box(c, -7, -38, 6, 5, "#3b5360");
    box(c, -8, -35, 17, 3, P.cream);
    box(c, -2, -35, 5, 3, accent);
    box(c, -6, -31, 13, 5, P.skin);
    box(c, -6, -31, 6, 3, P.skinLight);
    box(c, 1, -30, 2, 2, P.outline);
    box(c, 6, -30, 2, 2, P.outline);
    box(c, -5, -26, 13, 4, shade);
  } else {
    box(c, -8, -36, 16, 3, "#24272c");
    box(c, -6, -31, 5, 2, "#ff354f");
    box(c, 3, -31, 5, 2, "#ff354f");
  }
  if (element === "fire") {
    polygon(
      c,
      [
        [-9, -37],
        [-11, -42],
        [-5, -41],
        [-3, -45],
        [0, -41],
        [5, -43],
        [8, -38],
        [8, -36],
      ],
      P.outline,
    );
    box(c, -8, -41, 5, 2, "#e78646");
    box(c, -3, -42, 4, 3, "#c74b43");
    box(c, 6, -29, 8, 3, accent);
    box(c, 11, -26, 5, 3, "#c74b43");
  }
  if (element === "water") {
    box(c, -10, -38, 3, 13, P.outline);
    box(c, -12, -35, 4, 14, P.waterDark);
    box(c, -11, -35, 2, 11, accent);
    box(c, -11, -22, 4, 3, P.foam);
    box(c, 8, -30, 7, 2, accent);
    box(c, 12, -28, 5, 2, P.foam);
  }
  if (armor) {
    box(c, -9, -41, 16, 3, P.outline);
    box(c, -7, -40, 7, 2, P.stoneLight);
    box(c, -14, -16, 6, 3, accent);
    box(c, 10, -15, 6, 3, accent);
    box(c, -6, -36, 5, 1, P.gold);
  }
  if (facing < 0 && !enemy) {
    box(c, -6, -32, 14, 8, enemy ? shade : P.shade);
    box(c, -6, -33, 14, 2, accent);
  }
  c.restore();
}

export class IsometricRenderer extends BoardRenderer {
  constructor(canvas, battle) {
    super(canvas, battle);
    canvas.width = ISO.width;
    canvas.height = ISO.height;
    this.ctx.imageSmoothingEnabled = false;
    canvas.parentElement?.classList.add("isometric-surface");
    canvas.closest(".board-frame")?.classList.add("isometric-frame");
    const grid = canvas.parentElement?.querySelector(".grid-input");
    if (grid) {
      grid.classList.add("isometric-input");
      for (const cell of grid.querySelectorAll(".cell")) {
        const r = isometricCellBox(+cell.dataset.x, +cell.dataset.y);
        for (const [name, value] of Object.entries(r))
          cell.style[name] = `${value}%`;
      }
      this.unitInputs = document.createElement("div");
      this.unitInputs.className = "isometric-unit-inputs";
      grid.append(this.unitInputs);
    }
  }
  trigger(effect) {
    super.trigger(effect);
    if (effect) this.motions = this.motions.filter((m) => m.type !== "walk");
    if (effect?.type === "move" && !this.reducedMotion)
      this.motions.push({
        type: "walk",
        id: effect.id,
        path: [effect.from, ...effect.path],
        start: this.effect.start,
        end: this.effect.start + effect.path.length * ENEMY_STEP_MS,
      });
  }
  screenPosition(unit, time) {
    const p = this.positionFor(unit, time);
    return {
      ...projectCell(p.x / 64, p.y / 64),
      walking:
        p.walking ||
        this.motions.some(
          (m) => m.id === unit.id && m.type === "walk" && time < m.end,
        ),
    };
  }
  draw(time = 0) {
    this.consumeEvents(time);
    this.feedback = this.feedback.filter((f) => time - f.start < f.duration);
    this.motions = this.motions.filter((m) => time < m.end);
    const c = this.ctx,
      b = this.battle;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, ISO.width, ISO.height);
    box(c, 0, 0, ISO.width, ISO.height, "#111b26");
    polygon(
      c,
      [
        [256, 83],
        [488, 194],
        [256, 325],
        [24, 201],
      ],
      "#080f16",
    );
    const cells = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) cells.push({ x, y });
    cells.sort((a, z) => a.x + a.y - z.x - z.y || a.x - z.x);
    for (const cell of cells) {
      const { x, y } = cell,
        p = projectCell(x, y),
        water = (b.levelLayers?.ground[y][x] || b.terrain[y][x]) === "water";
      if (water) p.y += 3;
      const points = diamond(p),
        [top, right, bottom, left] = points;
      polygon(
        c,
        [left, bottom, [bottom[0], bottom[1] + 18], [left[0], left[1] + 18]],
        water ? P.waterDark : P.wood,
      );
      polygon(
        c,
        [bottom, right, [right[0], right[1] + 18], [bottom[0], bottom[1] + 18]],
        water ? "#182f43" : P.woodDark,
      );
      polygon(c, points, water ? P.water : P.leaf);
      if (water) {
        const frame = this.reducedMotion
          ? 0
          : Math.floor((time * 6) / 1000) % 4;
        for (let i = 0; i < 3; i++) {
          const dx = ((x * 7 + y * 11 + i * 13) % 27) - 13,
            dy = ((i * 7 + x * 3) % 13) - 6;
          box(
            c,
            p.x + dx + (frame === i ? 1 : 0),
            p.y + dy,
            7,
            1,
            i === 1 ? P.foam : P.waterLight,
          );
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const dx = ((x * 13 + y * 7 + i * 11) % 29) - 14,
            dy = ((x * 5 + y * 3 + i * 7) % 13) - 6;
          box(c, p.x + dx, p.y + dy, 3, 1, P.leafLight);
          if (i === 1) box(c, p.x + dx + 1, p.y + dy - 2, 1, 2, P.leafLight);
        }
      }
      outline(c, p, water ? "#234a68" : "#254d3b", 0);
    }
    const targets = this.inputLocked ? [] : b.targets();
    if (b.phase === "deployment")
      for (const p of b.deploymentCells) {
        const q = projectCell(p.x, p.y);
        polygon(c, diamond(q, 2), "#60bdd544");
        c.save();
        c.setLineDash([4, 3]);
        outline(c, q, "#b6edff", 2);
        c.restore();
      }
    for (const p of targets) {
      const q = projectCell(p.x, p.y);
      polygon(c, diamond(q, 2), b.mode === "move" ? "#4fa8ba20" : "#f1c76b20");
      outline(c, q, b.mode === "move" ? P.waterLight : P.gold, 2, true);
    }
    for (const e of b.enemies)
      for (const p of b.enemyThreatenedCells(e)) {
        const q = projectCell(p.x, p.y);
        polygon(c, diamond(q, 1), "#c74b4340");
        outline(c, q, P.red, 1);
        for (let i = -10; i <= 10; i += 5)
          box(c, q.x + i, q.y - 2, 2, 3, P.red);
      }
    const radial =
      b.mode === "special" && !b.selected?.acted
        ? b.selected?.element === "water"
          ? b.waveArea()
          : b.selected?.element === "wind" && this.preview
            ? [
                [0, -1],
                [1, 0],
                [0, 1],
                [-1, 0],
              ]
                .map(([dx, dy]) => ({
                  x: this.preview.at.x + dx,
                  y: this.preview.at.y + dy,
                }))
                .filter((p) => p.x >= 0 && p.y >= 0 && p.x < 8 && p.y < 8)
            : []
        : [];
    radial.forEach((p) => outline(c, projectCell(p.x, p.y), P.gold, 2));
    const entities = [
      ...b.structures.values(),
      ...(b.barrier ? [b.barrier] : []),
      ...b.units,
    ];
    for (const f of this.feedback)
      if (f.type === "damage" && f.defeated && f.unit)
        entities.push({ ...f.unit, ghost: true });
    entities.sort((a, z) => {
      const p = this.screenPosition(a, time),
        q = this.screenPosition(z, time);
      return p.y - q.y || p.x - q.x;
    });
    for (const entity of entities) {
      const p = this.screenPosition(entity, time);
      c.save();
      const hit = this.feedback.find(
        (f) => f.type === "damage" && f.id === entity.id,
      );
      if (entity.ghost)
        c.globalAlpha = Math.max(
          0,
          Math.min(1, 1 - (time - hit.start) / hit.duration),
        );
      if (entity.team) {
        if (entity.acted) c.globalAlpha *= 0.7;
        if (
          hit &&
          time >= hit.start &&
          time - hit.start < 100 &&
          !this.reducedMotion
        )
          c.filter = "brightness(0) invert(1)";
        drawIsometricUnit(
          c,
          entity,
          p,
          time,
          p.walking,
          entity.intent?.x < entity.x || entity.intent?.y < entity.y ? -1 : 1,
        );
      } else if (entity.type === "tree") tree(c, p, entity.hp < entity.maxHp);
      else rock(c, p, entity.type === "barrier");
      c.restore();
    }
    for (const e of this.motions.length ? [] : b.enemies)
      if (e.intent) this.arrow([e, ...b.enemyAttackPath(e)], "#ffb799", true);
    if (b.selected)
      outline(c, projectCell(b.selected.x, b.selected.y), P.gold, 1);
    const hover = this.cursor || this.hover;
    if (hover) outline(c, projectCell(hover.x, hover.y), P.cream, 0);
    this.drawIsometricPreview();
    this.drawIsometricEffect(time);
    for (const entity of entities) {
      const p = this.screenPosition(entity, time);
      if (entity.ghost) continue;
      if (entity.team) {
        this.health(
          entity,
          p.x,
          p.y - 49,
          entity.team === "enemy" ? "#ff8890" : ELEMENTS[entity.element].color,
        );
        if (entity.team === "enemy")
          polygon(
            c,
            [
              [p.x, p.y + 5],
              [p.x + 3, p.y + 8],
              [p.x, p.y + 11],
              [p.x - 3, p.y + 8],
            ],
            "#ff8890",
          );
        else {
          c.strokeStyle = P.cream;
          c.beginPath();
          c.arc(p.x, p.y + 8, 3, 0, Math.PI * 2);
          c.stroke();
        }
      } else if (entity.hp < entity.maxHp)
        this.badge(p, `${entity.hp}/${entity.maxHp}`, P.gold, -6);
    }
    for (const f of this.feedback)
      if (time >= f.start) {
        const progress = (time - f.start) / f.duration;
        if (f.type === "damage") {
          const p = f.unit
            ? this.screenPosition(f.unit, time)
            : projectCell(f.at.x, f.at.y);
          this.badge(p, `−${f.amount}`, "#ffb6a0", -35 - progress * 15);
        } else if (["collision", "impact"].includes(f.type)) {
          const p = projectCell(f.to.x, f.to.y);
          for (let i = 0; i < 5; i++)
            box(
              c,
              p.x + (i - 2) * 5 * (1 + progress),
              p.y - 10 - (i % 2) * 8 * progress,
              2,
              2,
              P.gold,
            );
        } else if (f.type === "enemy-ready")
          this.badge(projectCell(f.at.x, f.at.y), "ARMADO", P.gold, 18);
      }
    c.font = "10px monospace";
    c.textAlign = "center";
    c.fillStyle = "#a5b8b6";
    for (let i = 0; i < 8; i++) {
      let p = projectCell(i, -1);
      c.fillText("ABCDEFGH"[i], p.x, p.y - 3);
      p = projectCell(-1, i);
      c.fillText(String(i + 1), p.x, p.y + 2);
    }
    this.syncUnitInputs(time);
  }
  arrow(path, color, dashed = false) {
    if (path.length < 2) return;
    const c = this.ctx,
      points = path.map((p) => projectCell(p.x, p.y));
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 2;
    c.setLineDash(dashed ? [4, 3] : []);
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
    c.setLineDash([]);
    const to = points.at(-1),
      from = points.at(-2),
      a = Math.atan2(to.y - from.y, to.x - from.x);
    polygon(
      c,
      [
        [to.x, to.y],
        [to.x - Math.cos(a - 0.5) * 8, to.y - Math.sin(a - 0.5) * 8],
        [to.x - Math.cos(a + 0.5) * 8, to.y - Math.sin(a + 0.5) * 8],
      ],
      color,
    );
    c.restore();
  }
  badge(p, text, color, offset = -18) {
    const c = this.ctx;
    c.font = "bold 9px monospace";
    c.textAlign = "center";
    const w = c.measureText(text).width + 6;
    box(c, p.x - w / 2, p.y + offset - 9, w, 12, "#111b26ed");
    c.fillStyle = color;
    c.fillText(text, Math.round(p.x), Math.round(p.y + offset));
  }
  drawIsometricPreview() {
    const p = this.preview;
    if (!p) return;
    for (const push of p.pushes) {
      const u = p.units.find((u) => u.id === push.id);
      this.ctx.save();
      this.ctx.globalAlpha = 0.4;
      drawIsometricUnit(this.ctx, u, projectCell(push.to.x, push.to.y));
      this.ctx.restore();
      this.arrow([push.from, push.to], "#e78646");
    }
    for (const move of p.structureMoves) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.45;
      rock(
        this.ctx,
        projectCell(move.to.x, move.to.y),
        move.type === "barrier",
      );
      this.ctx.restore();
      this.arrow([move.from, move.to], "#e78646");
    }
    for (const u of p.units) {
      this.badge(
        projectCell(u.from.x, u.from.y),
        `${u.hpBefore}→${u.hpAfter} PV`,
        u.team === "ally" ? P.gold : P.cream,
        -57,
      );
      if (u.defeated)
        this.badge(projectCell(u.from.x, u.from.y), "×", P.red, 0);
    }
    for (const s of p.structures) {
      const at = s.to || s.from || s;
      outline(this.ctx, projectCell(at.x, at.y), P.gold, 1, true);
      this.badge(
        projectCell(at.x, at.y),
        `${s.hpBefore}→${s.hpAfter} PV`,
        P.gold,
        -32,
      );
    }
    for (const impact of p.collisions)
      this.badge(projectCell(impact.to.x, impact.to.y), "IMPACTO", P.gold, -12);
    for (const e of p.nextEnemies)
      if (e.status === "moves") this.arrow(e.path, "#b8b5ed", true);
    if (p.effect?.type === "fire")
      this.arrow([p.effect.from, p.effect.to], P.gold);
  }
  drawIsometricEffect(time) {
    const e = this.effect;
    if (!e) return;
    const t = (time - e.start) / 650;
    if (t > 1) {
      this.effect = null;
      return;
    }
    const c = this.ctx,
      to = projectCell(e.to?.x ?? 0, e.to?.y ?? 0);
    c.save();
    c.globalAlpha = 1 - t;
    if (e.type === "move") this.arrow([e.from, ...e.path], P.cream, true);
    else if (e.type === "water" || e.type === "wind") {
      c.strokeStyle = P.foam;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(to.x, to.y, 14 + t * 65, 7 + t * 32, 0, 0, Math.PI * 2);
      c.stroke();
    } else if (e.type === "fire") {
      const from = projectCell(e.from.x, e.from.y),
        k = Math.min(1, t * 2);
      box(
        c,
        from.x + (to.x - from.x) * k - 4,
        from.y + (to.y - from.y) * k - 12,
        9,
        9,
        "#e78646",
      );
      box(
        c,
        from.x + (to.x - from.x) * k - 2,
        from.y + (to.y - from.y) * k - 10,
        4,
        4,
        P.gold,
      );
    } else if (e.type === "enemy")
      for (const hit of e.strikes || []) {
        if (!hit.cancelled)
          this.arrow([hit.from, hit.hit || hit.to], "#ff8890");
      }
    else {
      for (let i = 0; i < 6; i++)
        box(
          c,
          to.x + (i - 3) * (2 + t * 5),
          to.y - 12 - (i % 3) * 4,
          3,
          3,
          P.gold,
        );
    }
    c.restore();
  }
  syncUnitInputs(time) {
    if (!this.unitInputs) return;
    const ids = new Set(this.battle.units.map((u) => u.id));
    for (const button of this.unitInputs.children)
      if (!ids.has(button.dataset.unitId)) button.remove();
    for (const u of this.battle.units) {
      let button = [...this.unitInputs.children].find(
        (b) => b.dataset.unitId === u.id,
      );
      if (!button) {
        button = document.createElement("button");
        button.className = "isometric-unit-target";
        button.dataset.unitId = u.id;
        button.tabIndex = -1;
        this.unitInputs.append(button);
      }
      const p = this.screenPosition(u, time);
      button.dataset.x = u.x;
      button.dataset.y = u.y;
      button.style.left = `${((p.x - 13) / ISO.width) * 100}%`;
      button.style.top = `${((p.y - 43) / ISO.height) * 100}%`;
      button.style.width = `${(26 / ISO.width) * 100}%`;
      button.style.height = `${(43 / ISO.height) * 100}%`;
      button.style.zIndex = String(100 + Math.round(p.y));
      button.disabled =
        this.inputLocked ||
        this.canvas.parentElement.querySelector(
          `.cell[data-x="${u.x}"][data-y="${u.y}"]`,
        )?.disabled;
      button.setAttribute("aria-label", `${u.name}, ${u.hp} PV`);
    }
  }
}
