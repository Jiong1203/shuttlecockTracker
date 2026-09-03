// CSV 匯出
//
// 給的是「拿去對帳、交帳、貼進試算表」的檔案，因此格式以 Excel 相容為優先。

/** Excel 只認得帶 BOM 的 UTF-8，少了它中文會變亂碼。 */
const BOM = '﻿'

function escapeCell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  // 逗號、雙引號、換行都必須包在引號內，內部的引號要成對跳脫
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return BOM + [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n')
}

/**
 * 觸發瀏覽器下載。檔名會自動補上日期，避免多次匯出互相覆蓋。
 */
export function downloadCsv(filenameBase: string, headers: string[], rows: unknown[][]) {
  const csv = toCsv(headers, rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const today = new Date()
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  a.href = url
  a.download = `${filenameBase}_${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
