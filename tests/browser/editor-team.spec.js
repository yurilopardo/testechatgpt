import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { blankLevel } from '../../src/levels.js';

const edit = (page,x,y) => page.getByTestId(`edit-cell-${x}-${y}`);
function withoutHeroes() {
  const level=blankLevel();
  level.units=level.units.filter(u=>u.team==='enemy');
  for(const x of [0,1,2]) level.deployment[5][x]='deployment';
  return level;
}
async function authorWithoutHeroes(page) {
  await page.goto('/editor.html');
  await page.locator('[data-category="Efeitos e objetivos"]').click();
  await page.locator('[data-brush="deployment"]').click();
  for(const x of [0,1,2]) await edit(page,x,5).click();
  await page.locator('#editor-erase-layer').selectOption('units');
  await page.locator('[data-mode="erase"]').click();
  for(const [x,y] of [[1,6],[2,6],[1,7]]) await edit(page,x,y).click();
  await expect(page.locator('#editor-counts')).toContainText('0 ninjas sugeridos');
  await expect(page.locator('#editor-validation')).toContainText('Fase pronta para testar');
  await expect(page.locator('#editor-team-note')).toContainText('opcionais');
}
async function savedLevel(page) {
  await page.locator('[data-edit="json"]').click();
  const level=JSON.parse(await page.locator('#editor-json').inputValue());
  await page.locator('[data-edit="close-json"]').click();
  return level;
}

test('an editor map without ninjas saves, reloads, selects its team and returns without adding heroes to the draft', async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await authorWithoutHeroes(page);
  await page.locator('[data-edit="save"]').click();
  await page.reload();
  await expect(page.locator('#editor-counts')).toContainText('0 ninjas sugeridos');
  await page.locator('[data-edit="test"]').click();
  const game=page.locator('#editor-game');
  await expect(game.locator('#team-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(game.locator('#team-dialog')).toBeVisible();
  await expect(game.locator('#team-cancel')).toBeHidden();
  await game.locator('.team-option[data-unit="fire"]').click();
  await expect(game.locator('#team-start')).toBeDisabled();
  await game.locator('.team-option[data-unit="lightning"]').click();
  await game.locator('.team-option[data-unit="water"]').click();
  await game.locator('.team-option[data-unit="wind"]').click();
  await game.locator('#team-start').click();
  await expect(game.locator('#phase-label')).toHaveText('Posicionamento inicial');
  for(const id of ['earth','lightning','wind']) await expect(game.locator(`.squad-card[data-unit="${id}"]`)).toBeVisible();
  await expect(game.locator('.deployment-cell')).toHaveCount(3);
  await game.locator('#start-battle').click();
  await expect(game.locator('#phase-label')).toHaveText('Sua vez de agir');
  await page.locator('[data-edit="close-test"]').click();
  const level=await savedLevel(page);
  expect(level.units.filter(u=>u.team==='ally')).toHaveLength(0);
  expect(level.units.filter(u=>u.team==='enemy')).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('JSON with no ninjas can load while team selection is open, then choose and reset a different trio',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?map=optional-json');
  await expect(page.locator('#team-dialog')).toBeVisible();
  await page.locator('#game-level-file').setInputFiles({name:'sem-ninjas.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(withoutHeroes()))});
  await expect(page.locator('#team-dialog')).toBeVisible();
  await expect(page.locator('.mission-header h1')).toHaveText('Nova fase');
  await page.locator('.team-option[data-unit="earth"]').click();
  await page.locator('.team-option[data-unit="wind"]').click();
  await page.locator('#team-start').click();
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('.squad-card[data-unit="wind"]')).toBeVisible();
  await page.locator('#start-battle').click();
  await expect(page.locator('#phase-label')).toHaveText('Sua vez de agir');
  await page.locator('[data-command="restart"]').click();
  await page.locator('[data-command="confirm-restart"]').click();
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('.squad-card[data-unit="wind"]')).toBeVisible();
  await expect(page.locator('#team-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('exported JSON and standalone HTML keep zero authored ninjas and select the trio before offline placement',async({page,context})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await authorWithoutHeroes(page);
  const jsonPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Baixar fase',exact:true}).click();
  const exported=JSON.parse(await readFile(await (await jsonPromise).path(),'utf8'));
  expect(exported.units.filter(u=>u.team==='ally')).toHaveLength(0);
  const htmlPromise=page.waitForEvent('download');
  await page.locator('[data-edit="export-html"]').click();
  const html=await readFile(await (await htmlPromise).path(),'utf8');
  await context.setOffline(true);
  await page.goto('about:blank');
  await page.setContent(html);
  await expect(page.locator('#team-dialog')).toBeVisible();
  await page.locator('.team-option[data-unit="earth"]').click();
  await page.locator('.team-option[data-unit="lightning"]').click();
  await page.locator('#team-start').click();
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('.squad-card[data-unit="lightning"]')).toBeVisible();
  await expect(page.locator('.deployment-cell')).toHaveCount(3);
  await page.locator('#start-battle').click();
  await expect(page.locator('#phase-label')).toHaveText('Sua vez de agir');
  expect(errors).toEqual([]);
});

test('a partial authored team is a suggestion and can be completed or replaced before placement',async({page})=>{
  const level=withoutHeroes();
  level.units.push({id:'wind',team:'ally',element:'wind',x:1,y:5});
  await page.goto('/editor.html');
  await page.locator('[data-edit="json"]').click();
  await page.locator('#editor-json').fill(JSON.stringify(level));
  await page.locator('[data-edit="apply-json"]').click();
  await expect(page.locator('#editor-validation')).toContainText('Fase pronta para testar');
  await page.locator('[data-edit="test"]').click();
  await expect(page.locator('#editor-game #team-dialog')).toBeVisible();
  await expect(page.locator('#editor-game .team-option[data-unit="wind"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#editor-game #team-start').click();
  await expect(page.locator('#editor-game #phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('#editor-game .squad-card')).toHaveCount(3);
});
