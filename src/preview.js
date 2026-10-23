import { ELEMENTS, inside, key } from "./engine.js";

export const coordinate = (p) => `${"ABCDEFGH"[p.x]}${p.y + 1}`;
const escape = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function collisionDamage(preview, unit) {
  const collision = preview.collisions.find(
    (c) =>
      c.id === unit.id ||
      (c.obstacleType === "unit" && c.obstacleId === unit.id),
  );
  if (!collision) return "";
  return (preview.mode === "punch" || preview.effect?.type === "lightning") &&
    collision.id === unit.id
    ? `Dano: 1 PV do ${preview.effect?.type === "lightning" ? "Dash" : "Soco"} + 1 PV da colisão`
    : "Dano: 1 PV da colisão";
}

export function previewMarkup(preview) {
  const header =
    '<div class="preview-heading"><h2>Prévia da jogada</h2><span>ANTES DE CONFIRMAR</span></div>';
  if (!preview)
    return `${header}<p class="preview-empty">Selecione Soco ou Especial. Aponte uma casa válida ou use as setas. A prévia não gasta a ação.</p>`;
  const action =
    preview.mode === "punch" ? "Soco" : ELEMENTS[preview.actor.element].special;
  const rows = preview.units.map((unit) => {
    const damage = collisionDamage(preview, unit);
    const blocked = preview.blocked.find((b) => b.id === unit.id);
    const push = preview.pushes.find((p) => p.id === unit.id);
    const armed =
      push && unit.intent && !unit.defeated
        ? `Ataque mantém a direção ${unit.intent.x > unit.to.x ? "→" : unit.intent.x < unit.to.x ? "←" : unit.intent.y > unit.to.y ? "↓" : "↑"} · ${unit.attackCells.length ? unit.attackCells.map(coordinate).join(", ") : "bloqueado ou fora do mapa"}${unit.kind === "lobber" ? " · tiro por cima: alvo acompanha o empurrão" : ""}`
        : "";
    const movement =
      unit.id === preview.actor.id && preview.effect?.type === "lightning"
        ? `Dash: ${coordinate(unit.from)} → ${coordinate(preview.effect.impactFrom)} · custo: 1 PV`
        : push
          ? `Empurrão: ${coordinate(push.from)} → ${coordinate(push.to)}`
          : blocked && ["structure", "unit"].includes(blocked.reason)
            ? `Colisão em ${coordinate(blocked.to)} · ${blocked.obstacle}`
            : blocked?.reason === "edge"
              ? "Empurrão bloqueado pela borda"
              : blocked?.reason === "terrain"
                ? "Empurrão bloqueado por terreno intransponível"
                : preview.collisions.some((c) => c.obstacleId === unit.id)
                  ? `Atingido pela colisão em ${coordinate(unit.from)}`
                  : "";
    return `<li class="preview-unit ${unit.team === "ally" ? "preview-ally" : ""}"><div><strong>${escape(unit.name)}</strong>${unit.team === "ally" ? "<em>ALIADO</em>" : ""}<span>${unit.hpBefore} → ${unit.hpAfter} PV</span></div>${damage ? `<small>${escape(damage)}</small>` : ""}${movement ? `<small>${escape(movement)}</small>` : ""}${armed ? `<small class="preview-armed">${escape(armed)}</small>` : ""}${unit.defeated ? '<b class="preview-defeated">Derrotado</b>' : ""}</li>`;
  });
  for (const s of preview.structures) {
    const blocked = preview.blocked.find((entry) => entry.id === s.id);
    const detail = s.moved
      ? `Empurrão: ${coordinate(s.from)} → ${coordinate(s.to)}`
      : s.created
        ? `Criada em ${coordinate(s)}`
        : s.destroyed
          ? `Destruída · ${coordinate(s)} fica livre`
          : blocked?.reason === "edge"
            ? "Empurrão bloqueado pela borda"
            : blocked
              ? `Colisão em ${coordinate(blocked.to)} · ${blocked.obstacle}`
              : `Danificada em ${coordinate(s)}`;
    rows.push(
      `<li class="preview-structure"><div><strong>${escape(s.name)}</strong><span>${s.hpBefore} → ${s.hpAfter} PV</span></div><small>${escape(detail)}</small></li>`,
    );
  }
  const next = preview.nextEnemies.length
    ? `<div class="preview-next"><h3>AO ENCERRAR O TURNO</h3>${preview.nextEnemies
        .map((enemy) => {
          const result =
            enemy.status === "moves"
              ? `${coordinate(enemy.from)} → ${coordinate(enemy.to)} · ${enemy.path.length - 1} casa${enemy.path.length === 2 ? "" : "s"}`
              : enemy.status === "stays"
                ? `Permanece em ${coordinate(enemy.to)}`
                : enemy.status === "defeated"
                  ? "Derrotado na resolução dos ataques"
                  : "Sem avanço: batalha encerrada";
          return `<div class="preview-route"><strong>${escape(enemy.name)}</strong><span>${escape(result)}</span>${enemy.attackInterrupted ? "<small>O inimigo mantém a direção, mas o ataque encontra um bloqueio ou a borda.</small>" : ""}</div>`;
        })
        .join(
          "",
        )}${preview.incomingCount ? `<p>${preview.incomingCount === 1 ? "Chega" : "Chegam"} ${preview.incomingCount} reforço${preview.incomingCount === 1 ? "" : "s"} antes do próximo avanço.</p>` : ""}${preview.forecastResultReason === "timeout" ? '<p class="preview-defeated">O prazo termina ao encerrar este turno.</p>' : ""}<p>Se encerrar o turno agora. Outras jogadas mudam a previsão.</p></div>`
    : "";
  return `${header}<div class="preview-action">${escape(action)} · ${coordinate(preview.at)}</div><ul>${rows.join("") || '<li class="preview-empty">Nenhuma unidade atingida.</li>'}</ul>${preview.outcome === "victory" ? '<p class="preview-victory">Vitória ao confirmar esta ação.</p>' : ""}${next}<div class="preview-legend"><span><i class="preview-push-color"></i>1 · Empurrão imediato</span><span><i class="preview-path-color"></i>2 · Próximo avanço</span></div>`;
}

export function previewCellDescriptions(preview) {
  const cells = new Map();
  const add = (p, text) => {
    if (!p || !inside(p.x, p.y)) return;
    const id = key(p.x, p.y);
    cells.set(id, [...(cells.get(id) || []), text]);
  };
  if (!preview) return cells;
  for (const u of preview.units)
    add(
      u.from,
      `${u.name}: ${u.hpBefore} para ${u.hpAfter} PV${u.defeated ? ", será derrotado" : ""}${collisionDamage(preview, u) ? `. ${collisionDamage(preview, u)}` : ""}`,
    );
  if (preview.effect?.type === "lightning") {
    for (const p of preview.effect.path.slice(1))
      add(p, "Caminho do Dash Relâmpago");
    add(preview.effect.impactFrom, "Destino do dash · Rai perde 1 PV");
  }
  for (const p of preview.pushes) add(p.to, "Destino do empurrão imediato");
  for (const u of preview.units)
    if (u.kind === "lobber" && !u.defeated && preview.pushes.some((p) => p.id === u.id))
      for (const cell of u.attackCells)
        add(cell, `Novo alvo do tiro por cima de ${u.name}: 1 PV ao encerrar o turno`);
  for (const p of preview.structureMoves || [])
    add(p.to, `Destino do empurrão de ${p.name}`);
  for (const c of preview.collisions)
    add(
      c.to,
      c.obstacleType === "unit"
        ? "Colisão prevista contra personagem: 1 de dano em cada"
        : "Colisão prevista contra estrutura: 1 de dano em cada",
    );
  for (const s of preview.structures)
    add(
      s.from || s.to || s,
      `${s.name}: ${s.hpBefore} para ${s.hpAfter} PV${s.destroyed ? ", será destruída" : ""}`,
    );
  for (const enemy of preview.nextEnemies) {
    for (const p of enemy.path.slice(1))
      add(p, `Caminho previsto de ${enemy.name} ao encerrar o turno`);
    if (enemy.to && ["moves", "stays"].includes(enemy.status))
      add(enemy.to, `Destino do próximo avanço: ${enemy.name}`);
  }
  return cells;
}
