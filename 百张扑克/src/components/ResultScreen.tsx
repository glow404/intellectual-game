import { CATEGORY_LABELS, DIFFICULTY_LABELS } from '../game/constants'
import type { GameState } from '../game/types'
import { HandCards } from './PlayingCard'

export function ResultScreen({ game, onRematch }: { game: GameState; onRematch: () => void }) {
  const outcome = game.playerScore > game.computerScore ? 'victory' : game.playerScore < game.computerScore ? 'defeat' : 'tie'
  const outcomeText = outcome === 'victory' ? '你赢下了这场暗战' : outcome === 'defeat' ? '电脑守住了牌桌' : '双方势均力敌'
  const roundsWon = game.rounds.filter((round) => round.winner === 'player').length
  const roundsLost = game.rounds.filter((round) => round.winner === 'computer').length

  return (
    <main className={`result-screen result-${outcome}`}>
      <section className="result-hero">
        <p className="eyebrow">MATCH COMPLETE · {DIFFICULTY_LABELS[game.difficulty]}难度</p>
        <span className="result-symbol">{outcome === 'victory' ? '♠' : outcome === 'defeat' ? '♣' : '◆'}</span>
        <h1>{outcomeText}</h1>
        <p>{outcome === 'victory' ? '十手布局与出牌时机都站在了你这边。' : outcome === 'defeat' ? '重新调整牌组强度，再读一次电脑的节奏。' : '每一次试探都被对方准确回应。'}</p>
        <div className="final-score">
          <div><span>你</span><strong>{game.playerScore}</strong><small>{roundsWon} 轮获胜</small></div>
          <em>—</em>
          <div><span>电脑</span><strong>{game.computerScore}</strong><small>{roundsLost} 轮获胜</small></div>
        </div>
        <button className="primary-button result-rematch" type="button" onClick={onRematch}>再来一局 <span>↻</span></button>
      </section>

      <section className="result-rounds">
        <div className="panel-heading">
          <div><p className="eyebrow">ROUND BY ROUND</p><h2>十轮明细</h2></div>
          <span>花色同点时 ♠ &gt; ♥ &gt; ♦ &gt; ♣</span>
        </div>
        <div className="result-round-list">
          {game.rounds.map((round) => (
            <article key={round.round} className={`result-round-card result-round-${round.winner}`}>
              <div className="result-round-number">{String(round.round).padStart(2, '0')}</div>
              <div className="result-side">
                <span>你 · {CATEGORY_LABELS[round.playerCategory]}</span>
                <HandCards cards={round.playerHand} compact />
              </div>
              <div className="result-round-outcome">
                <strong>{round.winner === 'player' ? '胜' : round.winner === 'computer' ? '负' : '平'}</strong>
                <span>{round.playerPoints} : {round.computerPoints}</span>
                <small>{round.reason}</small>
              </div>
              <div className="result-side computer-side">
                <span>电脑 · {CATEGORY_LABELS[round.computerCategory]}</span>
                <HandCards cards={round.computerHand} compact />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
