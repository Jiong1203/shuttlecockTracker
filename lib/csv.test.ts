import { describe, it, expect } from 'vitest'
import { toCsv, asText } from './csv'

// 匯出的檔案會被丟進 Excel 對帳，所以守的是「打開來不會壞」：
// 中文不亂碼、含逗號的欄位不會被切成兩欄。

const BOM = '﻿'
const body = (csv: string) => csv.slice(BOM.length)

describe('toCsv — Excel 相容性', () => {
  it('開頭帶 BOM，否則 Excel 開啟中文會亂碼', () => {
    expect(toCsv(['姓名'], [['阿呆']]).startsWith(BOM)).toBe(true)
  })

  it('使用 CRLF 換行', () => {
    expect(body(toCsv(['a'], [['b']]))).toBe('a\r\nb')
  })
})

describe('toCsv — 逸出規則', () => {
  it('含逗號的欄位以雙引號包住，不會被切成兩欄', () => {
    expect(body(toCsv(['備註'], [['大同運動中心, A 場']])))
      .toBe('備註\r\n"大同運動中心, A 場"')
  })

  it('欄位內的雙引號成對跳脫', () => {
    expect(body(toCsv(['名稱'], [['他說「"好"」']])))
      .toBe('名稱\r\n"他說「""好""」"')
  })

  it('含換行的欄位包在引號內', () => {
    expect(body(toCsv(['備註'], [['第一行\n第二行']])))
      .toBe('備註\r\n"第一行\n第二行"')
  })

  it('一般欄位不加多餘引號', () => {
    expect(body(toCsv(['球種'], [['YONEX AS-9']]))).toBe('球種\r\nYONEX AS-9')
  })
})

describe('toCsv — 空值與型別', () => {
  it('null 與 undefined 輸出為空字串，不是字面的 null', () => {
    expect(body(toCsv(['a', 'b'], [[null, undefined]]))).toBe('a,b\r\n,')
  })

  it('數字與零正常輸出', () => {
    expect(body(toCsv(['數量', '金額'], [[0, 1500]]))).toBe('數量,金額\r\n0,1500')
  })

  it('沒有資料列時只輸出表頭', () => {
    expect(body(toCsv(['姓名', '金額'], []))).toBe('姓名,金額')
  })
})

describe('asText — 強制文字型別', () => {
  // Excel 對「數值或日期」欄寬不足時顯示 #####，對文字則只會截斷。
  // CSV 無法攜帶欄寬資訊，所以改型別是唯一的解法。
  it('包成 ="..." 讓試算表不再猜型別', () => {
    expect(body(toCsv(['球種'], [[asText('5')]]))).toBe('球種\r\n"=""5"""')
  })

  it('日期時間不再被判定為日期', () => {
    expect(body(toCsv(['進貨日期'], [[asText('2026-09-04 08:00')]])))
      .toBe('進貨日期\r\n"=""2026-09-04 08:00"""')
  })

  it('同一欄的 5 與 5+ 都輸出為文字，對齊才會一致', () => {
    const csv = body(toCsv(['球種'], [[asText('5')], [asText('5+')]]))
    expect(csv).toBe('球種\r\n"=""5"""\r\n"=""5+"""')
  })

  it('文字內含引號時兩層跳脫都正確', () => {
    // Excel 公式層 a"b → a""b；CSV 層再把每個引號加倍
    expect(body(toCsv(['名稱'], [[asText('a"b')]])))
      .toBe('名稱\r\n"=""a""""b"""')
  })

  it('空值與 null 不會產生壞掉的公式', () => {
    expect(body(toCsv(['a', 'b'], [[asText(''), asText(null)]])))
      .toBe('a,b\r\n"=""""","="""""')
  })

  it('未標記的值維持原本行為，數字仍是數字', () => {
    expect(body(toCsv(['數量'], [[251]]))).toBe('數量\r\n251')
  })
})
