import { wise4012ExampleMappings, adam6050InputExampleMappings, adam6050OutputExampleMappings } from './ioMapping.example';

describe('现有硬件 I/O 规划边界', () => {
  it('四路 WISE 通用输入不重复，光照保持未分配', () => {
    const assigned = wise4012ExampleMappings.filter((item) => item.channelType === 'analog-input');
    const channels = assigned.map((item) => item.channelIndex);
    expect(channels).toHaveLength(4);
    expect(new Set(channels).size).toBe(4);
    expect(channels.every((channel) => channel !== undefined && channel >= 0 && channel < 4)).toBe(true);
    expect(wise4012ExampleMappings.find((item) => item.logicalKey === 'light')).toMatchObject({ channelType: 'unassigned', enabled: false });
    expect(wise4012ExampleMappings.find((item) => item.logicalKey === 'light')?.channelIndex).toBeUndefined();
  });

  it('ADAM 双向遮阳独占两路输出，保留 DO5 且输入不超出 12 路', () => {
    const outputs = adam6050OutputExampleMappings.flatMap((item) => item.outputChannel === undefined ? [item.extendChannel, item.retractChannel] : [item.outputChannel]);
    expect(outputs).toHaveLength(5);
    expect(new Set(outputs).size).toBe(5);
    expect(outputs.every((channel) => channel !== undefined && channel >= 0 && channel < 6)).toBe(true);
    expect(outputs).not.toContain(5);
    const inputs = adam6050InputExampleMappings.map((item) => item.inputChannel);
    expect(new Set(inputs).size).toBe(inputs.length);
    expect(inputs.every((channel) => channel !== undefined && channel >= 0 && channel < 12)).toBe(true);
    expect(adam6050OutputExampleMappings.find((item) => item.logicalDevice === 'shade')?.interlockGroup).toBe('shade-motion');
  });

  it('所有规划映射保持禁用，避免把示例当成已确认接线', () => {
    expect([...wise4012ExampleMappings, ...adam6050InputExampleMappings, ...adam6050OutputExampleMappings].every((item) => !item.enabled)).toBe(true);
  });
});
