// LINE 群組報名訊息解析器
//
// 輸入是使用者從 LINE 直接複製的任意文字，格式不受控（PRD 第 4.3 節列了六種變體）。
// 這裡刻意保持為零依賴的純函式，才能單獨測試——見 lib/line-parser.test.ts。

export interface ParsedLineMessage {
  /** 'YYYY-MM-DD'，未解析到則為 undefined */
  eventDate?: string
  venueName?: string
  /** 小時數，取到小數一位 */
  hours?: number
  /** 依訊息中的出現順序排列 */
  names: string[]
  /** 每人費用 */
  fee?: number
}


export function parseLineMessage(text: string): ParsedLineMessage {
  // 僅在「候補」作為名單區段標題時截斷（候補 自成一行，可含數字/冒號後接換行）；
  // 不誤砍如「報名 16/16｜候補 0」這類行內統計數字，否則會把後面整份名單一起吃掉。
  const mainText = text.split(/候補\d?[：:]?[ \t]*\n[\s\S]*|——+|🈵/)[0]

  let eventDate: string | undefined
  const fullDate = mainText.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/)
  if (fullDate) {
    eventDate = `${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`
  } else {
    const shortDate = mainText.match(/\b(\d{1,2})[\/.](\d{1,2})\b/)
    if (shortDate) {
      const year = new Date().getFullYear()
      eventDate = `${year}-${shortDate[1].padStart(2, '0')}-${shortDate[2].padStart(2, '0')}`
    }
  }

  let hours: number | undefined
  const fullTime = mainText.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/)
  if (fullTime) {
    const start = parseInt(fullTime[1]) * 60 + parseInt(fullTime[2])
    const end = parseInt(fullTime[3]) * 60 + parseInt(fullTime[4])
    if (end > start) hours = Math.round((end - start) / 60 * 10) / 10
  } else {
    const simple = mainText.match(/\b([01]?\d|2[0-3])\s*-\s*([01]?\d|2[0-3])\b/)
    if (simple) {
      const s = parseInt(simple[1]), e = parseInt(simple[2])
      if (e > s && s >= 6 && e <= 24) hours = e - s
    }
  }

  let venueName: string | undefined
  const venueMatch = mainText.match(/(?:場館|場地|地點)[：:]\s*([^\n]+)/)
  if (venueMatch) venueName = venueMatch[1].trim()

  // 每人費用（如「費用：200 元」）
  let fee: number | undefined
  const feeMatch = mainText.match(/費用[：:]\s*\$?(\d+)/)
  if (feeMatch) fee = parseInt(feeMatch[1], 10)

  const names: string[] = []
  const nameRe = /^\d+[.．、][ \t]*(.+)/gm
  let m: RegExpExecArray | null
  while ((m = nameRe.exec(mainText)) !== null) {
    const n = m[1].trim()
    if (n) names.push(n)
  }
  return { eventDate, venueName, hours, names, fee }
}
