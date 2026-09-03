// 金額與損益的顯示格式
//
// 顏色沿用台股慣例：正值紅、負值綠——與多數台灣使用者的直覺一致，
// 和西方財報的紅綠相反，改動前請先確認。

export const fmtMoney = (n: number) => `$${Math.abs(n).toLocaleString()}`

/** 損益的文字顏色（不含字重，由呼叫端自行決定） */
export const profitClass = (p: number) =>
  p > 0 ? 'text-red-500 dark:text-red-400' :
  p < 0 ? 'text-green-600 dark:text-green-500' :
  'text-muted-foreground'

/** 帶正負號的金額，例如 +$1,200 / -$800 */
export const profitLabel = (p: number) => `${p >= 0 ? '+' : '-'}${fmtMoney(p)}`
