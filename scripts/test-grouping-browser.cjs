async page => {
  const students = Array.from({length: 6}, (_, index) => ({id: `s${index + 1}`, studentNo: String(index + 1).padStart(2, '0'), name: `学生${index + 1}`, emoji: '😀', score: 0}));
  const payload = {version: 2, activeClass: '测试班', classes: {测试班: {className: '测试班', students, logs: [], grouping: {locked: true, groupCount: 2, groups: [{id: 'group-1', name: '第1组', max: 4, studentIds: [], leaderId: null}, {id: 'group-2', name: '第2组', max: 4, studentIds: [], leaderId: null}], unassignedIds: students.map(s => s.id), committee: {}}}}};
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/session') return route.fulfill({contentType: 'application/json', body: JSON.stringify({teacher: {id: 'browser-test', displayName: '浏览器测试'}})});
    if (url.pathname === '/api/workspace') return route.fulfill({contentType: 'application/json', body: JSON.stringify({ok: true, payload, updatedAt: '2026-10-10T00:00:00.000Z'})});
    return route.fulfill({contentType: 'application/json', body: JSON.stringify({ok: true})});
  });
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('http://127.0.0.1:4173/cloud.html');
  await page.waitForSelector('#groupingEntry');
  await page.evaluate(() => { window.BubblePhysics.step = () => {}; window.classroomCloudBridge.setData(window.classroomCloudBridge.getData()); });
  await page.click('#groupingEntry');
  await page.click('.group-lock');
  await page.waitForTimeout(100);
  const source = page.locator('.public-student').first();
  const target = page.locator('.group-zone:not(.public-zone) .zone-canvas');
  const sourceBox = await source.locator('.bubble').boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('drag fixtures not visible');
  const sx = sourceBox.x + sourceBox.width / 2, sy = sourceBox.y + sourceBox.height / 2;
  const tx = targetBox.x + targetBox.width / 2, ty = targetBox.y + targetBox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(tx, ty, {steps: 1});
  await page.mouse.up();
  await page.waitForTimeout(30);
  const result = await page.evaluate(() => ({publicCount: document.querySelectorAll('.public-student').length, groupCount: document.querySelectorAll('.group-zone:not(.public-zone) [data-student]').length}));
  if (result.publicCount !== 5 || result.groupCount !== 1) throw new Error(`drag failed: ${JSON.stringify(result)}`);
  return {ok: true, result};
}
