import { describe, it, expect } from 'vitest'
import { buildPaymentReminderText } from './payment-reminder'

// 這段文字會被原樣貼進 LINE 群組給隊員看，所以名單與金額都不能出錯：
// 免費者不該被點名，已繳的人不該再被催。

const 出席 = (display_name: string, fee: number, paid: boolean, is_free = false) =>
  ({ display_name, fee, paid, is_free })

const ctx = { eventDate: '2026-09-02', venueName: '大同運動中心' }

describe('buildPaymentReminderText — 對象篩選', () => {
  it('全員繳清時回傳 null，不產生訊息', () => {
    expect(buildPaymentReminderText([出席('阿呆', 200, true)], ctx)).toBeNull()
  })

  it('沒有出席者時回傳 null', () => {
    expect(buildPaymentReminderText([], ctx)).toBeNull()
  })

  it('免費者不列入催繳，即使標記未繳', () => {
    expect(buildPaymentReminderText([出席('隊長', 0, false, true)], ctx)).toBeNull()
  })

  it('只列出未繳且非免費的人', () => {
    const text = buildPaymentReminderText([
      出席('阿呆', 200, false),
      出席('小明', 200, true),
      出席('隊長', 200, false, true),
    ], ctx)!
    expect(text).toContain('阿呆')
    expect(text).not.toContain('小明')
    expect(text).not.toContain('隊長')
  })

  it('維持出席名單的原始順序', () => {
    const text = buildPaymentReminderText([
      出席('丙', 100, false),
      出席('甲', 100, false),
      出席('乙', 100, false),
    ], ctx)!
    expect(text.indexOf('丙')).toBeLessThan(text.indexOf('甲'))
    expect(text.indexOf('甲')).toBeLessThan(text.indexOf('乙'))
  })
})

describe('buildPaymentReminderText — 金額與內容', () => {
  it('合計為未繳者金額總和，不含已繳與免費者', () => {
    const text = buildPaymentReminderText([
      出席('阿呆', 200, false),
      出席('小華', 150, false),
      出席('小明', 500, true),
      出席('隊長', 300, false, true),
    ], ctx)!
    expect(text).toContain('合計 $350')
    expect(text).toContain('共 2 位')
  })

  it('金額以千分位顯示', () => {
    const text = buildPaymentReminderText([出席('阿呆', 1500, false)], ctx)!
    expect(text).toContain('$1,500')
  })

  it('接受字串型別的金額（資料庫 numeric 會以字串回傳）', () => {
    const text = buildPaymentReminderText(
      [{ display_name: '阿呆', fee: '200', paid: false, is_free: false }],
      ctx
    )!
    expect(text).toContain('合計 $200')
  })

  it('包含活動日期與場地', () => {
    const text = buildPaymentReminderText([出席('阿呆', 200, false)], ctx)!
    expect(text).toContain('2026-09-02')
    expect(text).toContain('大同運動中心')
  })

  it('沒有場地時不留下多餘空格', () => {
    const text = buildPaymentReminderText([出席('阿呆', 200, false)], { eventDate: '2026-09-02' })!
    expect(text).toContain('2026-09-02 球費提醒')
  })
})
