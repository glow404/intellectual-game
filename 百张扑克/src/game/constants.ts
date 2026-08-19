import type { Difficulty, HandCategory, Rank, Suit } from './types'

export const CATEGORY_LABELS: Record<HandCategory, string> = {
  'royal-flush': '皇家同花顺',
  'straight-flush': '同花顺',
  'four-kind': '四条',
  'full-house': '葫芦',
  flush: '同花',
  straight: '顺子',
  'three-kind': '三条',
  'two-pair': '两对',
  'one-pair': '一对',
  'high-card': '散牌',
}

export const CATEGORY_SHORT_LABELS: Record<HandCategory, string> = {
  'royal-flush': '皇家',
  'straight-flush': '同顺',
  'four-kind': '四条',
  'full-house': '葫芦',
  flush: '同花',
  straight: '顺子',
  'three-kind': '三条',
  'two-pair': '两对',
  'one-pair': '一对',
  'high-card': '散牌',
}

export const CATEGORY_RANK: Record<HandCategory, number> = {
  'royal-flush': 9,
  'straight-flush': 8,
  'four-kind': 7,
  'full-house': 6,
  flush: 5,
  straight: 4,
  'three-kind': 3,
  'two-pair': 2,
  'one-pair': 1,
  'high-card': 0,
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

export const SUIT_LABEL: Record<Suit, string> = {
  clubs: '梅花',
  diamonds: '方片',
  hearts: '红心',
  spades: '黑桃',
}

export const SUIT_VALUE: Record<Suit, number> = {
  clubs: 0,
  diamonds: 1,
  hearts: 2,
  spades: 3,
}

export const RANK_LABEL: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
}
