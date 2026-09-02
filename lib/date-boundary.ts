// 台北時區的日界換算 —— 單一事實來源
//
// 系統裡的「活動日」「結算區間」都是台北日曆日，但資料庫的 created_at 是 timestamptz。
// `new Date('YYYY-MM-DD')` 在 UTC 00:00 解析，等於台北 08:00，直接拿來比對會讓整個
// 時間窗往後偏八小時：漏掉起始日凌晨的紀錄，又多收結束日隔天凌晨的紀錄。
//
// 這個偏差在 /api/settlement/calculate 真實發生過（v1.4 只修對了「嚴格小於隔日」的形狀，
// 時區沒有一起修），因此把換算集中在這裡，避免各處各寫一份。

const TAIPEI_OFFSET = '+08:00'

/**
 * 取台北時區某日 00:00 的時間戳（毫秒）。
 *
 * @param dateStr 'YYYY-MM-DD'；容許傳入完整 ISO 字串，只取前十碼
 * @param dayOffset 0 = 當日 00:00（區間起始界）；1 = 隔日 00:00（區間結束界，搭配嚴格小於）
 * @returns 毫秒時間戳；日期無效時回傳 null
 */
export function taipeiDayBoundary(dateStr: string, dayOffset: number): number | null {
  const day = String(dateStr).slice(0, 10)
  const d = new Date(`${day}T00:00:00${TAIPEI_OFFSET}`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return d.getTime()
}

/**
 * 取台北時區「某日隔天 00:00」的 ISO 字串，供資料庫查詢的嚴格小於上界使用。
 * 用於「活動日（含當天）以前」這類語意：`created_at < taipeiDayAfter(eventDate)`。
 */
export function taipeiDayAfter(dateStr: string): string {
  const ts = taipeiDayBoundary(dateStr, 1)
  if (ts === null) throw new Error(`無效的日期字串：${dateStr}`)
  return new Date(ts).toISOString()
}
