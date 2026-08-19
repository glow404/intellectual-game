import { RANK_LABEL, SUIT_LABEL, SUIT_SYMBOL } from '../game/constants'
import type { Card } from '../game/types'

interface PlayingCardProps {
  card?: Card
  compact?: boolean
  hidden?: boolean
  selected?: boolean
  disabled?: boolean
  draggable?: boolean
  onClick?: () => void
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void
  title?: string
}

export function PlayingCard({
  card,
  compact = false,
  hidden = false,
  selected = false,
  disabled = false,
  draggable = false,
  onClick,
  onDragStart,
  title,
}: PlayingCardProps) {
  if (hidden) {
    return <div className={`playing-card card-back ${compact ? 'compact' : ''}`} aria-label="隐藏的牌" />
  }
  if (!card) return <div className={`playing-card card-placeholder ${compact ? 'compact' : ''}`} aria-hidden="true" />
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  const label = `${SUIT_LABEL[card.suit]}${RANK_LABEL[card.rank]}`
  const content = (
    <>
      <span className="card-corner">
        <span>{RANK_LABEL[card.rank]}</span>
        <span>{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
      <span className="card-corner card-corner-bottom" aria-hidden="true">
        <span>{RANK_LABEL[card.rank]}</span>
        <span>{SUIT_SYMBOL[card.suit]}</span>
      </span>
    </>
  )
  if (!onClick && !onDragStart) {
    return (
      <div className={`playing-card ${compact ? 'compact' : ''} ${red ? 'red' : 'black'} ${selected ? 'selected' : ''}`} aria-label={label} title={title ?? label}>
        {content}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`playing-card ${compact ? 'compact' : ''} ${red ? 'red' : 'black'} ${selected ? 'selected' : ''}`}
      aria-label={label}
      aria-pressed={selected || undefined}
      disabled={disabled}
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      title={title ?? label}
    >
      {content}
    </button>
  )
}

interface HandCardsProps {
  cards: Card[]
  compact?: boolean
  hidden?: boolean
  onCardClick?: (card: Card) => void
  onCardDragStart?: (event: React.DragEvent<HTMLButtonElement>, card: Card) => void
}

export function HandCards({ cards, compact, hidden, onCardClick, onCardDragStart }: HandCardsProps) {
  if (hidden) {
    return (
      <div className="hand-cards">
        {Array.from({ length: 5 }, (_, index) => <PlayingCard key={index} hidden compact={compact} />)}
      </div>
    )
  }
  return (
    <div className="hand-cards">
      {cards.map((card) => (
        <PlayingCard
          key={card.id}
          card={card}
          compact={compact}
          draggable={Boolean(onCardDragStart)}
          onClick={onCardClick ? () => onCardClick(card) : undefined}
          onDragStart={onCardDragStart ? (event) => onCardDragStart(event, card) : undefined}
        />
      ))}
      {Array.from({ length: Math.max(0, 5 - cards.length) }, (_, index) => (
        <PlayingCard key={`empty-${index}`} compact={compact} />
      ))}
    </div>
  )
}
