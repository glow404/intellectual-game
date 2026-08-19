import { validateArrangement } from './arrangement'
import { STANDARD_DECK } from './cards'
import { HAND_CATEGORIES, type Arrangement, type Difficulty, type GameState, type GameStats } from './types'

export const GAME_STORAGE_KEY = 'poker-ten:game:v1'
export const STATS_STORAGE_KEY = 'poker-ten:stats:v1'

export const EMPTY_STATS: GameStats = {
  easy: { wins: 0, losses: 0, ties: 0, games: 0 },
  normal: { wins: 0, losses: 0, ties: 0, games: 0 },
  hard: { wins: 0, losses: 0, ties: 0, games: 0 },
}

export function saveGameState(state: GameState, storage: Storage = localStorage): void {
  storage.setItem(GAME_STORAGE_KEY, JSON.stringify(state))
}

function hasValidShape(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<GameState>
  if (state.version !== 1 || !['build', 'battle', 'result'].includes(state.phase ?? '')) return false
  if (!['easy', 'normal', 'hard'].includes(state.difficulty ?? '')) return false
  if (!state.playerGroups || !state.computerGroups || !Array.isArray(state.rounds)) return false
  if (typeof state.matchId !== 'string' || typeof state.seed !== 'number') return false
  if (typeof state.playerScore !== 'number' || typeof state.computerScore !== 'number') return false
  if (!Array.isArray(state.playerRemaining) || !Array.isArray(state.computerRemaining)) return false
  if (!state.playerRemaining.every((category) => HAND_CATEGORIES.includes(category))) return false
  if (!state.computerRemaining.every((category) => HAND_CATEGORIES.includes(category))) return false
  if (new Set(state.playerRemaining).size !== state.playerRemaining.length) return false
  if (new Set(state.computerRemaining).size !== state.computerRemaining.length) return false
  if (!HAND_CATEGORIES.every((category) => Array.isArray(state.playerGroups?.[category]) && Array.isArray(state.computerGroups?.[category]))) return false
  if (!hasOnlyRealUniqueCards(state.playerGroups, state.phase === 'build' ? 50 : 50)) return false
  if (!hasOnlyRealUniqueCards(state.computerGroups, 50)) return false
  if (!validateArrangement(state.computerGroups).valid) return false
  if (state.phase !== 'build' && !validateArrangement(state.playerGroups).valid) return false
  if (state.phase === 'build' && HAND_CATEGORIES.some((category) => state.playerGroups![category].length > 5)) return false
  if (state.phase === 'battle' && (!state.pendingComputerCategory || !state.computerRemaining.includes(state.pendingComputerCategory))) return false
  return true
}

function hasOnlyRealUniqueCards(arrangement: Arrangement, maximum: number): boolean {
  const validIds = new Set(STANDARD_DECK.map((card) => card.id))
  const ids = HAND_CATEGORIES.flatMap((category) => arrangement[category].map((card) => card?.id))
  return ids.length <= maximum && new Set(ids).size === ids.length && ids.every((id) => validIds.has(id))
}

export function loadGameState(storage: Storage = localStorage): GameState | null {
  try {
    const raw = storage.getItem(GAME_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return hasValidShape(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function loadStats(storage: Storage = localStorage): GameStats {
  try {
    const parsed = JSON.parse(storage.getItem(STATS_STORAGE_KEY) ?? 'null') as Partial<GameStats> | null
    if (!parsed || !(['easy', 'normal', 'hard'] as Difficulty[]).every((difficulty) => {
      const item = parsed[difficulty]
      return item && ['wins', 'losses', 'ties', 'games'].every((key) => {
        const value = item[key as keyof typeof item]
        return typeof value === 'number' && Number.isInteger(value) && value >= 0
      })
    })) {
      return structuredClone(EMPTY_STATS)
    }
    return parsed as GameStats
  } catch {
    return structuredClone(EMPTY_STATS)
  }
}

export function recordResult(state: GameState, current: GameStats): GameStats {
  const next = structuredClone(current)
  const stats = next[state.difficulty]
  stats.games += 1
  if (state.playerScore > state.computerScore) stats.wins += 1
  else if (state.playerScore < state.computerScore) stats.losses += 1
  else stats.ties += 1
  return next
}

export function saveStats(stats: GameStats, storage: Storage = localStorage): void {
  storage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats))
}
