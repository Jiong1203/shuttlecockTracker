'use server'

export async function logLogin(email: string) {
  // 記錄登入成功事件，此 Log 會出現在 Vercel 後台
  console.log(`[Login Success] User: ${email} at ${new Date().toISOString()}`);
}
