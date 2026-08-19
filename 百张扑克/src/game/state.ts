import { CATEGORY_LABELS } from './constants'
import { STANDARD_DECK } from './cards'
import { chooseComputerMove, advanceAiSeed } from './ai'
import { cloneArrangement, emptyArrangement, generateComputerArrangement, validateArrangement } from './arrangement'
import { compareHands, evaluateHand, scoreWinningHand } from './evaluator'
import {
  HAND_CATEGORIES,
  type Card,
  type Difficulty,
  type GameState,
  type HandCategory,
  type RoundResult,
} from './types'

function newMatchId(seed: number): string {
  return `${Date.now().toString(36)}-${seed.toString(36)}`
}

export function createInitialGameState(difficulty: Difficulty = 'normal', seed = Date.now() >>> 0): GameState {
  const generated = generateComputerArrangement(seed)
  return {
    version: 1,
    matchId: newMatchId(seed),
    phase: 'build',
    difficulty,
    seed,
    playerGroups: emptyArrangement(),
    computerGroups: generated.arrangement,
    playerRemaining: [...HAND_CATEGORIES],
    computerRemaining: [...HAND_CATEGORIES],
    rounds: [],
    playerScore: 0,
    computerScore: 0,
    statsRecorded: false,
    updatedAt: Date.now(),
  }
}

function withUpdatedTime(state: GameState): GameState {
  return { ...state, updatedAt: Date.now() }
}

export function availablePlayerCards(state: GameState): Card[] {
  const assigned = new Set(HAND_CATEGORIES.flatMap((category) => state.playerGroups[category].map((card) => card.id)))
  return STANDARD_DECK.filter((card) => !assigned.has(card.id))
}

export function moveCardToGroup(state: GameState, cardId: string, target: HandCategory): GameState {
  if (state.phase !== 'build') return state
  const card = STANDARD_DECK.find((item) => item.id === cardId)
  if (!card) return state
  const groups = cloneArrangement(state.playerGroups)
  for (const category of HAND_CATEGORIES) {
    groups[category] = groups[category].filter((item) => item.id !== cardId)
  }
  if (groups[target].length >= 5) return state
  groups[target] = [...groups[target], card]
  return withUpdatedTime({ ...state, playerGroups: groups })
}

export function removeCardFromGroups(state: GameState, cardId: string): GameState {
  if (state.phase !== 'build') return state
  const groups = cloneArrangement(state.playerGroups)
  let changed = false
  for (const category of HAND_CATEGORIES) {
    const filtered = groups[category].filter((card) => card.id !== cardId)
    if (filtered.length !== groups[category].length) changed = true
    groups[category] = filtered
  }
  return changed ? withUpdatedTime({ ...state, playerGroups: groups }) : state
}

export function clearPlayerGroup(state: GameState, category: HandCategory): GameState {
  if (state.phase !== 'build' || state.playerGroups[category].length === 0) return state
  const groups = cloneArrangement(state.playerGroups)
  groups[category] = []
  return withUpdatedTime({ ...state, playerGroups: groups })
}

function selectPendingComputerMove(state: GameState): { category: HandCategory; seed: number } {
  const seed = advanceAiSeed(state.seed)
  const category = chooseComputerMove({
    difficulty: state.difficulty,
    computerGroups: state.computerGroups,
    computerRemaining: state.computerRemaining,
    playerRemainingCategories: state.playerRemaining,
    publicHistory: state.rounds,
    seed,
  })
  return { category, seed }
}

export function startBattle(state: GameState): GameState {
  if (state.phase !== 'build') return state
  const validation = validateArrangement(state.playerGroups)
  if (!validation.valid) throw new Error('十组牌尚未全部合法，不能开始对战')
  const nextState: GameState = {
    ...state,
    phase: 'battle',
    playerRemaining: [...HAND_CATEGORIES],
    computerRemaining: [...HAND_CATEGORIES],
    updatedAt: Date.now(),
  }
  const pending = selectPendingComputerMove(nextState)
  return { ...nextState, pendingComputerCategory: pending.category, seed: pending.seed }
}

export function resolveRound(state: GameState, playerCategory: HandCategory): GameState {
  if (state.phase !== 'battle' || !state.pendingComputerCategory) throw new Error('当前不能出牌')
  if (!state.playerRemaining.includes(playerCategory)) throw new Error('这组牌已经使用过了')
  const computerCategory = state.pendingComputerCategory
  if (!state.computerRemaining.includes(computerCategory)) throw new Error('电脑选择了无效牌组')

  const playerHand = state.playerGroups[playerCategory]
  const computerHand = state.computerGroups[computerCategory]
  const comparison = compareHands(playerHand, computerHand)
  const playerPoints = comparison.winner === 'player' ? scoreWinningHand(playerHand) : 0
  const computerPoints = comparison.winner === 'computer' ? scoreWinningHand(computerHand) : 0
  const round: RoundResult = {
    round: state.rounds.length + 1,
    playerCategory,
    computerCategory,
    playerHand: [...playerHand],
    computerHand: [...computerHand],
    winner: comparison.winner,
    playerPoints,
    computerPoints,
    reason: comparison.reason,
  }
  const playerRemaining = state.playerRemaining.filter((category) => category !== playerCategory)
  const computerRemaining = state.computerRemaining.filter((category) => category !== computerCategory)
  const base: GameState = {
    ...state,
    playerRemaining,
    computerRemaining,
    rounds: [...state.rounds, round],
    playerScore: state.playerScore + playerPoints,
    computerScore: state.computerScore + computerPoints,
    pendingComputerCategory: undefined,
    updatedAt: Date.now(),
  }

  if (playerRemaining.length === 0) return { ...base, phase: 'result' }
  const pending = selectPendingComputerMove(base)
  return { ...base, pendingComputerCategory: pending.category, seed: pending.seed }
}

export function groupStatus(cards: Card[], target: HandCategory): { valid: boolean; message: string } {
  if (cards.length === 0) return { valid: false, message: '等待放牌' }
  if (cards.length < 5) return { valid: false, message: `还需 ${5 - cards.length} 张` }
  try {
    const evaluation = evaluateHand(cards)
    return evaluation.category === target
      ? { valid: true, message: `已组成${CATEGORY_LABELS[target]} · 最高 ${evaluation.scoreValue} 分` }
      : { valid: false, message: `当前是${CATEGORY_LABELS[evaluation.category]}` }
  } catch {
    return { valid: false, message: '牌组无效' }
  }
}
