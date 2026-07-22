// 以 LINE 官方帳號（Messaging API）推播低庫存通知
// 環境變數：LINE_CHANNEL_ACCESS_TOKEN（push/reply 用）、LINE_CHANNEL_SECRET（webhook 驗簽用，見 webhook route）
// 注意：LINE Notify 已於 2025/3/31 停用，此處一律走 Messaging API。

const PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push'
const REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply'

function getChannelAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    throw new Error('LINE 設定缺失：請設定 LINE_CHANNEL_ACCESS_TOKEN')
  }
  return token
}

// 共用送出邏輯：非 2xx 時把 LINE 回傳內容併入錯誤訊息後 throw，交由呼叫端決定是否記錄
async function callLineApi(endpoint: string, body: unknown): Promise<void> {
  const token = getChannelAccessToken()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LINE API 失敗 (${res.status}): ${detail}`)
  }
}

interface PushParams {
  to: string // 綁定的 LINE userId
  text: string | string[] // 單則或多則（LINE 一次 push 最多 5 則）
}

// 主動推播純文字（消耗官方帳號的推播額度）
export async function pushLineMessage({ to, text }: PushParams): Promise<void> {
  const texts = Array.isArray(text) ? text : [text]
  await callLineApi(PUSH_ENDPOINT, {
    to,
    messages: texts.map((t) => ({ type: 'text', text: t })),
  })
}

// 主動推播任意 LINE 訊息物件（例如 Flex）
export async function pushLineMessages({ to, messages }: { to: string; messages: unknown[] }): Promise<void> {
  await callLineApi(PUSH_ENDPOINT, { to, messages })
}

interface ReplyParams {
  replyToken: string
  text: string
}

// 回覆使用者訊息（用 webhook 帶來的 replyToken，免費、不計推播額度）
export async function replyLineMessage({ replyToken, text }: ReplyParams): Promise<void> {
  await callLineApi(REPLY_ENDPOINT, {
    replyToken,
    messages: [{ type: 'text', text }],
  })
}

interface LowStockItem {
  brand: string
  name: string
  currentStock: number
  threshold: number
}

// 組低庫存通知的純文字內容（LINE 不支援 HTML，故用 emoji + 換行）
export function buildLowStockLineText(groupName: string, items: LowStockItem[]): string {
  const lines = items.map((it) => {
    const stockLabel = it.currentStock <= 0 ? '缺貨中' : `${it.currentStock} 桶`
    return `・${it.brand} ${it.name}：${stockLabel}（門檻 ${it.threshold} 桶）`
  })

  return (
    `🏸 低庫存提醒\n` +
    `球團「${groupName}」以下球種庫存已低於安全門檻，建議盡快補貨：\n\n` +
    lines.join('\n')
  )
}

// 組低庫存 Flex 訊息：內容為文字提醒，底部帶「產生下訂訊息」按鈕。
// 按鈕為 postback（點擊後由 webhook 免費 reply 產生下訂草稿，不佔用主動推播額度）。
export function buildLowStockFlexMessage(groupName: string, items: LowStockItem[], groupId: string) {
  const text = buildLowStockLineText(groupName, items)
  return {
    type: 'flex',
    altText: '🏸 低庫存提醒',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text, wrap: true, size: 'sm', color: '#333333' }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            action: {
              type: 'postback',
              label: '📝 產生下訂訊息',
              data: `action=order_draft&gid=${groupId}`,
              displayText: '產生下訂訊息',
            },
          },
        ],
      },
    },
  }
}

// 組「可轉傳給廠商」的下訂訊息草稿：內容乾淨（不含門檻等內部資訊），數量留空由使用者發送前自行填寫
export function buildOrderDraftLineText(items: LowStockItem[]): string {
  const lines = items.map((it) => `・${it.brand} ${it.name} × ___ 箱`)

  return (
    `您好，想向貴店補貨以下羽球（數量再麻煩確認）：\n\n` +
    lines.join('\n') +
    `\n\n再請協助報價與安排出貨，謝謝！🙏`
  )
}
