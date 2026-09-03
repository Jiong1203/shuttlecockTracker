// 催繳訊息草稿
//
// 刻意只產生「可轉貼的文字」，不做自動推播：催繳要由負責人決定何時發、發給誰，
// 系統自動發送容易造成困擾。作法與 lib/line.ts 的 buildOrderDraftLineText 一致。

export interface UnpaidAttendee {
  display_name: string
  fee: number | string
  paid: boolean
  is_free: boolean
}

export interface ReminderContext {
  eventDate: string
  venueName?: string | null
}

const money = (n: number) => `$${n.toLocaleString()}`

/**
 * 產生催繳訊息。回傳 null 表示沒有需要催繳的對象。
 */
export function buildPaymentReminderText(
  attendees: UnpaidAttendee[],
  ctx: ReminderContext
): string | null {
  const unpaid = attendees.filter(a => !a.is_free && !a.paid)
  if (unpaid.length === 0) return null

  const total = unpaid.reduce((sum, a) => sum + Number(a.fee), 0)
  const where = ctx.venueName ? `${ctx.venueName} ` : ''

  // 同名同金額的人合併顯示會造成誤會，因此逐筆列出，維持原始順序
  const lines = unpaid.map(a => `・${a.display_name}　${money(Number(a.fee))}`)

  return (
    `🏸 ${ctx.eventDate} ${where}球費提醒\n\n` +
    `以下夥伴的球費還沒收到，再麻煩協助確認：\n\n` +
    lines.join('\n') +
    `\n\n合計 ${money(total)}，共 ${unpaid.length} 位。收到後我會在系統標記，謝謝大家！🙏`
  )
}
