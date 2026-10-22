import { expect, test } from '@playwright/test';

test('答辩主链路、故障链路和七页导航没有页面错误', async ({ page, baseURL }) => {
  const errors = [];
  const gatewayRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/')) gatewayRequests.push(request.url());
  });
  await page.goto(baseURL.endsWith('/') ? `${baseURL}index.html` : baseURL);
  await expect(page.getByText('运行模式：答辩仿真').first()).toBeVisible();
  await expect(page.getByText('数据：仿真数据').first()).toBeVisible();
  await page.getByRole('button', { name: '演示视图', exact: true }).click();
  await page.getByRole('button', { name: '土壤干旱' }).click();
  await page.getByRole('button', { name: '暂停模拟' }).click();
  await page.getByRole('button', { name: '单步推进' }).click();
  await expect(page.locator('.presentation-summary div').first()).toContainText('土壤干旱');
  await expect(page.getByText('滴灌水泵', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '水泵故障' }).click();
  await page.getByRole('button', { name: '单步推进' }).click();
  await expect(page.getByText('水泵离线故障注入')).toBeVisible();
  await expect(page.getByText('命令：命令被拒绝').first()).toBeVisible();
  await page.getByRole('button', { name: '传感器离线' }).click();
  await page.getByRole('button', { name: '单步推进' }).click();
  await page.getByRole('button', { name: '环境监测' }).click();
  await expect(page.getByText('离线', { exact: true }).first()).toBeVisible();
  for (const name of ['智能控制', 'AI识别', '报警中心', '设备管理', '项目介绍', '数据总览']) {
    await page.getByRole('button', { name }).click();
    await expect(page.locator('#root')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
  expect(gatewayRequests).toEqual([]);
});

test('快照导出、报警导出与答辩复位可用', async ({ page, baseURL }) => {
  await page.goto(baseURL.endsWith('/') ? `${baseURL}index.html` : baseURL);
  await page.getByRole('button', { name: '演示视图', exact: true }).click();
  const snapshot = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出演示快照' }).click();
  expect((await snapshot).suggestedFilename()).toContain('温室演示快照');
  await page.getByRole('button', { name: '水泵故障' }).click();
  await page.getByRole('button', { name: '单步推进' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '答辩复位' }).click();
  await expect(page.getByText('正常运行').first()).toBeVisible();
  await expect(page.getByText('模拟已暂停')).toBeVisible();
  await page.getByRole('button', { name: '报警中心' }).click();
  const alarm = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出全部/ }).click();
  expect((await alarm).suggestedFilename()).toContain('温室报警');
});

test('三款实有硬件、通道缺口和移动端布局可查看', async ({ page, baseURL }, testInfo) => {
  await page.goto(baseURL.endsWith('/') ? `${baseURL}index.html` : baseURL);
  await page.getByRole('button', { name: '设备管理' }).click();
  const hardware = page.getByRole('region', { name: '现有硬件与接入规划' });
  await expect(hardware.getByText('已持有', { exact: true })).toHaveCount(3);
  await expect(hardware.getByRole('heading', { name: /WISE-4012 ·/ })).toBeVisible();
  await expect(hardware.getByRole('heading', { name: /ADAM-6050 ·/ })).toBeVisible();
  await expect(hardware.getByRole('heading', { name: /EKI-2525 ·/ })).toBeVisible();
  await expect(hardware.getByText(/未分配 · .*4 路已占用/)).toBeVisible();
  await expect(hardware.getByRole('switch')).toHaveCount(0);
  await expect(page.getByText('LoRa/4G网关', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('hardware-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  for (const card of await hardware.locator('article').all()) {
    const box = await card.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: testInfo.outputPath('hardware-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '项目介绍' }).click();
  await expect(page.getByRole('region', { name: '现有硬件与接入规划' }).getByText('已持有', { exact: true })).toHaveCount(3);
});

test('运行视图只改变展示，AI 复核记录刷新后仍可查看', async ({ page, baseURL }, info) => {
  await page.goto(baseURL.endsWith('/') ? `${baseURL}index.html` : baseURL);
  await expect(page.getByRole('region', { name: '关键设备' })).toBeVisible();
  await expect(page.getByRole('button', { name: '单步推进' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('dashboard-desktop.png') });
  await page.getByRole('button', { name: '演示视图', exact: true }).click();
  await page.getByRole('button', { name: '暂停模拟', exact: true }).click();
  const readSnapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('aiot-greenhouse-demo-state')));
  const before = await readSnapshot();
  await page.getByRole('button', { name: '运行视图', exact: true }).click();
  await page.getByRole('button', { name: '演示视图', exact: true }).click();
  expect(await readSnapshot()).toEqual(before);
  await page.getByRole('button', { name: 'AI识别', exact: true }).click();
  await page.getByRole('button', { name: '运行模拟识别', exact: true }).click();
  await expect(page.getByLabel('复核备注')).toBeVisible();
  await page.getByLabel('复核结论').selectOption('recheck');
  await page.getByLabel('复核备注').fill('演示图片不用于病害诊断，等待现场复查');
  await page.getByRole('button', { name: '保存复核记录', exact: true }).click();
  await expect(page.getByText('待复查：演示图片不用于病害诊断，等待现场复查')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'AI识别', exact: true }).click();
  await expect(page.getByText('待复查：演示图片不用于病害诊断，等待现场复查')).toBeVisible();
  await page.getByRole('button', { name: '数据总览', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('dashboard-mobile.png') });
});
