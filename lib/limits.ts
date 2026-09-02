// 列表查詢的回傳上限。
//
// API 與前端共用同一組常數：前端據此判斷資料是否已被截斷並顯示提示，
// 避免使用者誤以為更早的紀錄不存在。分頁尚未實作，見 docs/IMPROVEMENT-LOG.md 的 C3。
//
// 註：Next.js 的 route.ts 只允許匯出約定名稱（GET/POST/dynamic 等），
// 因此常數必須放在這裡，不能定義在 route 檔案內。

export const PICKUP_HISTORY_LIMIT = 100
export const RESTOCK_HISTORY_LIMIT = 500
