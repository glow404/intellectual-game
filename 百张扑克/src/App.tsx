import { useEffect, useRef, useState } from 'react'
import { BattleScreen } from './components/BattleScreen'
import { BuildScreen } from './components/BuildScreen'
import { Header } from './components/Header'
import { ResultScreen } from './components/ResultScreen'
import { RulesModal } from './components/RulesModal'
import { DIFFICULTY_LABELS } from './game/constants'
import {
  clearPlayerGroup,
  createInitialGameState,
  moveCardToGroup,
  removeCardFromGroups,
  resolveRound,
  startBattle,
} from './game/state'
import { loadGameState, loadStats, recordResult, saveGameState, saveStats } from './game/storage'
import type { Difficulty, GameState, HandCategory } from './game/types'

function randomSeed(): number {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0]
}

function initialGame(): GameState {
  return loadGameState() ?? createInitialGameState('normal', randomSeed())
}

export default function App() {
  const [game, setGame] = useState<GameState>(initialGame)
  const [stats, setStats] = useState(loadStats)
  const [showRules, setShowRules] = useState(false)
  const recordedMatches = useRef(new Set<string>())

  useEffect(() => {
    saveGameState(game)
  }, [game])

  useEffect(() => {
    if (game.phase !== 'result' || game.statsRecorded || recordedMatches.current.has(game.matchId)) return
    recordedMatches.current.add(game.matchId)
    const nextStats = recordResult(game, stats)
    saveStats(nextStats)
    setStats(nextStats)
    setGame((current) => current.matchId === game.matchId ? { ...current, statsRecorded: true } : current)
  }, [game, stats])

  const newGame = (skipConfirm = false): void => {
    const hasProgress = game.phase !== 'build' || Object.values(game.playerGroups).some((cards) => cards.length > 0)
    if (!skipConfirm && hasProgress && !window.confirm('当前进度会被新游戏替换，确定继续吗？')) return
    setGame(createInitialGameState(game.difficulty, randomSeed()))
  }

  const changeDifficulty = (difficulty: Difficulty): void => {
    setGame((current) => ({ ...current, difficulty, updatedAt: Date.now() }))
  }

  const playRound = (category: HandCategory): void => {
    setGame((current) => resolveRound(current, category))
  }

  const currentStats = stats[game.difficulty]

  return (
    <div className="app-shell">
      <Header
        phase={game.phase}
        difficulty={game.difficulty}
        onDifficultyChange={changeDifficulty}
        onNewGame={() => newGame(false)}
        onShowRules={() => setShowRules(true)}
      />

      {game.phase === 'build' && (
        <BuildScreen
          game={game}
          onMoveCard={(cardId, category) => setGame((current) => moveCardToGroup(current, cardId, category))}
          onRemoveCard={(cardId) => setGame((current) => removeCardFromGroups(current, cardId))}
          onClearGroup={(category) => setGame((current) => clearPlayerGroup(current, category))}
          onStartBattle={() => setGame((current) => startBattle(current))}
        />
      )}
      {game.phase === 'battle' && <BattleScreen game={game} onPlay={playRound} />}
      {game.phase === 'result' && <ResultScreen game={game} onRematch={() => newGame(true)} />}

      <footer className="app-footer">
        <span>本局自动保存于此浏览器</span>
        <span className="footer-divider" />
        <span>{DIFFICULTY_LABELS[game.difficulty]}难度战绩：{currentStats.wins}胜 · {currentStats.losses}负 · {currentStats.ties}平</span>
        <span className="footer-divider" />
        <span>十手牌 · 本地单机版</span>
      </footer>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
