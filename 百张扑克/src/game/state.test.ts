import { getFallbackArrangementForTests } from './arrangement'
import { createInitialGameState, moveCardToGroup, resolveRound, startBattle } from './state'
import { HAND_CATEGORIES } from './types'

describe('game state', () => {
  it('同一张玩家牌移动后只存在于一个槽位', () => {
    let state = createInitialGameState('easy', 4)
    state = moveCardToGroup(state, '14-spades', 'royal-flush')
    state = moveCardToGroup(state, '14-spades', 'flush')
    expect(state.playerGroups['royal-flush']).toHaveLength(0)
    expect(state.playerGroups.flush.map((card) => card.id)).toEqual(['14-spades'])
  })

  it('合法牌组进入十轮对战且每组只能使用一次', () => {
    let state = createInitialGameState('easy', 8)
    state = { ...state, playerGroups: getFallbackArrangementForTests(9) }
    state = startBattle(state)
    expect(state.phase).toBe('battle')
    expect(state.pendingComputerCategory).toBeDefined()

    const used = new Set<string>()
    for (const category of HAND_CATEGORIES) {
      expect(used.has(category)).toBe(false)
      used.add(category)
      state = resolveRound(state, category)
    }
    expect(state.phase).toBe('result')
    expect(state.rounds).toHaveLength(10)
    expect(state.playerRemaining).toHaveLength(0)
    expect(state.computerRemaining).toHaveLength(0)
    expect(state.rounds.reduce((sum, round) => sum + round.playerPoints, 0)).toBe(state.playerScore)
    expect(state.rounds.reduce((sum, round) => sum + round.computerPoints, 0)).toBe(state.computerScore)
  })

  it('非法布局不能开始对战', () => {
    const state = createInitialGameState('normal', 17)
    expect(() => startBattle(state)).toThrow('尚未全部合法')
  })
})
