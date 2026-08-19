import { CATEGORY_RANK } from './constants'
import { evaluateHand } from './evaluator'
import { createRandom, nextSeed } from './random'
import type { Arrangement, Difficulty, HandCategory, RoundResult } from './types'

export interface ComputerMoveInput {
  difficulty: Difficulty
  computerGroups: Arrangement
  computerRemaining: HandCategory[]
  playerRemainingCategories: HandCategory[]
  publicHistory: RoundResult[]
  seed: number
}

const EXPECTED_PLAYER_SCORE: Record<HandCategory, number> = {
  'royal-flush': 14,
  'straight-flush': 10,
  'four-kind': 11,
  'full-house': 11,
  flush: 12,
  straight: 10,
  'three-kind': 11,
  'two-pair': 12,
  'one-pair': 12,
  'high-card': 13,
}

function categoryPayoff(
  computerCategory: HandCategory,
  playerCategory: HandCategory,
  computerScore: number,
): number {
  const difference = CATEGORY_RANK[computerCategory] - CATEGORY_RANK[playerCategory]
  if (difference > 0) return computerScore
  if (difference < 0) return -EXPECTED_PLAYER_SCORE[playerCategory]
  return 0
}

function immediateValue(
  computerCategory: HandCategory,
  playerCategories: HandCategory[],
  computerGroups: Arrangement,
): number {
  const score = evaluateHand(computerGroups[computerCategory]).scoreValue
  return playerCategories.reduce(
    (sum, playerCategory) => sum + categoryPayoff(computerCategory, playerCategory, score),
    0,
  ) / Math.max(1, playerCategories.length)
}

function weightedChoice<T>(items: T[], weights: number[], value: number): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = value * total
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index]
    if (cursor <= 0) return items[index]
  }
  return items[items.length - 1]
}

function normalMove(input: ComputerMoveInput, randomValue: number): HandCategory {
  const ranked = input.computerRemaining
    .map((category) => ({
      category,
      value: immediateValue(category, input.playerRemainingCategories, input.computerGroups),
    }))
    .sort((a, b) => b.value - a.value)
  const contenders = ranked.slice(0, Math.min(3, ranked.length))
  const best = contenders[0].value
  const weights = contenders.map(({ value }) => Math.exp((value - best) / 2.75))
  return weightedChoice(contenders.map(({ category }) => category), weights, randomValue)
}

function playerCategoryWeights(categories: HandCategory[], history: RoundResult[]): number[] {
  if (history.length === 0) return categories.map(() => 1)
  const averagePlayedRank = history.reduce((sum, round) => sum + CATEGORY_RANK[round.playerCategory], 0) / history.length
  const expectedByNow = 4.5
  const aggression = Math.max(-0.65, Math.min(0.65, (averagePlayedRank - expectedByNow) / 4.5))
  return categories.map((category) => {
    const centered = (CATEGORY_RANK[category] - 4.5) / 4.5
    return Math.max(0.2, 1 + aggression * centered)
  })
}

function hardMove(input: ComputerMoveInput): HandCategory {
  const random = createRandom(input.seed)
  const rollouts = input.computerRemaining.length > 6 ? 220 : 360
  const totals = new Map<HandCategory, number>(input.computerRemaining.map((category) => [category, 0]))

  for (const opening of input.computerRemaining) {
    let total = 0
    for (let rollout = 0; rollout < rollouts; rollout += 1) {
      const aiRemaining = input.computerRemaining.filter((category) => category !== opening)
      const playerRemaining = [...input.playerRemainingCategories]
      const firstWeights = playerCategoryWeights(playerRemaining, input.publicHistory)
      const firstPlayer = weightedChoice(playerRemaining, firstWeights, random.next())
      const openingScore = evaluateHand(input.computerGroups[opening]).scoreValue
      total += categoryPayoff(opening, firstPlayer, openingScore)
      playerRemaining.splice(playerRemaining.indexOf(firstPlayer), 1)

      while (aiRemaining.length > 0) {
        const aiChoice = normalMove(
          {
            ...input,
            computerRemaining: aiRemaining,
            playerRemainingCategories: playerRemaining,
          },
          random.next(),
        )
        const weights = playerCategoryWeights(playerRemaining, input.publicHistory)
        const playerChoice = weightedChoice(playerRemaining, weights, random.next())
        total += categoryPayoff(
          aiChoice,
          playerChoice,
          evaluateHand(input.computerGroups[aiChoice]).scoreValue,
        )
        aiRemaining.splice(aiRemaining.indexOf(aiChoice), 1)
        playerRemaining.splice(playerRemaining.indexOf(playerChoice), 1)
      }
    }
    totals.set(opening, total / rollouts)
  }

  return [...totals.entries()].sort((a, b) => b[1] - a[1] || random.next() - 0.5)[0][0]
}

export function chooseComputerMove(input: ComputerMoveInput): HandCategory {
  if (input.computerRemaining.length === 0) throw new Error('电脑已经没有可出的牌组')
  const random = createRandom(input.seed)
  if (input.difficulty === 'easy') return input.computerRemaining[random.int(input.computerRemaining.length)]
  if (input.difficulty === 'normal') return normalMove(input, random.next())
  return hardMove(input)
}

export function advanceAiSeed(seed: number): number {
  return nextSeed(seed)
}
