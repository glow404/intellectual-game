export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
export type Suit = (typeof SUITS)[number]

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
export type Rank = (typeof RANKS)[number]

export interface Card {
  id: string
  rank: Rank
  suit: Suit
}

export const HAND_CATEGORIES = [
  'royal-flush',
  'straight-flush',
  'four-kind',
  'full-house',
  'flush',
  'straight',
  'three-kind',
  'two-pair',
  'one-pair',
  'high-card',
] as const

export type HandCategory = (typeof HAND_CATEGORIES)[number]
export type Difficulty = 'easy' | 'normal' | 'hard'
export type GamePhase = 'build' | 'battle' | 'result'
export type RoundWinner = 'player' | 'computer' | 'tie'

export interface HandEvaluation {
  category: HandCategory
  categoryRank: number
  rankVector: number[]
  suitVector: number[]
  orderedCards: Card[]
  scoreValue: number
}

export type Arrangement = Record<HandCategory, Card[]>

export interface ArrangementValidation {
  valid: boolean
  errors: Partial<Record<HandCategory | 'arrangement', string>>
  unusedCards: Card[]
}

export interface GeneratedArrangement {
  arrangement: Arrangement
  unusedCards: Card[]
  seed: number
  usedFallback: boolean
}

export interface RoundResult {
  round: number
  playerCategory: HandCategory
  computerCategory: HandCategory
  playerHand: Card[]
  computerHand: Card[]
  winner: RoundWinner
  playerPoints: number
  computerPoints: number
  reason: string
}

export interface GameState {
  version: 1
  matchId: string
  phase: GamePhase
  difficulty: Difficulty
  seed: number
  playerGroups: Arrangement
  computerGroups: Arrangement
  playerRemaining: HandCategory[]
  computerRemaining: HandCategory[]
  pendingComputerCategory?: HandCategory
  rounds: RoundResult[]
  playerScore: number
  computerScore: number
  statsRecorded: boolean
  updatedAt: number
}

export interface DifficultyStats {
  wins: number
  losses: number
  ties: number
  games: number
}

export type GameStats = Record<Difficulty, DifficultyStats>
