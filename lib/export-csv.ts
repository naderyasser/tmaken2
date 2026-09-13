/**
 * Export data rows as a CSV file download.
 * Automatically adds BOM for Excel Arabic compatibility.
 */
export function exportToCsv(
    filename: string,
    headers: string[],
    rows: (string | number | undefined | null)[][],
) {
    const csvRows = [headers, ...rows].map(r =>
        r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob(['\uFEFF' + csvRows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
