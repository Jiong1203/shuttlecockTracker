import { describe, it, expect } from 'vitest'
import { taipeiDayBoundary, taipeiDayAfter } from './date-boundary'

// 這裡守的是一個真實發生過的錯誤：用 UTC 解析日期字串，會讓整個時間窗往後偏八小時。
// 每個案例都以「台北時間的某一刻是否落在區間內」來描述，因為那才是使用者的認知。

const taipei = (iso: string) => new Date(`${iso}+08:00`).getTime()

describe('taipeiDayBoundary', () => {
  it('起始界落在台北當日午夜，而非 UTC 午夜', () => {
    const start = taipeiDayBoundary('2026-09-01', 0)!
    expect(new Date(start).toISOString()).toBe('2026-08-31T16:00:00.000Z')
    expect(start).toBe(taipei('2026-09-01T00:00:00'))
  })

  it('結束界落在台北隔日午夜', () => {
    const end = taipeiDayBoundary('2026-09-02', 1)!
    expect(new Date(end).toISOString()).toBe('2026-09-02T16:00:00.000Z')
    expect(end).toBe(taipei('2026-09-03T00:00:00'))
  })

  it('容許傳入完整 ISO 字串，只取日期部分', () => {
    expect(taipeiDayBoundary('2026-09-01T13:45:00Z', 0))
      .toBe(taipeiDayBoundary('2026-09-01', 0))
  })

  it('無效日期回傳 null 而非拋錯', () => {
    expect(taipeiDayBoundary('not-a-date', 0)).toBeNull()
    expect(taipeiDayBoundary('', 0)).toBeNull()
  })

  it('跨月與跨年時正確進位', () => {
    expect(taipeiDayBoundary('2026-09-30', 1)).toBe(taipei('2026-10-01T00:00:00'))
    expect(taipeiDayBoundary('2026-12-31', 1)).toBe(taipei('2027-01-01T00:00:00'))
  })
})

describe('結算區間的四個臨界時刻', () => {
  // 區間：2026-09-01 至 2026-09-02（台北日曆日）
  const start = taipeiDayBoundary('2026-09-01', 0)!
  const end = taipeiDayBoundary('2026-09-02', 1)!
  const inRange = (taipeiTime: string) => {
    const t = taipei(taipeiTime)
    return t >= start && t < end
  }

  it('起始日凌晨的紀錄要納入（舊的 UTC 寫法會漏掉）', () => {
    expect(inRange('2026-09-01T00:30:00')).toBe(true)
  })

  it('起始日前一晚的紀錄要排除', () => {
    expect(inRange('2026-08-31T23:30:00')).toBe(false)
  })

  it('結束日深夜的紀錄要納入', () => {
    expect(inRange('2026-09-02T23:30:00')).toBe(true)
  })

  it('結束日隔天凌晨的紀錄要排除（舊的 UTC 寫法會誤收）', () => {
    expect(inRange('2026-09-03T00:30:00')).toBe(false)
  })

  it('恰好落在起始界的瞬間要納入，落在結束界的瞬間要排除', () => {
    expect(inRange('2026-09-01T00:00:00')).toBe(true)
    expect(inRange('2026-09-03T00:00:00')).toBe(false)
  })
})

describe('taipeiDayAfter', () => {
  it('回傳活動日隔天台北午夜的 ISO 字串', () => {
    expect(taipeiDayAfter('2026-09-02')).toBe('2026-09-02T16:00:00.000Z')
  })

  // 這正是修掉的舊寫法：`${date}T23:59:59+00:00` 實際落在台北隔天 07:59，
  // 會把隔天凌晨的領用誤算成活動當日之前就已用掉。
  it('不等於舊的 UTC 23:59:59 寫法', () => {
    const wrong = new Date('2026-09-02T23:59:59+00:00').toISOString()
    expect(taipeiDayAfter('2026-09-02')).not.toBe(wrong)
    expect(new Date(taipeiDayAfter('2026-09-02')).getTime())
      .toBeLessThan(new Date(wrong).getTime())
  })

  it('日期無效時拋出可辨識的錯誤', () => {
    expect(() => taipeiDayAfter('bad')).toThrow('無效的日期字串')
  })
})
