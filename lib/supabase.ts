import { createClient } from "@supabase/supabase-js";

// 使用佔位符防止 Build 階段報錯，真正的連線資訊將在 Runtime 從環境變數讀取
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("Supabase URL or Anon Key is missing. Live data will not be accessible.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


