import { getFallbackArrangementForTests } from './arrangement'
import { createInitialGameState, startBattle } from './state'
import { EMPTY_STATS, GAME_STORAGE_KEY, loadGameState, loadStats, recordResult, saveGameState } from './storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('persistence', () => {
  it('保存并恢复含电脑待出牌的对战状态', () => {
    const storage = new MemoryStorage()
    let state = createInitialGameState('normal', 55)
    state = startBattle({ ...state, playerGroups: getFallbackArrangementForTests(2) })
    saveGameState(state, storage)
    const restored = loadGameState(storage)
    expect(restored?.matchId).toBe(state.matchId)
    expect(restored?.pendingComputerCategory).toBe(state.pendingComputerCategory)
    expect(restored?.phase).toBe('battle')
  })

  it('损坏或版本不匹配的数据安全回退', () => {
    const storage = new MemoryStorage()
    storage.setItem(GAME_STORAGE_KEY, '{bad json')
    expect(loadGameState(storage)).toBeNull()
    storage.setItem(GAME_STORAGE_KEY, JSON.stringify({ version: 99 }))
    expect(loadGameState(storage)).toBeNull()
    expect(loadStats(storage)).toEqual(EMPTY_STATS)
  })

  it('按难度记录胜负统计', () => {
    const state = { ...createInitialGameState('hard', 71), phase: 'result' as const, playerScore: 14, computerScore: 9 }
    const stats = recordResult(state, structuredClone(EMPTY_STATS))
    expect(stats.hard).toEqual({ wins: 1, losses: 0, ties: 0, games: 1 })
    expect(stats.easy.games).toBe(0)
  })
})
