import { STANDARD_DECK, cardsFromCodes, getCard } from './cards'
import { evaluateHand } from './evaluator'
import { createRandom } from './random'
import {
  HAND_CATEGORIES,
  SUITS,
  type Arrangement,
  type ArrangementValidation,
  type Card,
  type GeneratedArrangement,
  type HandCategory,
  type Suit,
} from './types'

export function emptyArrangement(): Arrangement {
  return Object.fromEntries(HAND_CATEGORIES.map((category) => [category, []])) as unknown as Arrangement
}

export function cloneArrangement(arrangement: Arrangement): Arrangement {
  return Object.fromEntries(
    HAND_CATEGORIES.map((category) => [category, [...arrangement[category]]]),
  ) as Arrangement
}

export function validateArrangement(arrangement: Arrangement): ArrangementValidation {
  const errors: ArrangementValidation['errors'] = {}
  const allCards: Card[] = []

  for (const category of HAND_CATEGORIES) {
    const cards = arrangement[category] ?? []
    allCards.push(...cards)
    if (cards.length !== 5) {
      errors[category] = cards.length < 5 ? `还需 ${5 - cards.length} 张牌` : '每组只能放5张牌'
      continue
    }
    try {
      const evaluation = evaluateHand(cards)
      if (evaluation.category !== category) errors[category] = `当前是「${evaluation.category}」，与目标牌型不符`
    } catch (error) {
      errors[category] = error instanceof Error ? error.message : '牌组无效'
    }
  }

  const ids = allCards.map((card) => card.id)
  if (new Set(ids).size !== ids.length) errors.arrangement = '同一张牌不能出现在多个牌组中'
  if (allCards.length !== 50) errors.arrangement = `当前已使用 ${allCards.length}/50 张牌`

  const usedIds = new Set(ids)
  const unusedCards = STANDARD_DECK.filter((card) => !usedIds.has(card.id))
  if (unusedCards.length !== 2 && allCards.length === 50) errors.arrangement = '必须恰好留下2张未使用的牌'

  return { valid: Object.keys(errors).length === 0, errors, unusedCards }
}

function combinations<T>(items: T[], size: number): T[][] {
  const results: T[][] = []
  const current: T[] = []
  const visit = (start: number): void => {
    if (current.length === size) {
      results.push([...current])
      return
    }
    for (let index = start; index <= items.length - (size - current.length); index += 1) {
      current.push(items[index])
      visit(index + 1)
      current.pop()
    }
  }
  visit(0)
  return results
}

const STRAIGHT_RANKS = [
  [14, 2, 3, 4, 5],
  [2, 3, 4, 5, 6],
  [3, 4, 5, 6, 7],
  [4, 5, 6, 7, 8],
  [5, 6, 7, 8, 9],
  [6, 7, 8, 9, 10],
  [7, 8, 9, 10, 11],
  [8, 9, 10, 11, 12],
  [9, 10, 11, 12, 13],
  [10, 11, 12, 13, 14],
]

function cartesianCards(groups: Card[][]): Card[][] {
  return groups.reduce<Card[][]>(
    (products, group) => products.flatMap((product) => group.map((card) => [...product, card])),
    [[]],
  )
}

function candidatesFor(category: HandCategory, available: Card[]): Card[][] {
  const byRank = new Map<number, Card[]>()
  const bySuit = new Map<Suit, Card[]>()
  for (const card of available) {
    byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card])
    bySuit.set(card.suit, [...(bySuit.get(card.suit) ?? []), card])
  }

  let candidates: Card[][] = []
  if (category === 'royal-flush') {
    for (const suit of SUITS) {
      const hand = [10, 11, 12, 13, 14].map((rank) => available.find((card) => card.rank === rank && card.suit === suit))
      if (hand.every(Boolean)) candidates.push(hand as Card[])
    }
  } else if (category === 'straight-flush') {
    for (const suit of SUITS) {
      for (const ranks of STRAIGHT_RANKS.slice(0, -1)) {
        const hand = ranks.map((rank) => available.find((card) => card.rank === rank && card.suit === suit))
        if (hand.every(Boolean)) candidates.push(hand as Card[])
      }
    }
  } else if (category === 'four-kind') {
    for (const [rank, rankedCards] of byRank) {
      if (rankedCards.length !== 4) continue
      for (const kicker of available.filter((card) => card.rank !== rank)) candidates.push([...rankedCards, kicker])
    }
  } else if (category === 'full-house') {
    for (const [tripleRank, tripleCards] of byRank) {
      if (tripleCards.length < 3) continue
      for (const triple of combinations(tripleCards, 3)) {
        for (const [pairRank, pairCards] of byRank) {
          if (pairRank === tripleRank || pairCards.length < 2) continue
          for (const pair of combinations(pairCards, 2)) candidates.push([...triple, ...pair])
        }
      }
    }
  } else if (category === 'flush') {
    for (const suitedCards of bySuit.values()) {
      if (suitedCards.length >= 5) candidates.push(...combinations(suitedCards, 5))
    }
  } else if (category === 'straight') {
    for (const ranks of STRAIGHT_RANKS) {
      const groups = ranks.map((rank) => byRank.get(rank) ?? [])
      if (groups.every((group) => group.length > 0)) candidates.push(...cartesianCards(groups))
    }
  } else if (category === 'three-kind') {
    for (const [tripleRank, tripleCards] of byRank) {
      if (tripleCards.length < 3) continue
      const kickers = available.filter((card) => card.rank !== tripleRank)
      for (const triple of combinations(tripleCards, 3)) {
        for (const pair of combinations(kickers, 2)) {
          if (pair[0].rank !== pair[1].rank) candidates.push([...triple, ...pair])
        }
      }
    }
  } else if (category === 'two-pair') {
    const pairRanks = [...byRank.entries()].filter(([, cards]) => cards.length >= 2)
    for (const [[firstRank, firstCards], [secondRank, secondCards]] of combinations(pairRanks, 2)) {
      for (const firstPair of combinations(firstCards, 2)) {
        for (const secondPair of combinations(secondCards, 2)) {
          for (const kicker of available.filter((card) => card.rank !== firstRank && card.rank !== secondRank)) {
            candidates.push([...firstPair, ...secondPair, kicker])
          }
        }
      }
    }
  } else if (category === 'one-pair') {
    for (const [pairRank, pairCards] of byRank) {
      if (pairCards.length < 2) continue
      const kickers = available.filter((card) => card.rank !== pairRank)
      for (const pair of combinations(pairCards, 2)) {
        for (const three of combinations(kickers, 3)) {
          if (new Set(three.map((card) => card.rank)).size === 3) candidates.push([...pair, ...three])
        }
      }
    }
  } else {
    candidates = combinations(available, 5)
  }

  const seen = new Set<string>()
  return candidates.filter((cards) => {
    const key = cards.map((card) => card.id).sort().join('|')
    if (seen.has(key)) return false
    seen.add(key)
    try {
      return evaluateHand(cards).category === category
    } catch {
      return false
    }
  })
}

const SEARCH_ORDER: HandCategory[] = [
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
]

function fallbackArrangement(seed: number): Arrangement {
  const base: Arrangement = {
    'royal-flush': cardsFromCodes('TS JS QS KS AS'),
    'straight-flush': cardsFromCodes('2C 3C 4C 5C 6C'),
    'four-kind': cardsFromCodes('7S 7H 7D 7C 2D'),
    'full-house': cardsFromCodes('9S 9H 9D 3S 3H'),
    flush: cardsFromCodes('2H 4H 6H 8H TH'),
    straight: cardsFromCodes('9C TC JC QC KD'),
    'three-kind': cardsFromCodes('8S 8D 8C 4D 5S'),
    'two-pair': cardsFromCodes('JD JH QD QH 6S'),
    'one-pair': cardsFromCodes('KC KH TD 5D 2S'),
    'high-card': cardsFromCodes('AC 3D 4S 5H 6D'),
  }
  const random = createRandom(seed)
  const permutedSuits = random.shuffle([...SUITS])
  const mapping = Object.fromEntries(SUITS.map((suit, index) => [suit, permutedSuits[index]])) as Record<Suit, Suit>
  return Object.fromEntries(
    HAND_CATEGORIES.map((category) => [
      category,
      base[category].map((card) => getCard(card.rank, mapping[card.suit])),
    ]),
  ) as Arrangement
}

export function generateComputerArrangement(seed: number, maxSteps = 18_000): GeneratedArrangement {
  const random = createRandom(seed)
  const arrangement = emptyArrangement()
  let steps = 0

  const search = (index: number, available: Card[]): boolean => {
    if (index === SEARCH_ORDER.length) return available.length === 2
    if (steps >= maxSteps) return false
    const category = SEARCH_ORDER[index]
    const allCandidates = random.shuffle(candidatesFor(category, available))
    const candidateLimit = category === 'royal-flush' ? allCandidates.length : Math.min(allCandidates.length, 90)
    for (const cards of allCandidates.slice(0, candidateLimit)) {
      steps += 1
      if (steps >= maxSteps) break
      arrangement[category] = cards
      const used = new Set(cards.map((card) => card.id))
      if (search(index + 1, available.filter((card) => !used.has(card.id)))) return true
    }
    arrangement[category] = []
    return false
  }

  let usedFallback = false
  if (!search(0, STANDARD_DECK)) {
    usedFallback = true
    Object.assign(arrangement, fallbackArrangement(seed))
  }

  const validation = validateArrangement(arrangement)
  if (!validation.valid) throw new Error(`电脑组牌失败：${Object.values(validation.errors).join('；')}`)
  return { arrangement: cloneArrangement(arrangement), unusedCards: validation.unusedCards, seed, usedFallback }
}

export function getFallbackArrangementForTests(seed = 1): Arrangement {
  return fallbackArrangement(seed)
}
