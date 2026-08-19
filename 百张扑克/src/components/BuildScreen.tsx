import { useMemo, useState } from 'react'
import { CATEGORY_LABELS, SUIT_LABEL, SUIT_SYMBOL } from '../game/constants'
import { validateArrangement } from '../game/arrangement'
import { availablePlayerCards, groupStatus } from '../game/state'
import { HAND_CATEGORIES, SUITS, type Card, type GameState, type HandCategory } from '../game/types'
import { HandCards, PlayingCard } from './PlayingCard'

interface BuildScreenProps {
  game: GameState
  onMoveCard: (cardId: string, category: HandCategory) => void
  onRemoveCard: (cardId: string) => void
  onClearGroup: (category: HandCategory) => void
  onStartBattle: () => void
}

export function BuildScreen({
  game,
  onMoveCard,
  onRemoveCard,
  onClearGroup,
  onStartBattle,
}: BuildScreenProps) {
  const [activeCategory, setActiveCategory] = useState<HandCategory>('royal-flush')
  const [notice, setNotice] = useState('先选择一个牌型槽位，再点击牌；也可以直接拖拽。')
  const available = useMemo(() => availablePlayerCards(game), [game])
  const validation = useMemo(() => validateArrangement(game.playerGroups), [game.playerGroups])
  const assignedCount = 52 - available.length
  const validGroups = HAND_CATEGORIES.filter((category) => groupStatus(game.playerGroups[category], category).valid).length

  const moveCard = (cardId: string, category = activeCategory): void => {
    if (game.playerGroups[category].length >= 5 && !game.playerGroups[category].some((card) => card.id === cardId)) {
      setNotice(`${CATEGORY_LABELS[category]}已经有5张牌，请先移走一张。`)
      return
    }
    onMoveCard(cardId, category)
    setNotice(`已放入「${CATEGORY_LABELS[category]}」`)
  }

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, card: Card): void => {
    event.dataTransfer.setData('text/card-id', card.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (event: React.DragEvent<HTMLElement>, category: HandCategory): void => {
    event.preventDefault()
    const cardId = event.dataTransfer.getData('text/card-id')
    if (cardId) moveCard(cardId, category)
  }

  return (
    <main className="build-screen">
      <section className="build-intro">
        <div>
          <p className="eyebrow">PHASE 01 · BUILD</p>
          <h1>把一副牌，变成十手牌</h1>
          <p>每种牌型只能出现一次。使用50张，留下2张，然后带着你的布局进入暗战。</p>
        </div>
        <div className="build-progress" aria-label={`已完成${validGroups}组，已使用${assignedCount}张牌`}>
          <div><strong>{validGroups}</strong><span>/ 10 合法牌组</span></div>
          <div><strong>{assignedCount}</strong><span>/ 50 已使用</span></div>
          <div className="progress-track"><span style={{ width: `${validGroups * 10}%` }} /></div>
        </div>
      </section>

      <div className="build-workspace">
        <aside className="deck-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR DECK</p>
              <h2>待分配牌库</h2>
            </div>
            <span className={`deck-count ${available.length === 2 ? 'ready' : ''}`}>{available.length} 张</span>
          </div>
          <p className="interaction-hint" aria-live="polite">{notice}</p>
          <div className="deck-suits">
            {SUITS.slice().reverse().map((suit) => {
              const suitCards = available.filter((card) => card.suit === suit)
              return (
                <div className="suit-row" key={suit}>
                  <div className={`suit-label ${suit === 'hearts' || suit === 'diamonds' ? 'red' : ''}`}>
                    <span>{SUIT_SYMBOL[suit]}</span>
                    <small>{SUIT_LABEL[suit]}</small>
                  </div>
                  <div className="deck-card-row">
                    {suitCards.length > 0 ? suitCards.map((card) => (
                      <PlayingCard
                        key={card.id}
                        card={card}
                        compact
                        draggable
                        onClick={() => moveCard(card.id)}
                        onDragStart={(event) => handleDragStart(event, card)}
                        title={`放入${CATEGORY_LABELS[activeCategory]}`}
                      />
                    )) : <span className="empty-suit">本花色已全部分配</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="leftover-note">
            <span className="leftover-icon">2</span>
            <p><strong>最后剩下的两张牌</strong><br />会自动成为本局弃牌，无需单独操作。</p>
          </div>
        </aside>

        <section className="groups-panel">
          <div className="panel-heading groups-heading">
            <div>
              <p className="eyebrow">TEN HANDS</p>
              <h2>你的十手牌</h2>
            </div>
            <span className="active-target">正在组：{CATEGORY_LABELS[activeCategory]}</span>
          </div>
          <div className="hand-slot-grid">
            {HAND_CATEGORIES.map((category, index) => {
              const cards = game.playerGroups[category]
              const status = groupStatus(cards, category)
              return (
                <article
                  key={category}
                  className={`hand-slot ${activeCategory === category ? 'active' : ''} ${status.valid ? 'valid' : ''} ${cards.length === 5 && !status.valid ? 'invalid' : ''}`}
                  onClick={() => setActiveCategory(category)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, category)}
                  aria-label={`${CATEGORY_LABELS[category]}槽位，${status.message}`}
                >
                  <div className="slot-topline">
                    <span className="slot-number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{CATEGORY_LABELS[category]}</h3>
                      <p className={status.valid ? 'status-valid' : ''}>{status.valid ? '✓ ' : ''}{status.message}</p>
                    </div>
                    {cards.length > 0 && (
                      <button
                        type="button"
                        className="clear-button"
                        onClick={(event) => { event.stopPropagation(); onClearGroup(category) }}
                        aria-label={`清空${CATEGORY_LABELS[category]}`}
                      >清空</button>
                    )}
                  </div>
                  <HandCards
                    cards={cards}
                    compact
                    onCardClick={(card) => onRemoveCard(card.id)}
                    onCardDragStart={handleDragStart}
                  />
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <footer className="build-footer">
        <div>
          <span className={`footer-status-dot ${validation.valid ? 'ready' : ''}`} />
          <p><strong>{validation.valid ? '十手牌已就绪' : `还需完成 ${10 - validGroups} 组`}</strong><br />
            {validation.valid ? '电脑也已完成组牌，可以进入十轮暗战。' : validation.errors.arrangement ?? '放满五张后会自动校验牌型。'}
          </p>
        </div>
        <button className="primary-button" type="button" disabled={!validation.valid} onClick={onStartBattle}>
          提交牌组，进入对战 <span>→</span>
        </button>
      </footer>
    </main>
  )
}
