import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, key } from '../src/engine.js';
import { blankLevel, grid, normalizeLevel, validateLevel, deploymentCells, exportPlayableHtml, levelFromGenerated } from '../src/levels.js';
import { generateMap } from '../src/maps.js';

function scenario() {
  const level = blankLevel();
  for (const [x,y] of [[0,5],[1,5],[2,5],[0,6],[1,6],[2,6]]) level.deployment[y][x] = 'deployment';
  return level;
}
const positions = b => b.allies.map(({id,x,y})=>({id,x,y}));

test('legacy v1 files without a deployment layer keep their authored positions and begin in combat', () => {
  const level=blankLevel(); delete level.deployment;
  const restored=normalizeLevel(level);
  assert.deepEqual(restored.deployment,grid());
  const battle=new Battle({level,deployment:true});
  assert.equal(battle.phase,'player');
  assert.deepEqual(positions(battle),level.units.filter(u=>u.team==='ally').map(({id,x,y})=>({id,x,y})));
  assert.equal(battle.confirmDeployment(),false);
});

test('deployment markers coexist with terrain and effects, round-trip and reject invalid layer data', () => {
  const level=scenario(); level.ground[5][0]='water'; level.effects[5][0]='steam';
  const copy=normalizeLevel(JSON.parse(JSON.stringify(level)));
  assert.deepEqual(copy,level);
  copy.deployment[5][0]=null;
  assert.equal(level.deployment[5][0],'deployment');
  for(const mutate of [l=>l.deployment.pop(),l=>l.deployment[0][0]='rock',l=>l.effects[0][0]='deployment',l=>l.deployment[0][0]=true]) {
    const invalid=scenario();mutate(invalid);assert.throws(()=>normalizeLevel(invalid));
  }
});

test('only walkable marked cells without enemies count toward the required three slots', () => {
  const level=scenario();level.deployment=grid();
  for(const [x,y] of [[0,0],[1,0],[2,0],[3,0],[4,0],[5,2]]) level.deployment[y][x]='deployment';
  level.objects[0][1]='tree';level.ground[0][2]='deep-water';level.ground[0][3]='abyss';
  assert.equal(deploymentCells(level).length,2);
  assert.match(validateLevel(level).errors.join(' '),/três casas transitáveis/);
  assert.throws(()=>new Battle({level}),/três casas transitáveis/);
  level.objects[0][2]='bridge';
  assert.equal(deploymentCells(level).length,3);
  assert.deepEqual(validateLevel(level).errors,[]);
  assert.match(validateLevel(level).warnings.join(' '),/bloqueadas ou ocupadas/);
});

test('deployment preserves valid author positions and places outside heroes in available marked cells', () => {
  const level=scenario();const before=structuredClone(level);
  const battle=new Battle({level});
  assert.equal(battle.phase,'deployment');
  assert.deepEqual({x:battle.units.find(u=>u.id==='fire').x,y:battle.units.find(u=>u.id==='fire').y},{x:1,y:6});
  assert.ok(battle.allies.every(u=>battle.inDeploymentArea(u.x,u.y)));
  assert.equal(new Set(battle.units.map(u=>key(u.x,u.y))).size,battle.units.length);
  assert.ok(battle.enemies.every(u=>u.intent===null));
  assert.deepEqual(battle.visualEvents,[]);
  assert.deepEqual(level,before);
});

test('initial placement allows unrestricted changes and ally swaps without damage or spent actions', () => {
  const battle=new Battle({level:scenario()});const original=positions(battle);
  const water=battle.units.find(u=>u.id==='water');const waterPos={x:water.x,y:water.y};
  assert.ok(battle.select('fire'));
  assert.ok(battle.deploy(water.x,water.y));
  assert.deepEqual({x:battle.selected.x,y:battle.selected.y},waterPos);
  assert.deepEqual({x:water.x,y:water.y},(({x,y})=>({x,y}))(original.find(u=>u.id==='fire')));
  assert.ok(battle.deploy(2,6));assert.ok(battle.deploy(0,6));assert.ok(battle.deploy(2,6));
  assert.equal(battle.round,1);assert.equal(battle.kills,0);
  assert.ok(battle.allies.every(u=>u.hp===3&&!u.moved&&!u.acted&&!u.moveUndo));
  assert.deepEqual(battle.visualEvents,[]);
});

test('combat commands, undo and previews are unavailable until deployment confirmation', () => {
  const battle=new Battle({level:scenario()});const before=positions(battle);
  assert.equal(battle.select('enemy-1'),false);
  for(const [x,y] of [[7,7],[-1,0],[1.5,5],[NaN,5]]) assert.equal(battle.deploy(x,y),false);
  assert.equal(battle.move(0,6),false);
  assert.equal(battle.setMode('punch'),false);
  assert.equal(battle.punch(0,5),false);
  assert.equal(battle.fire(5,6),false);
  assert.equal(battle.wave(),false);
  assert.equal(battle.earth(0,6),false);
  assert.equal(battle.wait(),false);
  assert.equal(battle.undoMove(),false);
  assert.equal(battle.beginEnemyTurn(),false);
  assert.equal(battle.resolveEnemyTurn(),false);
  assert.equal(battle.previewAction(0,6),null);
  assert.deepEqual(battle.targets(),[]);
  assert.deepEqual(positions(battle),before);
});

test('confirmation arms enemies against the chosen formation once and leaves turn 1 actions intact', () => {
  const level=scenario();const battle=new Battle({level});
  battle.deploy(0,6);battle.select('earth');battle.deploy(2,6);
  const initialEnemies=battle.enemies.map(({id,x,y})=>({id,x,y}));
  const reference=structuredClone(level);
  for(const u of reference.units.filter(u=>u.team==='ally')) Object.assign(u,positions(battle).find(p=>p.id===u.id));
  reference.deployment=grid();
  const expected=new Battle({level:reference});
  assert.ok(battle.confirmDeployment());
  assert.equal(battle.phase,'player');assert.equal(battle.round,1);
  assert.deepEqual(battle.enemies,expected.enemies);
  assert.deepEqual(battle.enemies.map(({id,x,y})=>({id,x,y})),initialEnemies);
  assert.ok(battle.allies.every(u=>u.hp===3&&!u.moved&&!u.acted));
  const events=battle.visualEvents.length;
  assert.equal(battle.confirmDeployment(),false);assert.equal(battle.deploy(1,5),false);
  assert.equal(battle.visualEvents.length,events);
  assert.ok(battle.wait());
});

test('exactly three marked cells still allow every ninja to exchange positions', () => {
  const level=scenario();level.deployment=grid();
  for(const [x,y] of [[0,0],[1,0],[2,0]]) level.deployment[y][x]='deployment';
  const battle=new Battle({level});
  battle.select('fire');assert.ok(battle.deploy(2,0));
  battle.select('water');assert.ok(battle.deploy(0,0));
  assert.equal(new Set(positions(battle).map(p=>key(p.x,p.y))).size,3);
  assert.ok(battle.confirmDeployment());
});

test('restart, team changes and imports rebuild placement while an unmarked imported level starts immediately', () => {
  const level=scenario();const battle=new Battle({level});const original=positions(battle);
  battle.deploy(0,6);battle.confirmDeployment();battle.damage(battle.selected,1);battle.reset();
  assert.equal(battle.phase,'deployment');assert.deepEqual(positions(battle),original);
  battle.setTeam(['lightning','wind','earth']);
  assert.equal(battle.phase,'deployment');assert.deepEqual(battle.team,['lightning','wind','earth']);
  assert.ok(battle.allies.every(u=>battle.inDeploymentArea(u.x,u.y)&&u.hp===3));
  battle.loadLevel(blankLevel());assert.equal(battle.phase,'player');
  battle.loadLevel(level);assert.equal(battle.phase,'deployment');
});

test('procedural placement is reproducible and its default confirmation retains existing opening combat rules', () => {
  for(let i=0;i<40;i++) {
    const seed=`deployment-${i}`;
    const battle=new Battle({seed,deployment:true});
    assert.equal(battle.phase,'deployment');
    assert.ok(battle.deploymentCells.length>=3&&battle.deploymentCells.length<=9);
    assert.ok(battle.deploymentCells.every(p=>!battle.obstacle(p.x,p.y)&&battle.unitAt(p.x,p.y)?.team!=='enemy'));
    const copy=new Battle({seed,deployment:true});
    assert.deepEqual(copy.deploymentCells,battle.deploymentCells);
    const classic=new Battle({seed});
    assert.ok(battle.confirmDeployment());
    assert.deepEqual(battle.units,classic.units);
    battle.newMap(`${seed}-next`);assert.equal(battle.phase,'deployment');
  }
});

test('generated editor maps and standalone HTML preserve their separate deployment layer', () => {
  const level=levelFromGenerated(generateMap('deployment-export'));
  assert.ok(deploymentCells(level).length>=3);
  assert.deepEqual(validateLevel(level).errors,[]);
  const html=exportPlayableHtml('<head></head><script>Triade.createApp()</script>',level);
  const serialized=JSON.parse(html.match(/window\.__TRIADE_LEVEL__=(.*?);<\/script>/)[1]);
  const battle=new Battle({level:serialized});
  assert.equal(battle.phase,'deployment');
  assert.deepEqual(serialized.deployment,level.deployment);
});

function playerSelectedLevel() {
  const level = scenario();
  level.units = level.units.filter(u => u.team === 'enemy');
  return level;
}

test('a marked level with no authored heroes is playable and does not insert them into the saved JSON', () => {
  const level = playerSelectedLevel();
  const original = structuredClone(level);
  assert.deepEqual(validateLevel(level).errors, []);
  const battle = new Battle({level});
  assert.equal(battle.phase, 'deployment');
  assert.equal(battle.allies.length, 3);
  assert.ok(battle.allies.every(u => battle.inDeploymentArea(u.x,u.y) && u.hp === 3));
  assert.deepEqual(level, original);
  assert.deepEqual(battle.options.level, original);
  const html = exportPlayableHtml('<head></head><script>Triade.createApp()</script>', level);
  const saved = JSON.parse(html.match(/window\.__TRIADE_LEVEL__=(.*?);<\/script>/)[1]);
  assert.equal(saved.units.filter(u => u.team === 'ally').length, 0);
  assert.ok(battle.confirmDeployment());
  assert.ok(battle.enemies.every(u => u.intent));
});

test('all ten player-selected teams can deploy on a level without authored heroes and survive resets', () => {
  const level = playerSelectedLevel();
  const elements = ['fire','water','earth','lightning','wind'];
  const battle = new Battle({level});
  for(let a=0;a<3;a++) for(let b=a+1;b<4;b++) for(let c=b+1;c<5;c++) {
    const team = [elements[a],elements[b],elements[c]];
    assert.ok(battle.setTeam(team));
    assert.deepEqual(battle.team, team);
    assert.equal(battle.allies.length, 3);
    assert.ok(battle.allies.every(u => battle.inDeploymentArea(u.x,u.y)));
    assert.equal(new Set(battle.units.map(u => key(u.x,u.y))).size, battle.units.length);
    assert.ok(battle.confirmDeployment());
    battle.reset();
    assert.equal(battle.phase,'deployment');
    assert.deepEqual(battle.team,team);
    assert.deepEqual(battle.options.level, level);
  }
});

test('one or two optional authored heroes prefill a valid trio without overlapping starting slots', () => {
  for(const count of [1,2]) {
    const level = scenario();
    level.units = [...level.units.filter(u=>u.team==='ally').slice(0,count), ...level.units.filter(u=>u.team==='enemy')];
    assert.deepEqual(validateLevel(level).errors, []);
    const battle = new Battle({level});
    assert.equal(battle.allies.length,3);
    assert.equal(new Set(battle.team).size,3);
    assert.deepEqual(battle.team.slice(0,count),level.units.filter(u=>u.team==='ally').map(u=>u.element));
    assert.ok(battle.allies.every(u=>battle.inDeploymentArea(u.x,u.y)));
    assert.equal(new Set(battle.units.map(u=>key(u.x,u.y))).size,battle.units.length);
    battle.setTeam(['wind','lightning','earth']);
    assert.deepEqual(battle.options.level,level);
    assert.ok(battle.confirmDeployment());
  }
});

test('a map without heroes still needs three legal starting cells and an enemy or reinforcement wave', () => {
  const level = playerSelectedLevel();
  level.deployment = grid();
  assert.match(validateLevel(level).errors.join(' '), /três ninjas/);
  assert.throws(()=>new Battle({level}),/três ninjas/);
  level.deployment[5][0]='deployment';level.deployment[5][1]='deployment';
  assert.match(validateLevel(level).errors.join(' '),/três casas/);
  level.deployment[5][2]='deployment';
  level.units=[];
  assert.match(validateLevel(level).errors.join(' '),/inimigo ou uma onda/);
  level.rules.waves=[{round:2,kinds:['ranged']}];
  assert.deepEqual(validateLevel(level).errors,[]);
  const battle=new Battle({level});
  assert.equal(battle.allies.length,3);
  assert.equal(battle.enemies.length,0);
  assert.ok(battle.confirmDeployment());
  battle.beginEnemyTurn();battle.resolveEnemyTurn();
  assert.equal(battle.phase,'player');
  assert.equal(battle.enemies.length,1);
});

test('importing a hero-free level keeps the selected trio; importing a fixed level uses its authored trio', () => {
  const battle = new Battle({team:['lightning','wind','earth'],seed:'optional-team'});
  const level = playerSelectedLevel();
  battle.loadLevel(level);
  assert.deepEqual(battle.team,['lightning','wind','earth']);
  assert.deepEqual(battle.options.level,level);
  assert.ok(battle.confirmDeployment());
  battle.loadLevel(blankLevel());
  assert.equal(battle.phase,'player');
  assert.deepEqual(battle.team,['fire','water','earth']);
});
