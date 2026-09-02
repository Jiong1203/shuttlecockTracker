import { describe, it, expect } from 'vitest'
import { parseLineMessage } from './line-parser'

// 案例取自 docs/PRD-venue-session-module.md 第 4.3 節的格式對照表。
// 輸入是使用者從 LINE 直接複製的文字，格式不受控，因此以真實訊息樣態測試。

describe('parseLineMessage — 名單提取', () => {
  it('解析數字加點加空格的標準格式', () => {
    const { names } = parseLineMessage('1. 阿呆\n2. 小明\n3. 阿華')
    expect(names).toEqual(['阿呆', '小明', '阿華'])
  })

  it('解析數字後沒有空格的格式', () => {
    expect(parseLineMessage('1.晟\n2.霖').names).toEqual(['晟', '霖'])
  })

  it('容許多餘空白並去除前後空格', () => {
    expect(parseLineMessage('9.   馬戲團').names).toEqual(['馬戲團'])
  })

  it('保留名字後的括號備註，交由使用者自行編輯', () => {
    expect(parseLineMessage('14. 愛玉（可到10）').names).toEqual(['愛玉（可到10）'])
  })

  it('跳過只有編號沒有名字的空位', () => {
    expect(parseLineMessage('1. 阿呆\n16.\n17. 小華').names).toEqual(['阿呆', '小華'])
  })

  it('接受頓號與全形句點作為分隔', () => {
    expect(parseLineMessage('1、阿呆\n2．小明').names).toEqual(['阿呆', '小明'])
  })

  it('維持名單在訊息中的原始順序', () => {
    const { names } = parseLineMessage('3. 丙\n1. 甲\n2. 乙')
    expect(names).toEqual(['丙', '甲', '乙'])
  })
})

describe('parseLineMessage — 候補區段截斷', () => {
  it('候補自成一行時，其後名單不列入', () => {
    const { names } = parseLineMessage('1. 阿呆\n2. 小明\n候補\n1. 路人甲\n2. 路人乙')
    expect(names).toEqual(['阿呆', '小明'])
  })

  it('候補帶冒號或編號同樣截斷', () => {
    expect(parseLineMessage('1. 阿呆\n候補1:\n1. 路人').names).toEqual(['阿呆'])
    expect(parseLineMessage('1. 阿呆\n候補：\n1. 路人').names).toEqual(['阿呆'])
  })

  it('破折號分隔線之後不列入', () => {
    expect(parseLineMessage('1. 阿呆\n————\n1. 路人').names).toEqual(['阿呆'])
  })

  // 這是實務上踩過的坑：行內的「候補 0」是統計數字，不是區段標題。
  // 誤判會把後面整份名單一起吃掉。
  it('不把行內統計的「候補 0」誤判為區段標題', () => {
    const { names } = parseLineMessage('報名 16/16｜候補 0\n1. 阿呆\n2. 小明')
    expect(names).toEqual(['阿呆', '小明'])
  })
})

describe('parseLineMessage — 活動資訊', () => {
  it('解析完整日期的三種分隔符', () => {
    expect(parseLineMessage('2026/09/02 打球').eventDate).toBe('2026-09-02')
    expect(parseLineMessage('2026.09.02 打球').eventDate).toBe('2026-09-02')
    expect(parseLineMessage('2026-9-2 打球').eventDate).toBe('2026-09-02')
  })

  it('短日期補上當年年份並補零', () => {
    const year = new Date().getFullYear()
    expect(parseLineMessage('9/2 晚上打球').eventDate).toBe(`${year}-09-02`)
  })

  it('由起訖時間計算時數，支援半小時', () => {
    expect(parseLineMessage('19:00-21:00').hours).toBe(2)
    expect(parseLineMessage('19:00 ~ 21:30').hours).toBe(2.5)
  })

  it('支援只有整點的簡寫時間', () => {
    expect(parseLineMessage('今晚 19-22 打球').hours).toBe(3)
  })

  it('結束時間早於開始時間則不採用', () => {
    expect(parseLineMessage('21:00-19:00').hours).toBeUndefined()
  })

  it('解析場館與費用', () => {
    const r = parseLineMessage('場館：大同運動中心\n費用：200 元')
    expect(r.venueName).toBe('大同運動中心')
    expect(r.fee).toBe(200)
  })

  it('場地與地點是場館的同義關鍵字', () => {
    expect(parseLineMessage('場地: 中正國小').venueName).toBe('中正國小')
    expect(parseLineMessage('地點：北投國中').venueName).toBe('北投國中')
  })
})

describe('parseLineMessage — 邊界情況', () => {
  it('空字串不會拋錯', () => {
    const r = parseLineMessage('')
    expect(r.names).toEqual([])
    expect(r.eventDate).toBeUndefined()
  })

  it('完全無編號的訊息回傳空名單', () => {
    expect(parseLineMessage('今天不打球了').names).toEqual([])
  })

  it('完整的真實訊息一次解析所有欄位', () => {
    const msg = [
      '9/2 (二) 羽球',
      '場館：大同運動中心',
      '19:00-21:00',
      '費用：150',
      '報名 3/16｜候補 0',
      '1. 阿呆',
      '2.晟',
      '3. 愛玉（可到10）',
      '4.',
      '候補',
      '1. 路人甲',
    ].join('\n')

    const r = parseLineMessage(msg)
    expect(r.names).toEqual(['阿呆', '晟', '愛玉（可到10）'])
    expect(r.venueName).toBe('大同運動中心')
    expect(r.hours).toBe(2)
    expect(r.fee).toBe(150)
    expect(r.eventDate).toBe(`${new Date().getFullYear()}-09-02`)
  })
})
