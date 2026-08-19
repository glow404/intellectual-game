import { CATEGORY_LABELS } from '../game/constants'
import { HAND_CATEGORIES } from '../game/types'

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="rules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="关闭规则">×</button>
        <p className="eyebrow">HOW TO PLAY</p>
        <h2 id="rules-title">一副牌，十手暗战</h2>
        <div className="rules-grid">
          <div>
            <span className="rule-number">01</span>
            <h3>先组牌</h3>
            <p>从自己的52张牌中使用50张，分别组成十种指定牌型，每组正好五张，最后留下两张。</p>
          </div>
          <div>
            <span className="rule-number">02</span>
            <h3>再暗选</h3>
            <p>双方进行十轮对战。电脑会先暗中选好牌组，你再从剩余牌组中出一组，随后同时揭晓。</p>
          </div>
          <div>
            <span className="rule-number">03</span>
            <h3>赢取点数</h3>
            <p>赢家获得该组五张牌中的最大点数，A为14分。完全相同则双方均不得分。</p>
          </div>
        </div>
        <div className="ranking-strip" aria-label="牌型由大到小">
          {HAND_CATEGORIES.map((category, index) => (
            <span key={category}><b>{10 - index}</b>{CATEGORY_LABELS[category]}</span>
          ))}
        </div>
        <p className="rules-note">同类牌先按德州扑克点数顺序比较；完全同点时，依关键牌和踢脚牌顺序逐张比较花色：♠ &gt; ♥ &gt; ♦ &gt; ♣。A2345是5高顺子，但获胜仍得14分。</p>
        <button className="primary-button modal-confirm" type="button" onClick={onClose}>明白了，开始游戏</button>
      </section>
    </div>
  )
}
