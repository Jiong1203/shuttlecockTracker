// CSV 匯出
//
// 給的是「拿去對帳、交帳、貼進試算表」的檔案，因此格式以 Excel 相容為優先。

/** Excel 只認得帶 BOM 的 UTF-8，少了它中文會變亂碼。 */
const BOM = '﻿'

/**
 * 標記某個值必須以「文字」寫入，而非讓試算表自行判斷型別。
 *
 * 兩個實際踩到的問題都靠它解決：
 *
 * 1. 日期時間會被 Excel 判定為日期，欄寬不足時整格顯示成 `#####`。
 *    CSV 是純文字格式，**無法攜帶欄寬資訊**，所以改型別是唯一能避免 ##### 的辦法
 *    （文字欄位寬度不足只會截斷或溢出，不會變成 #####）。
 *
 * 2. 名稱剛好是數字時（例如球種「5」）會被當成數值靠右對齊，
 *    與同一欄的「5+」這類文字並排就參差不齊。
 */
class CsvText {
  constructor(readonly value: string) {}
}

export function asText(value: unknown): CsvText {
  return new CsvText(value == null ? '' : String(value))
}

function escapeCell(value: unknown): string {
  if (value == null) return ''

  // Excel / Google Sheets / LibreOffice 都以 ="..." 表示「這格是文字，不要再猜型別」。
  // 寫進 CSV 時整格要再包一層引號，內部的引號則加倍。
  if (value instanceof CsvText) {
    // 兩層跳脫：先讓引號在 Excel 公式裡合法，再讓整格在 CSV 裡合法
    const formula = '="' + value.value.replace(/"/g, '""') + '"'
    return '"' + formula.replace(/"/g, '""') + '"'
  }

  const s = String(value)
  // 逗號、雙引號、換行都必須包在引號內，內部的引號要成對跳脫
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
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
