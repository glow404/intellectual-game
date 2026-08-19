import { getFallbackArrangementForTests, generateComputerArrangement, validateArrangement } from './arrangement'
import { HAND_CATEGORIES } from './types'

describe('arrangement', () => {
  it('内置保底方案精确包含十种牌型并留下两张牌', () => {
    const validation = validateArrangement(getFallbackArrangementForTests())
    expect(validation.errors).toEqual({})
    expect(validation.valid).toBe(true)
    expect(validation.unusedCards).toHaveLength(2)
  })

  it.each([1, 7, 42, 2026, 0xffffffff])('种子 %s 生成合法且无重复的50张布局', (seed) => {
    const result = generateComputerArrangement(seed, 4_000)
    const validation = validateArrangement(result.arrangement)
    const ids = HAND_CATEGORIES.flatMap((category) => result.arrangement[category].map((card) => card.id))
    expect(validation.valid).toBe(true)
    expect(ids).toHaveLength(50)
    expect(new Set(ids).size).toBe(50)
    expect(result.unusedCards).toHaveLength(2)
  })

  it('正常预算优先使用随机回溯结果', () => {
    expect(generateComputerArrangement(42).usedFallback).toBe(false)
  })

  it('搜索预算耗尽时使用合法保底布局', () => {
    const result = generateComputerArrangement(99, 0)
    expect(result.usedFallback).toBe(true)
    expect(validateArrangement(result.arrangement).valid).toBe(true)
  })

  it('拒绝放错牌型、缺牌和重复牌', () => {
    const arrangement = getFallbackArrangementForTests()
    arrangement.flush = [...arrangement['royal-flush']]
    const validation = validateArrangement(arrangement)
    expect(validation.valid).toBe(false)
    expect(validation.errors.flush).toBeDefined()
    expect(validation.errors.arrangement).toBeDefined()
  })
})
