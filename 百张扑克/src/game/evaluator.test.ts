import { cardsFromCodes } from './cards'
import { compareHands, evaluateHand, scoreWinningHand } from './evaluator'
import type { HandCategory } from './types'

describe('evaluateHand', () => {
  const fixtures: Array<[HandCategory, string]> = [
    ['royal-flush', 'TS JS QS KS AS'],
    ['straight-flush', '5H 6H 7H 8H 9H'],
    ['four-kind', 'QC QD QH QS 2C'],
    ['full-house', 'JC JD JH 8S 8C'],
    ['flush', 'AH JH 8H 5H 2H'],
    ['straight', '9S TD JH QC KS'],
    ['three-kind', '7C 7D 7S AH 2C'],
    ['two-pair', 'KC KD 4H 4S 9C'],
    ['one-pair', 'AC AD 9H 6S 3C'],
    ['high-card', 'AS JD 8C 5H 2D'],
  ]

  it.each(fixtures)('识别 %s', (category, codes) => {
    expect(evaluateHand(cardsFromCodes(codes)).category).toBe(category)
  })

  it('将皇家同花顺与普通同花顺分开', () => {
    expect(evaluateHand(cardsFromCodes('TS JS QS KS AS')).categoryRank).toBeGreaterThan(
      evaluateHand(cardsFromCodes('9S TS JS QS KS')).categoryRank,
    )
  })

  it('把A2345作为5高顺子比较，但获胜点数仍为14', () => {
    const wheel = cardsFromCodes('AS 2D 3H 4C 5S')
    const sixHigh = cardsFromCodes('2S 3D 4H 5C 6S')
    expect(evaluateHand(wheel).rankVector).toEqual([5])
    expect(compareHands(wheel, sixHigh).winner).toBe('computer')
    expect(scoreWinningHand(wheel)).toBe(14)
  })

  it('按标准德州顺序判定葫芦高于同花、顺子高于三条', () => {
    expect(compareHands(cardsFromCodes('JC JD JH 8S 8C'), cardsFromCodes('AH JH 8H 5H 2H')).winner).toBe('player')
    expect(compareHands(cardsFromCodes('9S TD JH QC KS'), cardsFromCodes('AC AD AH QS 2C')).winner).toBe('player')
  })

  it('同牌型先比较关键点数和踢脚牌', () => {
    const kings = cardsFromCodes('KS KH AD QC 2S')
    const queens = cardsFromCodes('QS QH AD KC JS')
    expect(compareHands(kings, queens).winner).toBe('player')

    const aceKicker = cardsFromCodes('KS KH AD QC 2S')
    const queenKicker = cardsFromCodes('KS KH QD JC TS')
    expect(compareHands(aceKicker, queenKicker).winner).toBe('player')
  })

  it('点数完全相同时逐张按花色破平', () => {
    const spadeHeartAces = cardsFromCodes('AS AH KC QD JC')
    const diamondClubAces = cardsFromCodes('AD AC KC QD JC')
    const comparison = compareHands(spadeHeartAces, diamondClubAces)
    expect(comparison.winner).toBe('player')
    expect(comparison.reason).toContain('黑桃')
  })

  it('完全相同的五张牌判为平局', () => {
    const hand = cardsFromCodes('AS KD QH JC 9S')
    expect(compareHands(hand, [...hand]).winner).toBe('tie')
  })
})
