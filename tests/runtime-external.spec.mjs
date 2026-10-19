import { expect, test } from '@playwright/test';

async function mockGateway(page, { feedbackKnown = false, commandStatus = 'acknowledged' } = {}) {
  let failing = false;
  const commands = [];
  const keys = ['temperature', 'humidity', 'light', 'soilMoisture', 'co2'];
  const values = [28, 60, 18000, 30, 700];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    expect(new URL(request.url()).hostname).toBe('mock-gateway.invalid');
    const path = new URL(request.url()).pathname;
    if (failing) return route.fulfill({ status: 503, body: '{}' });
    let json;
    const now = new Date().toISOString();
    if (path.endsWith('/health')) json = { schemaVersion: 1, status: 'ok' };
    else if (path.endsWith('/actuators')) json = ['waterPump', 'fan', 'growLight', 'shade'].map(logicalDevice => ({ logicalDevice, online: logicalDevice !== 'shade', ...(feedbackKnown || logicalDevice !== 'waterPump' ? { actual: false } : {}), target: false, updatedAt: now, feedbackLevel: logicalDevice === 'fan' ? 'output' : 'gateway', sourceKind: 'hardware' }));
    else if (path.endsWith('/sensors/latest')) json = keys.map((key, i) => ({ schemaVersion: 1, eventId: now + key, sequence: i, source: 'isolated-test', sourceKind: key === 'light' ? 'simulation' : 'hardware', gatewayId: 'mock', deviceId: key, channelId: String(i), sensorId: 'mock-' + key, key, value: values[i], unit: 'test', capturedAt: now, receivedAt: now, quality: 'good', valid: true }));
    else if (path.endsWith('/control/commands')) {
      const body = request.postDataJSON(); commands.push(body);
      json = { schemaVersion: 1, commandId: body.commandId, idempotencyKey: body.idempotencyKey, target: body.target, status: commandStatus };
    } else throw new Error('Unexpected API path ' + path);
    return route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return { commands, fail: () => { failing = true; } };
}

test('外部监测、混合来源、未知反馈与演示隔离', async ({ page, baseURL }, info) => {
  const mock = await mockGateway(page);
  await page.goto(baseURL);
  await expect(page.getByText('运行模式：外部接入').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '数据不足', exact: true })).toBeVisible();
  await page.getByText('连接详情', { exact: true }).first().click();
  await expect(page.getByText('目标：开启 · 反馈：状态未知').first()).toBeVisible();
  await expect(page.getByText('输出通道反馈，动作未确认').first()).toBeVisible();
  await page.getByRole('button', { name: '演示视图', exact: true }).click();
  await expect(page.getByRole('button', { name: '单步推进' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '答辩复位' })).toBeDisabled();
  await page.getByRole('button', { name: '运行视图', exact: true }).click();
  await page.getByRole('button', { name: '环境监测', exact: true }).click();
  await expect(page.getByText('仿真数据', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('硬件上报（待现场核验）', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '智能控制', exact: true }).click();
  await expect(page.getByRole('switch', { name: '切换自动与手动控制' })).toBeDisabled();
  expect(mock.commands).toEqual([]);
  await page.screenshot({ path: info.outputPath('external-evidence.png'), fullPage: true });
});

test('外部断线保留反馈，确认和人工处理不自动恢复异常', async ({ page, baseURL }, info) => {
  const mock = await mockGateway(page, { feedbackKnown: true });
  await page.goto(baseURL);
  await expect(page.getByRole('button', { name: '查看报警与处理' }).first()).toBeVisible();
  await page.getByRole('button', { name: '查看报警与处理' }).first().click();
  await expect(page.getByRole('region', { name: '报警详情' })).toBeVisible();
  await page.getByRole('button', { name: '确认报警' }).first().click();
  await page.getByLabel('处理备注', { exact: true }).fill('现场供电待复测，暂未恢复');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '保存处理记录', exact: true }).click();
  await expect(page.getByText('人工处理完成（不代表数据恢复）', { exact: false })).toBeVisible();
  await expect(page.getByText('已确认，异常未恢复', { exact: false }).first()).toBeVisible();
  mock.fail();
  await page.getByRole('button', { name: '数据总览', exact: true }).click();
  await expect(page.getByText('反馈已过期，当前动作未确认；上方为最后已知状态').first()).toBeVisible();
  await expect(page.getByText('网关：通信失败').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('external-mobile-offline.png'), fullPage: true });
  expect(mock.commands).toEqual([]);
});

test('mock 控制只接受网关回执时不宣称动作已确认，超时不自动重发', async ({ page, baseURL }) => {
  const mock = await mockGateway(page, { feedbackKnown: true });
  await page.goto(baseURL);
  await page.getByRole('button', { name: '智能控制', exact: true }).click();
  const authorize = page.getByRole('button', { name: '授权本次控制会话', exact: true });
  await expect(authorize).toBeEnabled();
  page.once('dialog', d => d.accept()); await authorize.click();
  page.once('dialog', d => d.accept());
  await page.getByRole('switch', { name: '切换自动与手动控制' }).click();
  await page.getByRole('switch', { name: '设置滴灌水泵目标状态' }).click();
  // Initial auto target is on; turn off then on to create an isolated command.
  await page.getByRole('switch', { name: '设置滴灌水泵目标状态' }).click();
  await expect(page.getByText('命令：网关已接受').first()).toBeVisible();
  await expect(page.getByText('命令：等待回执超时').first()).toBeVisible({ timeout: 8000 });
  const count = mock.commands.length;
  await page.getByRole('button', { name: '数据总览', exact: true }).click();
  await page.getByRole('button', { name: '演示视图', exact: true }).click();
  expect(mock.commands.length).toBe(count);
  expect(mock.commands.every(c => c.device === 'waterPump')).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: '智能控制', exact: true }).click();
  await expect(page.getByRole('button', { name: '授权本次控制会话', exact: true })).toBeVisible();
  expect(mock.commands.length).toBe(count);
});
