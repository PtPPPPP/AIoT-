import { expect, test } from '@playwright/test';

async function openAnalysis(page, baseURL) {
  await page.route('**/api/v1/**', route => { throw new Error('Analysis tests must never request a gateway: ' + route.request().url()); });
  await page.goto(baseURL);
  await page.getByRole('button', { name: '数据分析', exact: true }).click();
  await expect(page.getByRole('heading', { name: '环境日报', exact: true })).toBeVisible();
  await page.getByLabel('分析区域').selectOption('software-test-zone');
  await page.getByRole('checkbox', { name: '自定义时间范围' }).check();
  await page.getByLabel('分析开始时间').fill('2026-10-20T08:00');
  await page.getByLabel('分析结束时间').fill('2026-10-20T08:10');
  await expect(page.getByText('范围内 17 条采样。', { exact: false })).toBeVisible();
}

test('日报、真实时间图、原始证据和灌溉效果一致', async ({ page, baseURL }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openAnalysis(page, baseURL);
  const soil = page.locator('.analysis-stat').filter({ has: page.getByRole('heading', { name: '土壤湿度（%）', exact: true }) });
  await expect(soil).toContainText('38.17');
  await expect(soil).toContainText('60.0%');
  await expect(soil).toContainText('有效 360.0 秒 / 分母 600.0 秒');
  await expect(soil).toContainText('目标内 150.0 秒');
  await expect(soil).toContainText('超限 210.0 秒');
  await page.getByRole('button', { name: '查看本次灌溉效果', exact: true }).nth(1).click();
  const detail = page.getByRole('region', { name: '单次灌溉效果详情' });
  await expect(detail).toContainText('反馈连续支持的运行时长下界：60.0 秒');
  await expect(detail).toContainText('60.0 秒 — 130.0 秒');
  await expect(detail).toContainText('不能确认真实灌溉完成');
  await expect(detail).toContainText('不能将变化单独归因于灌溉');
  await expect(page.getByRole('img', { name: '土壤湿度 · test-soil真实时间趋势', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('analysis-desktop.png'), fullPage: true });
  await page.locator('.analysis-stat-grid').screenshot({ path: info.outputPath('report-cards.png') });
  await detail.screenshot({ path: info.outputPath('irrigation-detail.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('analysis-mobile.png') });
  expect(errors).toEqual([]);
});

test('人工备注可保存，硬件分区不混入仿真结果', async ({ page, baseURL }) => {
  await openAnalysis(page, baseURL);
  await page.getByRole('button', { name: '查看本次灌溉效果', exact: true }).nth(1).click();
  await expect(page.getByRole('region', { name: '单次灌溉效果详情' })).toBeVisible();
  await page.getByLabel('人工操作发生时间').fill('2026-10-20T08:04');
  await page.getByLabel('人工操作类型').selectOption('hand-watering');
  await page.getByLabel('分析核查备注').fill('软件测试：记录一次重叠人工浇水，不据此归因');
  await page.getByRole('button', { name: '保存分析核查备注', exact: true }).click();
  await expect(page.getByRole('region', { name: '单次灌溉效果详情' })).toContainText('软件测试：记录一次重叠人工浇水，不据此归因');
  await page.getByLabel('分析数据分区').selectOption('hardware');
  await expect(page.getByText('范围内 0 条采样。', { exact: false })).toBeVisible();
  await expect(page.getByText('没有已记录的灌溉事件；不能据此证明现场没有发生灌溉。')).toBeVisible();
});

test('上下文留空可保存，确认目标不能缺少作物和依据', async ({ page, baseURL }) => {
  await openAnalysis(page, baseURL);
  await page.getByText('区域、种植批次与分析配置（按生效时间保存）', { exact: true }).click();
  const editor = page.locator('.analysis-form');
  await editor.locator('[name="zoneId"]').fill('browser-test-unconfigured');
  await editor.locator('[name="effectiveAt"]').fill('2026-10-21T00:00');
  await editor.getByLabel('土壤湿度目标下界').fill('40');
  await editor.getByLabel('土壤湿度目标上界').fill('50');
  await editor.locator('[name="confirmed"]').check();
  await editor.getByRole('button', { name: '保存新的生效版本', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('批次、作物、阶段和目标依据');
  await editor.getByLabel('土壤湿度目标下界').clear();
  await editor.getByLabel('土壤湿度目标上界').clear();
  await editor.getByRole('button', { name: '保存新的生效版本', exact: true }).click();
  await expect(page.getByLabel('分析区域').locator('option[value="browser-test-unconfigured"]')).toHaveCount(1);
  await page.getByLabel('分析区域').selectOption('browser-test-unconfigured');
  await page.getByText('区域、种植批次与分析配置（按生效时间保存）', { exact: true }).click();
  await expect(page.getByText('作物未配置 / 阶段未配置', { exact: false })).toBeVisible();
});
