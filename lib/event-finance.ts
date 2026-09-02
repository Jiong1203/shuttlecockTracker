// 活動財務計算 —— 單一事實來源
//
// 為什麼要區分「應收」與「實收」：
// 場租在活動建立當下就全額成立，但收費是陸續入帳的。若利潤只用實收計算，
// 一場剛建立、還沒人繳費的活動會顯示成大額虧損，而那正是負責人最常查看的時機。
// 因此主要利潤（profit）以應收為基準，實收版本（profit_paid）作為輔助資訊。

export interface AttendeeLike {
  fee: number | string
  paid: boolean
  is_free: boolean
}

export interface EventCostInput {
  court_count: number
  hours: number
  hourly_rate: number
  shuttle_cost: number | string
}

export interface EventFinance {
  /** 場租 = 場地數 × 時數 × 每小時場租 */
  venue_cost: number
  /** 應收：所有非免費出席者的應繳金額總和 */
  total_due: number
  /** 實收：已標記繳費且非免費者的金額總和 */
  total_paid: number
  /** 未收 = 應收 − 實收 */
  total_unpaid: number
  /** 尚未繳費的人數（不含免費者） */
  unpaid_count: number
  /** 應收人數（不含免費者） */
  payer_count: number
  /** 利潤（應收基準）= 應收 − 用球成本 − 場租 */
  profit: number
  /** 利潤（實收基準）= 實收 − 用球成本 − 場租 */
  profit_paid: number
  /**
   * @deprecated 語意等同 total_paid，僅為既有欄位相容而保留。新程式碼請用 total_paid。
   */
  total_revenue: number
}

export function calcEventFinance(attendees: AttendeeLike[], event: EventCostInput): EventFinance {
  const venueCost = Number(event.court_count) * Number(event.hours) * Number(event.hourly_rate)
  const shuttleCost = Number(event.shuttle_cost)

  const payers = attendees.filter(a => !a.is_free)
  const totalDue = payers.reduce((sum, a) => sum + Number(a.fee), 0)
  const totalPaid = payers.filter(a => a.paid).reduce((sum, a) => sum + Number(a.fee), 0)
  const unpaidCount = payers.filter(a => !a.paid).length

  return {
    venue_cost: venueCost,
    total_due: totalDue,
    total_paid: totalPaid,
    total_unpaid: totalDue - totalPaid,
    unpaid_count: unpaidCount,
    payer_count: payers.length,
    profit: totalDue - shuttleCost - venueCost,
    profit_paid: totalPaid - shuttleCost - venueCost,
    total_revenue: totalPaid,
  }
}
