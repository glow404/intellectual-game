import { useEffect, useState } from 'react'
import { CATEGORY_LABELS, CATEGORY_SHORT_LABELS } from '../game/constants'
import { evaluateHand } from '../game/evaluator'
import type { GameState, HandCategory, RoundResult } from '../game/types'
import { HandCards } from './PlayingCard'

function outcomeLabel(round: RoundResult): string {
  if (round.winner === 'player') return `你赢得 ${round.playerPoints} 分`
  if (round.winner === 'computer') return `电脑赢得 ${round.computerPoints} 分`
  return '本轮平局'
}

function RevealBoard({ round }: { round?: RoundResult }) {
  if (!round) {
    return (
      <section className="reveal-board waiting-reveal">
        <div className="hidden-hand-block">
          <span className="side-label">电脑</span>
          <HandCards cards={[]} hidden />
          <strong>已暗中选牌</strong>
        </div>
        <div className="versus-medallion"><span>VS</span></div>
        <div className="hidden-hand-block player-waiting">
          <span className="side-label">你</span>
          <div className="waiting-slots">请选择下方的一组牌</div>
        </div>
      </section>
    )
  }
  return (
    <section className={`reveal-board revealed outcome-${round.winner}`} aria-live="polite">
      <div className={`revealed-hand ${round.winner === 'computer' ? 'winner' : ''}`}>
        <div className="revealed-title">
          <span>电脑 · {CATEGORY_LABELS[round.computerCategory]}</span>
          <strong>{round.computerPoints > 0 ? `+${round.computerPoints}` : '0'}</strong>
        </div>
        <HandCards cards={round.computerHand} />
      </div>
      <div className="round-verdict">
        <small>第 {round.round} 轮</small>
        <strong>{outcomeLabel(round)}</strong>
        <p>{round.reason}</p>
      </div>
      <div className={`revealed-hand ${round.winner === 'player' ? 'winner' : ''}`}>
        <div className="revealed-title">
          <span>你 · {CATEGORY_LABELS[round.playerCategory]}</span>
          <strong>{round.playerPoints > 0 ? `+${round.playerPoints}` : '0'}</strong>
        </div>
        <HandCards cards={round.playerHand} />
      </div>
    </section>
  )
}

interface BattleScreenProps {
  game: GameState
  onPlay: (category: HandCategory) => void
}

export function BattleScreen({ game, onPlay }: BattleScreenProps) {
  const [selected, setSelected] = useState<HandCategory | null>(null)
  const lastRound = game.rounds.at(-1)
  useEffect(() => setSelected(null), [game.rounds.length])

  return (
    <main className="battle-screen">
      <section className="battle-scorebar">
        <div className="round-counter">
          <p className="eyebrow">PHASE 02 · BATTLE</p>
          <h1>第 {game.rounds.length + 1} <span>/ 10</span> 轮</h1>
        </div>
        <div className="score-display" aria-label={`你${game.playerScore}分，电脑${game.computerScore}分`}>
          <div><span>你</span><strong>{game.playerScore}</strong></div>
          <em>:</em>
          <div><span>电脑</span><strong>{game.computerScore}</strong></div>
        </div>
        <div className="computer-status"><span className="pulse-dot" /> 电脑已锁定出牌</div>
      </section>

      <section className="opponent-remaining">
        <span>电脑剩余</span>
        <div className="category-chips">
          {game.computerRemaining.map((category) => (
            <span key={category}>{CATEGORY_SHORT_LABELS[category]}</span>
          ))}
        </div>
        <small>具体牌面将在揭晓时公开</small>
      </section>

      <RevealBoard round={lastRound} />

      <section className="play-selector">
        <div className="selector-heading">
          <div>
            <p className="eyebrow">CHOOSE YOUR HAND</p>
            <h2>选择本轮要出的牌组</h2>
          </div>
          <p>{selected ? `已选择「${CATEGORY_LABELS[selected]}」，确认后与电脑同时揭晓。` : '电脑无法看到你本轮的选择。'}</p>
        </div>
        <div className="battle-hand-grid">
          {game.playerRemaining.map((category) => {
            const cards = game.playerGroups[category]
            const evaluation = evaluateHand(cards)
            return (
              <button
                type="button"
                key={category}
                className={`battle-hand-option ${selected === category ? 'selected' : ''}`}
                onClick={() => setSelected(category)}
                aria-pressed={selected === category}
              >
                <span className="battle-option-top">
                  <span><b>{CATEGORY_LABELS[category]}</b><small>最高 {evaluation.scoreValue} 分</small></span>
                  <i>{selected === category ? '✓' : ''}</i>
                </span>
                <HandCards cards={cards} compact />
              </button>
            )
          })}
        </div>
        <div className="play-action-bar">
          <span>{10 - game.playerRemaining.length} 组已使用 · {game.playerRemaining.length} 组待出</span>
          <button className="primary-button" type="button" disabled={!selected} onClick={() => selected && onPlay(selected)}>
            确认出牌，同时揭晓 <span>↗</span>
          </button>
        </div>
      </section>

      {game.rounds.length > 0 && (
        <details className="round-history">
          <summary>查看本局战报 <span>{game.rounds.length} / 10</span></summary>
          <div className="history-table">
            {game.rounds.slice().reverse().map((round) => (
              <div key={round.round}>
                <span>#{round.round}</span>
                <span>{CATEGORY_LABELS[round.playerCategory]}</span>
                <strong className={`history-${round.winner}`}>{round.winner === 'player' ? '胜' : round.winner === 'computer' ? '负' : '平'}</strong>
                <span>{CATEGORY_LABELS[round.computerCategory]}</span>
                <b>{round.playerPoints} : {round.computerPoints}</b>
              </div>
            ))}
          </div>
        </details>
      )}
    </main>
  )
}
