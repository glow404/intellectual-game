import { RANKS, SUITS, type Card, type Rank, type Suit } from './types'

export function cardId(rank: number, suit: Suit): string {
  return `${rank}-${suit}`
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    [...RANKS]
      .reverse()
      .map((rank) => ({ id: cardId(rank, suit), rank, suit })),
  )
}

export const STANDARD_DECK = createDeck()

export function getCard(rank: number, suit: Suit): Card {
  const card = STANDARD_DECK.find((item) => item.rank === rank && item.suit === suit)
  if (!card) throw new Error(`不存在的牌：${rank}-${suit}`)
  return card
}

export function parseCard(shortCode: string): Card {
  const suitMap: Record<string, Suit> = {
    C: 'clubs',
    D: 'diamonds',
    H: 'hearts',
    S: 'spades',
  }
  const rankMap: Record<string, Rank> = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    T: 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  }
  const rank = rankMap[shortCode[0]?.toUpperCase()]
  const suit = suitMap[shortCode[1]?.toUpperCase()]
  if (!rank || !suit) throw new Error(`无法识别的牌：${shortCode}`)
  return getCard(rank, suit)
}

export function cardsFromCodes(codes: string): Card[] {
  return codes.trim().split(/\s+/).map(parseCard)
}
