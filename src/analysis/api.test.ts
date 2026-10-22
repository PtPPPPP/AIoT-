import { isChart, isSample, isStats } from './api';
import { createDataServiceUrl } from '../config/dataServiceConfig';

describe('数据服务边界', () => {
  it('未配置和非法 URL 不启用服务', () => {
    expect(createDataServiceUrl()).toBeUndefined();
    expect(createDataServiceUrl('ftp://example.invalid')).toBeUndefined();
    expect(createDataServiceUrl('http://user:pass@example.invalid')).toBeUndefined();
    expect(createDataServiceUrl('http://127.0.0.1:8090/')).toBe('http://127.0.0.1:8090');
  });
  it('不接受缺少质量、来源、单位和时间的图表数值数组', () => {
    expect(isSample({ key: 'soilMoisture', value: 40 })).toBe(false);
    expect(isChart({ items: [30, 40, 50] })).toBe(false);
    expect(isStats({ metric: 'soilMoisture', average: 40 })).toBe(false);
  });
});
