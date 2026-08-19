import { DIFFICULTY_LABELS } from '../game/constants'
import type { Difficulty, GamePhase } from '../game/types'

interface HeaderProps {
  phase: GamePhase
  difficulty: Difficulty
  onDifficultyChange: (difficulty: Difficulty) => void
  onNewGame: () => void
  onShowRules: () => void
}

export function Header({ phase, difficulty, onDifficultyChange, onNewGame, onShowRules }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand" aria-label="十手牌">
        <span className="brand-mark">10</span>
        <span>
          <strong>十手牌</strong>
          <small>POKER TEN</small>
        </span>
      </div>
      <nav className="header-actions" aria-label="游戏设置">
        <label className="difficulty-control">
          <span>电脑难度</span>
          <select
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value as Difficulty)}
            disabled={phase !== 'build'}
            aria-label="电脑难度"
          >
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((level) => (
              <option key={level} value={level}>{DIFFICULTY_LABELS[level]}</option>
            ))}
          </select>
        </label>
        <button className="text-button" type="button" onClick={onShowRules}>规则</button>
        <button className="outline-button" type="button" onClick={onNewGame}>新游戏</button>
      </nav>
    </header>
  )
}
