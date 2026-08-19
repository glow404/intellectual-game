import { CATEGORY_LABELS, CATEGORY_RANK, RANK_LABEL, SUIT_LABEL, SUIT_VALUE } from './constants'
import type { Card, HandCategory, HandEvaluation, Rank, RoundWinner } from './types'

function assertFiveUniqueCards(cards: Card[]): void {
  if (cards.length !== 5) throw new Error('一手牌必须正好包含5张牌')
  if (new Set(cards.map((card) => card.id)).size !== 5) throw new Error('一手牌中不能出现重复牌')
}

function descendingCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.rank - a.rank || SUIT_VALUE[b.suit] - SUIT_VALUE[a.suit])
}

function cardsByRankOrder(cards: Card[], rankOrder: number[]): Card[] {
  return rankOrder.flatMap((rank) =>
    cards
      .filter((card) => card.rank === rank)
      .sort((a, b) => SUIT_VALUE[b.suit] - SUIT_VALUE[a.suit]),
  )
}

function straightInfo(uniqueRanksDescending: number[]): { straight: boolean; high: number; order: number[] } {
  if (uniqueRanksDescending.length !== 5) return { straight: false, high: 0, order: [] }
  if (uniqueRanksDescending.join(',') === '14,5,4,3,2') {
    return { straight: true, high: 5, order: [5, 4, 3, 2, 14] }
  }
  const straight = uniqueRanksDescending.every(
    (rank, index) => index === 0 || uniqueRanksDescending[index - 1] - rank === 1,
  )
  return {
    straight,
    high: straight ? uniqueRanksDescending[0] : 0,
    order: straight ? uniqueRanksDescending : [],
  }
}

export function evaluateHand(cards: Card[]): HandEvaluation {
  assertFiveUniqueCards(cards)
  const sorted = descendingCards(cards)
  const ranks = sorted.map((card) => card.rank)
  const uniqueRanks = [...new Set(ranks)]
  const counts = new Map<number, number>()
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const flush = cards.every((card) => card.suit === cards[0].suit)
  const straight = straightInfo(uniqueRanks)

  let category: HandCategory
  let rankVector: number[]
  let orderedCards: Card[]

  if (flush && straight.straight && straight.high === 14) {
    category = 'royal-flush'
    rankVector = [14]
    orderedCards = cardsByRankOrder(cards, straight.order)
  } else if (flush && straight.straight) {
    category = 'straight-flush'
    rankVector = [straight.high]
    orderedCards = cardsByRankOrder(cards, straight.order)
  } else if (groups[0][1] === 4) {
    const quad = groups[0][0]
    const kicker = groups[1][0]
    category = 'four-kind'
    rankVector = [quad, kicker]
    orderedCards = cardsByRankOrder(cards, [quad, kicker])
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    const triple = groups[0][0]
    const pair = groups[1][0]
    category = 'full-house'
    rankVector = [triple, pair]
    orderedCards = cardsByRankOrder(cards, [triple, pair])
  } else if (flush) {
    category = 'flush'
    rankVector = [...uniqueRanks]
    orderedCards = sorted
  } else if (straight.straight) {
    category = 'straight'
    rankVector = [straight.high]
    orderedCards = cardsByRankOrder(cards, straight.order)
  } else if (groups[0][1] === 3) {
    const triple = groups[0][0]
    const kickers = groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)
    category = 'three-kind'
    rankVector = [triple, ...kickers]
    orderedCards = cardsByRankOrder(cards, [triple, ...kickers])
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = groups.slice(0, 2).map(([rank]) => rank).sort((a, b) => b - a)
    const kicker = groups[2][0]
    category = 'two-pair'
    rankVector = [...pairs, kicker]
    orderedCards = cardsByRankOrder(cards, [...pairs, kicker])
  } else if (groups[0][1] === 2) {
    const pair = groups[0][0]
    const kickers = groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)
    category = 'one-pair'
    rankVector = [pair, ...kickers]
    orderedCards = cardsByRankOrder(cards, [pair, ...kickers])
  } else {
    category = 'high-card'
    rankVector = [...uniqueRanks]
    orderedCards = sorted
  }

  return {
    category,
    categoryRank: CATEGORY_RANK[category],
    rankVector,
    suitVector: orderedCards.map((card) => SUIT_VALUE[card.suit]),
    orderedCards,
    scoreValue: Math.max(...cards.map((card) => card.rank)),
  }
}

function compareVectors(left: number[], right: number[]): number {
  const size = Math.max(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    const difference = (left[index] ?? -1) - (right[index] ?? -1)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

export interface HandComparison {
  winner: RoundWinner
  comparison: number
  reason: string
  playerEvaluation: HandEvaluation
  computerEvaluation: HandEvaluation
}

export function compareHands(playerCards: Card[], computerCards: Card[]): HandComparison {
  const playerEvaluation = evaluateHand(playerCards)
  const computerEvaluation = evaluateHand(computerCards)
  const categoryComparison = Math.sign(playerEvaluation.categoryRank - computerEvaluation.categoryRank)
  if (categoryComparison !== 0) {
    const winner = categoryComparison > 0 ? 'player' : 'computer'
    const high = winner === 'player' ? playerEvaluation : computerEvaluation
    const low = winner === 'player' ? computerEvaluation : playerEvaluation
    return {
      winner,
      comparison: categoryComparison,
      reason: `${CATEGORY_LABELS[high.category]} 高于 ${CATEGORY_LABELS[low.category]}`,
      playerEvaluation,
      computerEvaluation,
    }
  }

  const rankComparison = compareVectors(playerEvaluation.rankVector, computerEvaluation.rankVector)
  if (rankComparison !== 0) {
    const winner = rankComparison > 0 ? 'player' : 'computer'
    const winningEvaluation = winner === 'player' ? playerEvaluation : computerEvaluation
    const losingEvaluation = winner === 'player' ? computerEvaluation : playerEvaluation
    const keyRank = winningEvaluation.rankVector.find(
      (rank, index) => rank !== losingEvaluation.rankVector[index],
    ) ?? winningEvaluation.rankVector[0]
    return {
      winner,
      comparison: rankComparison,
      reason: `${CATEGORY_LABELS[winningEvaluation.category]}以 ${RANK_LABEL[keyRank as Rank] ?? keyRank} 领先`,
      playerEvaluation,
      computerEvaluation,
    }
  }

  const suitComparison = compareVectors(playerEvaluation.suitVector, computerEvaluation.suitVector)
  if (suitComparison !== 0) {
    const winner = suitComparison > 0 ? 'player' : 'computer'
    const winningEvaluation = winner === 'player' ? playerEvaluation : computerEvaluation
    const losingEvaluation = winner === 'player' ? computerEvaluation : playerEvaluation
    const suitIndex = winningEvaluation.suitVector.findIndex(
      (value, index) => value !== losingEvaluation.suitVector[index],
    )
    const winningCard = winningEvaluation.orderedCards[suitIndex]
    const losingCard = losingEvaluation.orderedCards[suitIndex]
    return {
      winner,
      comparison: suitComparison,
      reason: `同点时${SUIT_LABEL[winningCard.suit]}高于${SUIT_LABEL[losingCard.suit]}`,
      playerEvaluation,
      computerEvaluation,
    }
  }

  return {
    winner: 'tie',
    comparison: 0,
    reason: '五张牌完全相同，本轮平局',
    playerEvaluation,
    computerEvaluation,
  }
}

export function scoreWinningHand(cards: Card[]): number {
  return Math.max(...cards.map((card) => card.rank))
}
