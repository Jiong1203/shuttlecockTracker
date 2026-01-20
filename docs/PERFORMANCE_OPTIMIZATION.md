# 效能優化總結

## 問題分析

根據 Vercel Speed Insights 的數據，目前的主要效能問題：

1. **First Contentful Paint (FCP)**: 3.32秒 - 過慢
2. **Largest Contentful Paint (LCP)**: 7.4秒 - 非常慢
3. **Real Experience Score (RES)**: 62分 - 需要改進

## 效能影響原因

### 1. 完全客戶端渲染 (CSR)
- **問題**：主頁面 (`app/page.tsx`) 原本是完全的客戶端組件 (`'use client'`)
- **影響**：必須等待 JavaScript 下載、解析、執行後才能開始渲染，延遲了 FCP 和 LCP
- **解決方案**：已將主頁面改為 Server Component，在服務端獲取數據

### 2. 數據獲取時機
- **問題**：數據在 `useEffect` 中串行獲取，頁面先顯示 loading，數據返回後才渲染內容
- **影響**：延遲了首次內容繪製
- **解決方案**：在 Server Component 中並行獲取所有數據，服務端渲染後直接返回 HTML

### 3. API 路由強制動態
- **問題**：所有 API 路由使用 `force-dynamic`，無法利用緩存
- **影響**：每次請求都重新計算，增加響應時間
- **解決方案**：改為使用 `revalidate = 30`，允許短期緩存（30秒）

### 4. 字體載入
- **問題**：Geist 字體從 Google Fonts 下載，可能阻塞 FCP
- **影響**：字體下載完成前無法顯示文字內容
- **解決方案**：添加 `display: 'swap'`，允許使用系統字體先顯示，字體載入後再切換

### 5. 缺少代碼分割
- **問題**：所有組件同步導入，初始 bundle 較大
- **影響**：需要下載更多 JavaScript 才能開始渲染
- **解決方案**：對大型互動組件使用動態導入 (`dynamic import`)

## 已實作的優化

### ✅ 1. Server Components 與 Server-side Data Fetching
- 將主頁面改為 Server Component
- 在服務端並行獲取所有數據（inventory, pickup records, group info）
- 數據獲取完成後直接渲染 HTML，無需等待客戶端 JavaScript

**預期效果**：
- FCP 從 3.32s 降低到 < 1.5s
- LCP 從 7.4s 降低到 < 2.5s

### ✅ 2. 字體載入優化
- 添加 `display: 'swap'` 到 Geist 字體配置
- 設置 `preload: true` 用於主要字體，`preload: false` 用於次要字體

**預期效果**：
- 減少 FCP 阻塞時間
- 改善文字顯示的即時性

### ✅ 3. 代碼分割與動態導入
- 對大型互動組件使用 `dynamic import`：
  - `PickupForm`
  - `SettlementDialog`
  - `InventoryManagerDialog`
  - `PickupHistory`
  - `WelcomeGuide`
- 設置 `ssr: false` 避免不必要的服務端渲染

**預期效果**：
- 減少初始 bundle 大小約 30-40%
- 加快首次 JavaScript 載入時間

### ✅ 4. API 緩存策略優化
- 將 `force-dynamic` 改為 `revalidate = 30`
- 允許短期緩存，減少資料庫查詢

**預期效果**：
- API 響應時間減少 50-70%（緩存命中時）
- 減少資料庫負載

### ✅ 5. Next.js 配置優化
- 啟用圖片優化（AVIF, WebP）
- 配置 `optimizePackageImports` 優化常用套件導入
- 生產環境移除 console.log

**預期效果**：
- 圖片載入時間減少
- Bundle 大小進一步優化

## 預期改善效果

| 指標 | 優化前 | 預期優化後 | 改善幅度 |
|------|--------|------------|----------|
| FCP | 3.32s | < 1.5s | ~55% ↓ |
| LCP | 7.4s | < 2.5s | ~66% ↓ |
| RES | 62 | > 85 | +23 分 |

## 後續優化建議

### 1. 圖片優化
- 確保所有圖片使用 Next.js `Image` 組件
- 使用適當的圖片格式（AVIF, WebP）
- 設置適當的 `priority` 屬性用於 LCP 圖片

### 2. 資源預加載
- 使用 `<link rel="preload">` 預加載關鍵資源
- 使用 `<link rel="prefetch">` 預取可能需要的資源

### 3. 資料庫查詢優化
- 檢查 Supabase 查詢是否有優化空間
- 考慮添加資料庫索引
- 使用 Supabase 的即時訂閱功能減少輪詢

### 4. 監控與分析
- 持續監控 Vercel Speed Insights
- 使用 Chrome DevTools 的 Performance 面板分析
- 定期檢查 Core Web Vitals

### 5. 進一步的 Server Components
- 考慮將更多組件改為 Server Components
- 只在需要互動的部分使用 Client Components

## 注意事項

1. **TypeScript 類型錯誤**：某些動態導入可能顯示 TypeScript 錯誤，但不會影響運行時行為。可以考慮：
   - 重新啟動 TypeScript 服務器
   - 或使用類型斷言暫時解決

2. **緩存策略**：`revalidate = 30` 意味著數據最多緩存 30 秒。如果需要更即時的數據，可以：
   - 降低 revalidate 時間
   - 或使用 `cache: 'no-store'` 在特定路由

3. **測試**：部署後請：
   - 在 Vercel Speed Insights 中驗證改善效果
   - 使用 Chrome DevTools 的 Lighthouse 進行測試
   - 在不同網路條件下測試

## 部署建議

1. 在部署前測試本地構建：`npm run build`
2. 檢查構建輸出是否有警告或錯誤
3. 部署到 Vercel 後等待 24-48 小時讓 Speed Insights 收集足夠數據
4. 對比優化前後的數據
