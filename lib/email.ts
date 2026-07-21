import nodemailer from 'nodemailer'

// 以專用 Gmail 帳號寄信（使用應用程式密碼，非登入密碼）
// 環境變數：GMAIL_USER、GMAIL_APP_PASSWORD
let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD

  if (!user || !pass) {
    throw new Error('寄信設定缺失：請設定 GMAIL_USER 與 GMAIL_APP_PASSWORD')
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // 465 走 SSL
      auth: { user, pass: pass.replace(/\s+/g, '') }, // App Password 常帶空格，寄送前移除
    })
  }

  return cachedTransporter
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const transporter = getTransporter()
  const from = process.env.GMAIL_USER

  await transporter.sendMail({
    from: `羽球庫存管家 <${from}>`,
    to,
    subject,
    html,
    text,
  })
}

interface LowStockItem {
  brand: string
  name: string
  currentStock: number
  threshold: number
}

// 依球種低庫存清單組出通知信 HTML
export function buildLowStockEmail(groupName: string, items: LowStockItem[]): { subject: string; html: string; text: string } {
  const subject = `【羽球庫存管家】${groupName} 有 ${items.length} 項球種庫存偏低`

  const rows = items
    .map((it) => {
      const isOut = it.currentStock <= 0
      const stockLabel = isOut ? '缺貨中' : `${it.currentStock} 桶`
      const color = isOut ? '#dc2626' : '#d97706'
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${it.brand} ${it.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${color};font-weight:600;">${stockLabel}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${it.threshold} 桶</td>
        </tr>`
    })
    .join('')

  const html = `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;color:#222;">
    <h2 style="font-size:18px;margin:0 0 4px;">🏸 低庫存提醒</h2>
    <p style="color:#555;margin:0 0 16px;">球團「<strong>${groupName}</strong>」以下球種庫存已低於設定的安全門檻，建議盡快補貨：</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="text-align:left;color:#888;font-size:12px;">
          <th style="padding:8px 12px;border-bottom:2px solid #eee;">球種</th>
          <th style="padding:8px 12px;border-bottom:2px solid #eee;">目前庫存</th>
          <th style="padding:8px 12px;border-bottom:2px solid #eee;">安全門檻</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#999;font-size:12px;margin-top:24px;">此信由羽球庫存管家系統自動發送，請勿直接回覆。</p>
  </div>`

  const text =
    `【羽球庫存管家】低庫存提醒\n球團：${groupName}\n\n` +
    items.map((it) => `- ${it.brand} ${it.name}：目前 ${it.currentStock <= 0 ? '缺貨中' : it.currentStock + ' 桶'}（門檻 ${it.threshold} 桶）`).join('\n') +
    `\n\n此信由系統自動發送，請勿回覆。`

  return { subject, html, text }
}
