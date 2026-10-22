// Small deterministic pixel drawings shared by the map editor and level tests.
const box = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
const local = (ctx, x, y, paint) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.rect(0, 0, 64, 64);
  ctx.clip();
  paint();
  ctx.restore();
};

export function drawExtraGround(ctx, type, x, y) {
  const colors = {
    dirt: "#98764c",
    path: "#8d9685",
    sand: "#cfb878",
    mud: "#70543f",
    ice: "#a4d8de",
    "deep-water": "#26536b",
    abyss: "#19212d",
    bridge: "#448e8d",
  };
  if (!colors[type]) return;
  local(ctx, x, y, () => {
    box(ctx, 0, 0, 64, 64, colors[type]);
    if (type === "path") {
      for (let yy = 2; yy < 64; yy += 16)
        for (let xx = -8 + (yy % 3) * 4; xx < 64; xx += 23) {
          box(ctx, xx, yy, 21, 14, "#a3aa96");
          box(ctx, xx + 2, yy + 2, 17, 2, "#bcc0aa");
        }
    } else if (type === "abyss") {
      box(ctx, 0, 0, 64, 5, "#596450");
      box(ctx, 0, 0, 5, 64, "#596450");
      box(ctx, 8, 9, 48, 47, "#101720");
      box(ctx, 13, 15, 36, 32, "#0a1018");
    } else {
      for (let i = 0; i < 20; i++) {
        const xx = (i * 17 + Math.floor(x / 64) * 7) % 60,
          yy = (i * 23 + Math.floor(y / 64) * 11) % 60;
        box(
          ctx,
          xx,
          yy,
          type.includes("water") || type === "bridge" ? 10 : 4,
          2,
          type === "mud"
            ? "#a08261"
            : type === "ice"
              ? "#e2f4e6"
              : type === "deep-water"
                ? "#467e91"
                : type === "sand"
                  ? "#e9d295"
                  : "#b49467",
        );
      }
      if (type === "mud") {
        box(ctx, 10, 16, 23, 7, "#4c4940");
        box(ctx, 35, 40, 19, 8, "#4c4940");
      }
      if (type === "ice") {
        box(ctx, 14, 12, 2, 25, "#effff0");
        box(ctx, 16, 12, 17, 2, "#effff0");
      }
    }
    box(ctx, 0, 0, 64, 1, "#30473655");
    box(ctx, 0, 0, 1, 64, "#30473655");
    if (type === "bridge") drawExtraObject(ctx, "bridge", 0, 0, "east");
  });
}

export function drawExtraObject(ctx, type, x, y, direction = "east") {
  if (!["bush", "log", "crate", "pillar", "bridge", "hot-rock"].includes(type))
    return;
  local(ctx, x, y, () => {
    if (
      ["log", "bridge"].includes(type) &&
      ["north", "south"].includes(direction)
    ) {
      ctx.translate(64, 0);
      ctx.rotate(Math.PI / 2);
    }
    if (type === "hot-rock") {
      box(ctx, 25, 23, 4, 9, "#e4a061");
      box(ctx, 28, 30, 10, 3, "#f0c17a");
      box(ctx, 35, 33, 3, 10, "#dc8554");
    } else if (type === "bush") {
      box(ctx, 8, 30, 47, 21, "#264b34");
      box(ctx, 15, 21, 35, 25, "#4d7b43");
      box(ctx, 24, 17, 17, 26, "#6b9750");
      box(ctx, 14, 29, 13, 6, "#82a55b");
    } else if (type === "crate") {
      box(ctx, 12, 16, 40, 36, "#573d2a");
      box(ctx, 15, 19, 34, 30, "#a77a45");
      for (let yy = 20; yy < 49; yy += 9) box(ctx, 16, yy, 32, 2, "#d0a66e");
      ctx.strokeStyle = "#66482e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(17, 21);
      ctx.lineTo(47, 46);
      ctx.moveTo(47, 21);
      ctx.lineTo(17, 46);
      ctx.stroke();
    } else if (type === "log") {
      box(ctx, 0, 24, 64, 23, "#523d2c");
      box(ctx, 0, 27, 64, 14, "#8e6a43");
      for (let xx = 0; xx < 64; xx += 17) box(ctx, xx, 30, 13, 3, "#b28a57");
      box(ctx, 3, 25, 7, 20, "#c3a16c");
      box(ctx, 5, 29, 3, 12, "#82613c");
    } else if (type === "pillar") {
      box(ctx, 15, 45, 34, 9, "#676e60");
      box(ctx, 22, 15, 20, 32, "#aaad98");
      box(ctx, 25, 18, 4, 25, "#d0cfb5");
      box(ctx, 17, 10, 30, 9, "#c0bfaa");
      box(ctx, 35, 25, 3, 12, "#6a7463");
    } else if (type === "bridge") {
      for (let xx = 0; xx < 64; xx += 10) {
        box(ctx, xx, 14, 8, 38, "#9a754c");
        box(ctx, xx + 1, 15, 6, 3, "#c2a06c");
      }
      box(ctx, 0, 16, 64, 4, "#664e35");
      box(ctx, 0, 46, 64, 4, "#664e35");
    }
  });
}

export function drawEffectTile(ctx, type, x, y, direction = "east") {
  if (!type) return;
  local(ctx, x, y, () => {
    if (type === "deployment") {
      box(ctx, 3, 3, 58, 58, "#60bdd52b");
      ctx.strokeStyle = "#a5eaff";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(5, 5, 54, 54);
      ctx.setLineDash([]);
      // Corner brackets remain distinguishable without relying on color.
      for (const [xx, yy, dx, dy] of [[9,9,1,1], [55,9,-1,1], [9,55,1,-1], [55,55,-1,-1]]) {
        box(ctx, xx + Math.min(0, dx * 8), yy, 10, 2, "#d2f5ff");
        box(ctx, xx, yy + Math.min(0, dy * 8), 2, 10, "#d2f5ff");
      }
    } else if (type === "steam") {
      ctx.globalAlpha = 0.8;
      box(ctx, 5, 24, 45, 15, "#c0d3c8");
      box(ctx, 14, 15, 36, 23, "#b6ccbf");
      box(ctx, 23, 10, 22, 30, "#d2e1d4");
      box(ctx, 13, 38, 41, 9, "#9ab7ad");
    } else if (type === "electric-seal") {
      ctx.strokeStyle = "#ead68c";
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, 36, 36);
      ctx.beginPath();
      ctx.moveTo(35, 17);
      ctx.lineTo(24, 34);
      ctx.lineTo(35, 34);
      ctx.lineTo(28, 47);
      ctx.stroke();
    } else if (type === "electrified-water") {
      ctx.strokeStyle = "#e6e6b3";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 19);
      ctx.lineTo(24, 28);
      ctx.lineTo(20, 37);
      ctx.lineTo(43, 34);
      ctx.lineTo(50, 47);
      ctx.stroke();
      box(ctx, 39, 12, 4, 7, "#e6f8e6");
      box(ctx, 35, 15, 12, 2, "#e6f8e6");
    } else if (type === "current") {
      ctx.translate(32, 32);
      ctx.rotate(
        { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 }[
          direction
        ],
      );
      box(ctx, -20, -3, 31, 6, "#b9f3e4");
      ctx.fillStyle = "#d9ffff";
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(7, -12);
      ctx.lineTo(7, 12);
      ctx.fill();
    } else if (type === "spikes") {
      for (const [xx, yy] of [
        [12, 40],
        [28, 46],
        [43, 36],
      ]) {
        ctx.fillStyle = "#c4c8b8";
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx + 5, yy - 22);
        ctx.lineTo(xx + 11, yy);
        ctx.fill();
      }
    } else if (type === "embers") {
      for (const [xx, yy] of [
        [13, 38],
        [28, 27],
        [45, 43],
        [35, 49],
      ]) {
        box(ctx, xx, yy, 9, 5, "#a34e35");
        box(ctx, xx + 2, yy - 5, 4, 8, "#f2b269");
      }
    } else if (type === "cracked") {
      ctx.strokeStyle = "#443d32";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(13, 8);
      ctx.lineTo(24, 26);
      ctx.lineTo(38, 30);
      ctx.lineTo(29, 47);
      ctx.lineTo(42, 59);
      ctx.moveTo(38, 30);
      ctx.lineTo(53, 23);
      ctx.stroke();
    } else if (type === "plate") {
      box(ctx, 12, 24, 40, 27, "#696a52");
      box(ctx, 17, 27, 30, 19, "#c1ae7e");
      box(ctx, 21, 29, 22, 3, "#e2c997");
    } else if (type === "shrine") {
      box(ctx, 16, 45, 33, 7, "#8f8b6c");
      box(ctx, 21, 23, 7, 24, "#c1ae80");
      box(ctx, 39, 23, 7, 24, "#c1ae80");
      box(ctx, 13, 17, 42, 7, "#c4a267");
      box(ctx, 18, 12, 32, 6, "#6c6f56");
      box(ctx, 29, 30, 7, 16, "#ead6a0");
    } else if (type === "reinforcement") {
      ctx.strokeStyle = "#edaa9e";
      ctx.lineWidth = 3;
      ctx.strokeRect(11, 11, 42, 42);
      box(ctx, 28, 21, 8, 24, "#e9a38a");
      box(ctx, 20, 29, 24, 8, "#e9a38a");
    }
  });
}
