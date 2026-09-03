import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

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
