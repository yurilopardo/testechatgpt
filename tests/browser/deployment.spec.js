import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const cell=(page,x,y)=>page.getByTestId(`cell-${x}-${y}`);
const edit=(page,x,y)=>page.getByTestId(`edit-cell-${x}-${y}`);
const position=locator=>locator.evaluate(e=>({x:+e.dataset.x,y:+e.dataset.y}));
async function beginPlacement(page) {
  await page.goto('/?map=deployment-ui');
  await page.locator('#team-start').click();
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
}
async function editorArea(page) {
  await page.goto('/editor.html');
  await page.locator('[data-category="Efeitos e objetivos"]').click();
  await page.locator('[data-brush="deployment"]').click();
  for(const [x,y] of [[0,5],[1,5],[2,5]]) await edit(page,x,y).click();
}

test('main game allows legal placement, swaps and keyboard selection before turn 1 without spending actions', async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await beginPlacement(page);
  await expect(page.locator('#deployment-panel')).toBeVisible();
  await expect(page.locator('#end-turn')).toBeDisabled();
  await expect(page.locator('#unit-panel .action-buttons')).toBeHidden();
  await expect(page.locator('#intent-list')).not.toContainText('ATAQUE ARMADO');
  const fire=await position(page.locator('.cell[aria-label*=", Ígni,"]'));
  const water=await position(page.locator('.cell[aria-label*=", Nami,"]'));
  await cell(page,water.x,water.y).click();
  await expect(cell(page,water.x,water.y)).toHaveAttribute('aria-label',/Ígni, 3 PV/);
  await expect(cell(page,fire.x,fire.y)).toHaveAttribute('aria-label',/Nami, 3 PV/);
  await page.keyboard.press('2');
  await expect(page.locator('#deployment-selected')).toContainText('Nami');
  await cell(page,water.x,water.y).focus();await page.keyboard.press('Enter');
  await expect(cell(page,water.x,water.y)).toHaveAttribute('aria-label',/Nami, 3 PV/);
  await page.keyboard.press('e');await page.keyboard.press('z');
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  const invalid=page.locator('.cell:not(.deployment-cell)').first();
  await invalid.click();await expect(page.locator('#toast')).toContainText('casa azul');
  await expect(cell(page,water.x,water.y)).toHaveAttribute('aria-label',/Nami, 3 PV/);
  await page.locator('#start-battle').click();
  await expect(page.locator('#phase-label')).toHaveText('Sua vez de agir');
  await expect(page.locator('#deployment-panel')).toBeHidden();
  await expect(page.locator('#round-number')).toHaveText('TURNO 01');
  await expect(page.locator('#ready-count')).toHaveText('3');
  await expect(page.locator('#end-turn')).toBeEnabled();
  await expect(page.locator('#intent-list')).toContainText('ATAQUE ARMADO');
  await expect(page.locator('.deployment-cell')).toHaveCount(0);
  await page.locator('[data-command="restart"]').click();
  await page.locator('[data-command="confirm-restart"]').click();
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  await expect(cell(page,fire.x,fire.y)).toHaveAttribute('aria-label',/Ígni, 3 PV/);
  expect(errors).toEqual([]);
});

test('editor keeps starting area separate from ground and effects, saves it and reports insufficient cells',async({page})=>{
  await page.goto('/editor.html');
  await page.locator('[data-brush="water"]').click();await edit(page,0,5).click();
  await page.locator('[data-category="Efeitos e objetivos"]').click();
  await page.locator('[data-brush="steam"]').click();await edit(page,0,5).click();
  await page.locator('[data-brush="deployment"]').click();await edit(page,0,5).click();
  await expect(edit(page,0,5)).toHaveAttribute('aria-label',/Água rasa, Vapor, Área inicial/);
  await expect(page.locator('#editor-validation')).toContainText('pelo menos três casas');
  await page.locator('[data-edit="test"]').click();
  await expect(page.locator('#editor-play-dialog')).not.toBeVisible();
  for(const x of [1,2]) await edit(page,x,5).click();
  await page.locator('[data-edit="save"]').click();
  await page.reload();
  await expect(edit(page,0,5)).toHaveAttribute('aria-label',/Água rasa, Vapor, Área inicial/);
  await page.locator('[data-mode="erase"]').click();
  await page.locator('#editor-erase-layer').selectOption('deployment');await edit(page,0,5).click();
  await expect(edit(page,0,5)).toHaveAttribute('aria-label','A6, Água rasa, Vapor');
  await page.locator('#editor-undo').click();
  await page.locator('[data-edit="test"]').click();
  await expect(page.locator('#editor-game #phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('#editor-game .deployment-cell')).toHaveCount(3);
  await page.locator('#editor-game #start-battle').click();
  await expect(page.locator('#editor-game #phase-label')).toHaveText('Sua vez de agir');
  await page.locator('[data-edit="close-test"]').click();
  await expect(edit(page,0,5)).toHaveAttribute('aria-label',/Área inicial/);
});

test('JSON import into the main game and standalone exported HTML retain deployment, including offline',async({page,context},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await editorArea(page);
  const jsonDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Baixar fase',exact:true}).click();
  const jsonFile=await (await jsonDownload).path();
  const saved=JSON.parse(await readFile(jsonFile,'utf8'));
  expect(saved.deployment.flat().filter(Boolean)).toHaveLength(3);
  const htmlDownload=page.waitForEvent('download');
  await page.locator('[data-edit="export-html"]').click();
  const htmlFile=testInfo.outputPath('fase-com-area-inicial.html');
  await (await htmlDownload).saveAs(htmlFile);
  await page.goto('/?map=import-deployment');
  await page.locator('#team-start').click();
  await page.locator('#game-level-file').setInputFiles({name:'fase.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('.deployment-cell')).toHaveCount(3);
  await page.locator('#start-battle').click();
  await expect(page.locator('#phase-label')).toHaveText('Sua vez de agir');
  await context.setOffline(true);
  // Render the exact exported bytes without file: navigation, which the cloud browser blocks.
  await page.goto('about:blank');
  await page.setContent(await readFile(htmlFile,'utf8'));
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('.deployment-cell')).toHaveCount(3);
  await page.locator('#start-battle').click();
  await expect(page.locator('#phase-label')).toHaveText('Sua vez de agir');
  expect(errors).toEqual([]);
});

test('the isometric prototype supports initial placement on the same logical cells',async({page})=>{
  await page.goto('/isometrico.html');
  await expect(page.locator('#phase-label')).toHaveText('Posicionamento inicial');
  await expect(page.locator('.deployment-cell')).toHaveCount(6);
  await cell(page,1,6).focus();await page.keyboard.press('Enter');
  await expect(cell(page,1,6)).toHaveAttribute('aria-label',/Ígni, 3 PV/);
  await page.locator('#start-battle').click();
  await expect(page.locator('#phase-label')).toHaveText('Sua vez de agir');
  await expect(cell(page,1,6)).toHaveAttribute('aria-label',/Ígni, 3 PV/);
  await expect(page.locator('#pending-enemies')).toHaveText('0');
});
