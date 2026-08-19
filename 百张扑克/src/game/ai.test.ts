import { chooseComputerMove } from './ai'
import { getFallbackArrangementForTests } from './arrangement'
import { HAND_CATEGORIES, type Difficulty } from './types'

describe('computer player', () => {
  it.each(['easy', 'normal', 'hard'] as Difficulty[])('%s 难度只会选择未使用的合法牌组', (difficulty) => {
    const remaining = HAND_CATEGORIES.slice(2, 8)
    const choice = chooseComputerMove({
      difficulty,
      computerGroups: getFallbackArrangementForTests(),
      computerRemaining: remaining,
      playerRemainingCategories: [...remaining],
      publicHistory: [],
      seed: 1234,
    })
    expect(remaining).toContain(choice)
  })

  it('固定种子会得到可复现选择', () => {
    const input = {
      difficulty: 'hard' as const,
      computerGroups: getFallbackArrangementForTests(),
      computerRemaining: [...HAND_CATEGORIES],
      playerRemainingCategories: [...HAND_CATEGORIES],
      publicHistory: [],
      seed: 77,
    }
    expect(chooseComputerMove(input)).toBe(chooseComputerMove(input))
  })

  it('困难推演在交互时间预算内完成', () => {
    const started = performance.now()
    chooseComputerMove({
      difficulty: 'hard',
      computerGroups: getFallbackArrangementForTests(),
      computerRemaining: [...HAND_CATEGORIES],
      playerRemainingCategories: [...HAND_CATEGORIES],
      publicHistory: [],
      seed: 44,
    })
    expect(performance.now() - started).toBeLessThan(900)
  })
})
