import { describe, it, expect } from 'vitest'
import { calcEventFinance } from './event-finance'

// 這裡守的是「應收 vs 實收」的區分：場租在活動建立當下就成立，收費卻是陸續入帳的。
// 若利潤只看實收，一場還沒收錢的活動會顯示成大額虧損。

const event = { court_count: 2, hours: 2, hourly_rate: 500, shuttle_cost: 300 }
// 場租 = 2 × 2 × 500 = 2000

const 出席 = (fee: number, paid: boolean, is_free = false) => ({ fee, paid, is_free })

describe('calcEventFinance — 場租', () => {
  it('場租為場地數乘時數乘每小時單價', () => {
    expect(calcEventFinance([], event).venue_cost).toBe(2000)
  })

  it('接受字串型別的金額（資料庫 numeric 會以字串回傳）', () => {
    const r = calcEventFinance(
      [{ fee: '200', paid: true, is_free: false }],
      { ...event, shuttle_cost: '300' }
    )
    expect(r.total_paid).toBe(200)
    expect(r.profit).toBe(200 - 300 - 2000)
  })
})

describe('calcEventFinance — 應收與實收', () => {
  const attendees = [
    出席(200, true),
    出席(200, true),
    出席(200, false),
    出席(200, false),
    出席(0, false, true),   // 免費的負責人
  ]

  it('應收計入所有非免費者，不論是否已繳', () => {
    expect(calcEventFinance(attendees, event).total_due).toBe(800)
  })

  it('實收只計入已繳者', () => {
    expect(calcEventFinance(attendees, event).total_paid).toBe(400)
  })

  it('未收為應收減實收', () => {
    expect(calcEventFinance(attendees, event).total_unpaid).toBe(400)
  })

  it('免費者不列入應繳人數，也不影響未繳人數', () => {
    const r = calcEventFinance(attendees, event)
    expect(r.payer_count).toBe(4)
    expect(r.unpaid_count).toBe(2)
  })

  it('免費者即使標記未繳也不計入未收', () => {
    const r = calcEventFinance([出席(500, false, true)], event)
    expect(r.total_due).toBe(0)
    expect(r.total_unpaid).toBe(0)
    expect(r.unpaid_count).toBe(0)
  })
})

describe('calcEventFinance — 利潤基準', () => {
  it('主利潤以應收為基準', () => {
    const r = calcEventFinance([出席(1500, false), 出席(1500, false)], event)
    // 應收 3000 − 球費 300 − 場租 2000 = 700
    expect(r.profit).toBe(700)
  })

  it('實收利潤以實收為基準', () => {
    const r = calcEventFinance([出席(1500, true), 出席(1500, false)], event)
    expect(r.profit).toBe(700)        // 應收 3000
    expect(r.profit_paid).toBe(-800)  // 實收 1500 − 300 − 2000
  })

  // 這是這次修掉的問題本身：活動剛建立、沒有人繳費時，
  // 主利潤不該顯示成虧損。
  it('全員未繳時，主利潤仍反映真實的預期損益', () => {
    const r = calcEventFinance([出席(1500, false), 出席(1500, false)], event)
    expect(r.profit).toBeGreaterThan(0)
    expect(r.profit_paid).toBe(-2300)
    expect(r.unpaid_count).toBe(2)
  })

  it('沒有任何出席者時，利潤等於負的成本合計', () => {
    const r = calcEventFinance([], event)
    expect(r.profit).toBe(-2300)
    expect(r.total_due).toBe(0)
    expect(r.payer_count).toBe(0)
  })
})

describe('calcEventFinance — 相容欄位', () => {
  it('total_revenue 維持舊語意，等同實收', () => {
    const r = calcEventFinance([出席(200, true), 出席(200, false)], event)
    expect(r.total_revenue).toBe(r.total_paid)
    expect(r.total_revenue).toBe(200)
  })
})
