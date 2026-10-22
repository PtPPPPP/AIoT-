export function createDataServiceUrl(value?: string) {
  if (!value) return undefined;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash ? url.toString().replace(/\/$/, '') : undefined; }
  catch { return undefined; }
}
export const dataServiceUrl = createDataServiceUrl(import.meta.env.VITE_DATA_SERVICE_URL);
