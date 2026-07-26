export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export function csvCell(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
export function exportCsv(filename: string, headers: string[], rows: unknown[][]) {
  downloadText(filename, `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
}
