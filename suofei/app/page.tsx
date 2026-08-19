"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameView, PublicCard } from "@/lib/game";

type Session = { code: string; playerId: string };
type ApiResult = { playerId?: string; game: GameView; error?: string };
type Account = { id: string; email: string; displayName: string };
type AuthIntent = "create" | "join" | null;
type SoundEffect = "play" | "bet" | "raise" | "fold" | "win" | "lose" | "tie";

const SESSION_KEY = "suofei-active-room";
const SOUND_KEY = "suofei-sound-enabled";
const MUSIC_TRACKS = [
  { title: "Midnight Tell", src: "/audio/jazz-table.ogg" },
  { title: "Quiet Read", src: "/audio/lofi-table.ogg" },
  { title: "Neon Raise", src: "/audio/electronic-jazz.mp3" },
] as const;

async function requestGame(body: Record<string, unknown>): Promise<ApiResult> {
  const response = await fetch("/api/game", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: "游戏服务返回了无法识别的内容" })) as ApiResult;
  if (!response.ok) throw new Error(data.error || "操作失败，请重试");
  return data;
}

function CardFace({ card, playable = false, onPlay, compact = false }: {
  card: PublicCard;
  playable?: boolean;
  compact?: boolean;
  onPlay?: () => void;
}) {
  const className = `playing-card ${card.red ? "red" : ""} ${playable ? "playable" : ""} ${compact ? "compact" : ""}`;
  const content = (
    <>
      <span className="card-rank">{card.label}</span>
      <b className="card-suit">{card.suit}</b>
      <em>{card.band}</em>
    </>
  );
  if (playable) {
    return <button className={className} type="button" onClick={onPlay} aria-label={`打出 ${card.suit}${card.label}`}>{content}</button>;
  }
  return <div className={className} aria-label={`${card.suit}${card.label}`}>{content}</div>;
}

function OpponentIntel({ up, down, hasPlayed }: { up: number; down: number; hasPlayed: boolean }) {
  return (
    <div className="opponent-intel" aria-label={`对手起手有 ${up} 张 UP 牌、${down} 张 DOWN 牌${hasPlayed ? "，已出一张暗牌" : ""}`}>
      <div className="band-count up"><span>UP</span><strong>×{up}</strong><small>8–A</small></div>
      <div className="band-count down"><span>DOWN</span><strong>×{down}</strong><small>2–7</small></div>
      {hasPlayed && <div className="hidden-card"><b>?</b><small>已出暗牌</small></div>}
      <em>仅显示本局起手数量</em>
    </div>
  );
}

function ChipStack({ amount, label, className }: { amount: number; label: string; className: string }) {
  const visibleChips = Math.max(1, Math.min(7, Math.ceil(amount / 20)));
  return (
    <div className={`wager-spot ${className}`} aria-label={`${label} ${amount} 筹码`}>
      <div className="chip-tower" aria-hidden="true">
        {Array.from({ length: visibleChips }, (_, index) => <i key={index} style={{ bottom: `${index * 4}px` }} />)}
      </div>
      <div><span>{label}</span><strong>{amount}</strong></div>
    </div>
  );
}

function MusicControls({ enabled, title, onToggle, onNext }: {
  enabled: boolean;
  title: string;
  onToggle: () => void;
  onNext: () => void;
}) {
  return (
    <div className="music-controls">
      <button className="music-toggle" type="button" aria-pressed={enabled} onClick={onToggle} title={enabled ? `正在播放：${title}` : "开启背景音乐与音效"}>
        <span aria-hidden="true">{enabled ? "♫" : "♪"}</span><i>{enabled ? title : "声音已关"}</i>
      </button>
      <button className="next-track" type="button" onClick={onNext} disabled={!enabled} aria-label="切换下一首背景音乐" title="下一首">›</button>
    </div>
  );
}

function useTableAudio() {
  const [enabled, setEnabled] = useState(true);
  const [trackIndex, setTrackIndex] = useState(0);
  const enabledRef = useRef(true);
  const trackIndexRef = useRef(0);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureMusic = useCallback((force = false) => {
    if (!force && !enabledRef.current) return;
    if (!musicRef.current) {
      const music = new Audio(MUSIC_TRACKS[trackIndexRef.current].src);
      music.volume = 0.2;
      music.preload = "auto";
      music.addEventListener("ended", () => {
        const next = (trackIndexRef.current + 1) % MUSIC_TRACKS.length;
        trackIndexRef.current = next;
        setTrackIndex(next);
        music.src = MUSIC_TRACKS[next].src;
        if (enabledRef.current) void music.play().catch(() => undefined);
      });
      musicRef.current = music;
    }
    void musicRef.current.play().catch(() => undefined);
  }, []);

  const playEffect = useCallback((kind: SoundEffect) => {
    if (!enabledRef.current || typeof window === "undefined") return;
    const patterns: Record<SoundEffect, Array<[number, number, number]>> = {
      play: [[230, 0, 0.09], [170, 0.07, 0.1]],
      bet: [[330, 0, 0.06], [410, 0.06, 0.07]],
      raise: [[390, 0, 0.07], [520, 0.07, 0.08], [670, 0.14, 0.1]],
      fold: [[210, 0, 0.08], [145, 0.07, 0.13]],
      win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.2]],
      lose: [[260, 0, 0.12], [196, 0.12, 0.2]],
      tie: [[350, 0, 0.1], [350, 0.12, 0.12]],
    };
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    void context.resume();
    const start = context.currentTime;
    for (const [frequency, delay, duration] of patterns[kind]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "win" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start + delay);
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(0.12, start + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + duration + 0.02);
    }
  }, []);

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      if (localStorage.getItem(SOUND_KEY) === "off") {
        enabledRef.current = false;
        setEnabled(false);
      }
    }, 0);
    return () => {
      window.clearTimeout(preferenceTimer);
      musicRef.current?.pause();
      void audioContextRef.current?.close();
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) ensureMusic(true);
    else musicRef.current?.pause();
  }, [ensureMusic]);

  const nextTrack = useCallback(() => {
    const next = (trackIndexRef.current + 1) % MUSIC_TRACKS.length;
    trackIndexRef.current = next;
    setTrackIndex(next);
    if (musicRef.current) musicRef.current.src = MUSIC_TRACKS[next].src;
    ensureMusic();
  }, [ensureMusic]);

  const pauseMusic = useCallback(() => musicRef.current?.pause(), []);
  return { enabled, trackTitle: MUSIC_TRACKS[trackIndex].title, ensureMusic, pauseMusic, playEffect, toggle, nextTrack };
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function phaseCopy(game: GameView) {
  if (game.phase === "waiting") return "等待对手加入房间";
  if (game.phase === "play") {
    if (game.you.played) return "已出牌，等待对手";
    return "选择一张牌出战";
  }
  if (game.phase === "betting") return game.actor === "you" ? "轮到你下注" : "对手正在思考";
  if (game.phase === "result") return "本局结束 · 已各补一张手牌";
  return "整场对局结束";
}

export default function Home() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<AuthIntent>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(20);
  const sessionRef = useRef<Session | null>(null);
  const audioEventRef = useRef("");
  const { enabled: soundEnabled, trackTitle, ensureMusic, pauseMusic, playEffect, toggle: toggleSound, nextTrack } = useTableAudio();

  const saveSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const sync = useCallback(async (active: Session, showError = false) => {
    try {
      const response = await fetch(`/api/game?code=${encodeURIComponent(active.code)}&playerId=${encodeURIComponent(active.playerId)}`, { cache: "no-store" });
      const data = await response.json() as ApiResult;
      if (!response.ok) throw new Error(data.error || "同步失败");
      if (sessionRef.current?.playerId === active.playerId) setGame(data.game);
    } catch (syncError) {
      if (showError) setError(syncError instanceof Error ? syncError.message : "同步失败");
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ account?: Account | null }>)
      .then((data) => setAccount(data.account ?? null))
      .catch(() => setAccount(null));

    let restored: Session | null = null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      restored = raw ? JSON.parse(raw) as Session : null;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
    const restoreTimer = restored?.code && restored?.playerId
      ? window.setTimeout(() => {
          saveSession(restored);
          void sync(restored, true);
        }, 0)
      : null;
    return () => { if (restoreTimer !== null) window.clearTimeout(restoreTimer); };
  }, [saveSession, sync]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => sync(session), 1200);
    return () => window.clearInterval(timer);
  }, [session, sync]);

  useEffect(() => {
    if (!game) {
      audioEventRef.current = "";
      return;
    }
    const latest = game.log[0] ?? "";
    const eventKey = `${game.code}:${game.round}:${game.phase}:${latest}`;
    if (!audioEventRef.current || audioEventRef.current.split(":", 1)[0] !== game.code) {
      audioEventRef.current = eventKey;
      return;
    }
    if (audioEventRef.current === eventKey) return;
    audioEventRef.current = eventKey;

    if (game.phase === "result" && game.result) {
      playEffect(game.result.winner === "you" ? "win" : game.result.winner === "opponent" ? "lose" : "tie");
    } else if (/加注|下注到/.test(latest)) {
      playEffect("raise");
    } else if (/跟注|过牌/.test(latest)) {
      playEffect("bet");
    } else if (/弃牌/.test(latest)) {
      playEffect("fold");
    } else if (/已选择一张牌/.test(latest)) {
      playEffect("play");
    }
  }, [game, playEffect]);

  const begin = async (action: "create" | "join" | "npc", signedInAccount = account) => {
    if (action !== "npc" && !signedInAccount) {
      setAuthIntent(action);
      setAuthOpen(true);
      return;
    }
    if (action === "join" && joinCode.trim().length !== 6) {
      setError("请输入 6 位房间码");
      return;
    }
    const playerName = name.trim() || signedInAccount?.displayName || `游客${Math.floor(1000 + Math.random() * 9000)}`;
    ensureMusic();
    setBusy(true);
    setError("");
    try {
      const data = await requestGame({ action, name: playerName, code: joinCode });
      if (!data.playerId) throw new Error("房间创建失败");
      const next = { code: data.game.code, playerId: data.playerId };
      saveSession(next);
      setGame(data.game);
    } catch (beginError) {
      setError(beginError instanceof Error ? beginError.message : "进入房间失败");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!session) return;
    ensureMusic();
    setBusy(true);
    setError("");
    try {
      const data = await requestGame({ action, code: session.code, playerId: session.playerId, ...payload });
      setGame(data.game);
      if (action === "play" && data.game.mode === "npc") playEffect("play");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
      await sync(session);
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    pauseMusic();
    saveSession(null);
    setGame(null);
    setError("");
  };

  const logout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => null);
    setAccount(null);
  };

  const authenticated = (nextAccount: Account) => {
    const pending = authIntent;
    setAccount(nextAccount);
    setAuthOpen(false);
    setAuthIntent(null);
    if (pending) void begin(pending, nextAccount);
  };

  const copyRoom = async () => {
    if (!game) return;
    await navigator.clipboard.writeText(game.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const toCall = game ? Math.max(0, game.currentBet - game.bets.you) : 0;
  const canRaise = Boolean(game && game.you.chips >= toCall + raiseAmount);
  const status = useMemo(() => game ? phaseCopy(game) : "", [game]);
  const youAreActive = Boolean(game && ((game.phase === "play" && !game.you.played) || (game.phase === "betting" && game.actor === "you")));
  const opponentIsActive = Boolean(game && ((game.phase === "play" && game.you.played && !game.opponent?.hasPlayed) || (game.phase === "betting" && game.actor === "opponent")));

  if (!game) {
    return (
      <main className="lobby-shell">
        <nav className="topbar lobby-nav">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">S</span>
            <div><h1>索菲</h1><p>看穿阵营，藏住点数</p></div>
          </div>
          <div className="lobby-account">
            <MusicControls enabled={soundEnabled} title={trackTitle} onToggle={toggleSound} onNext={nextTrack} />
            {account
              ? <><span className="account-pill"><b>{initials(account.displayName)}</b><i>{account.displayName}</i></span><button className="account-link" type="button" onClick={logout}>退出</button></>
              : <button className="account-button" type="button" onClick={() => { setAuthIntent(null); setAuthOpen(true); }}>邮箱登录 / 注册</button>}
            <button className="text-button" type="button" onClick={() => setRulesOpen(true)}>玩法说明</button>
          </div>
        </nav>

        <section className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">在线心理博弈</span>
            <h2>你只知道<br /><i>起手阵营</i>，<br />猜不到出牌。</h2>
            <p>每人两张牌。开局只公布对手有几张 UP / DOWN，双方暗中选牌，再用下注逼对手说真话。A 最大，但最小的 2 偏偏能吃掉 A。</p>
            <div className="rule-pills" aria-label="核心规则">
              <span><b>DOWN</b> 2–7</span>
              <span><b>UP</b> 8–A</span>
              <span><b>反转</b> 2 &gt; A</span>
            </div>
          </div>

          <div className="entry-card">
            <div className="entry-heading">
              <span>准备入座</span>
              <strong>1000 <small>初始筹码</small></strong>
            </div>
            <label>
              <span>你的昵称（可选）</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={12} placeholder="例如：小明" autoComplete="nickname" />
            </label>
            <button className="primary wide" type="button" disabled={busy} onClick={() => begin("create")}>创建在线房间 <span>{account ? "→" : "需登录"}</span></button>
            <div className="join-divider"><span>或用房间码加入</span></div>
            <div className="code-row">
              <input aria-label="6 位房间码" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="ABC123" maxLength={6} />
              <button className="secondary" type="button" disabled={busy} onClick={() => begin("join")}>加入</button>
            </div>
            <button className="npc-button" type="button" disabled={busy} onClick={() => begin("npc")}><span className="npc-dot" /> 无需登录 · 和 NPC 索菲练一局</button>
            <p className="auth-note">{account ? `已登录：${account.email}` : "真人在线房间使用站内邮箱账号；NPC 模式始终免登录。"}</p>
            {error && <p className="error-message" role="alert">{error}</p>}
          </div>
        </section>

        <section className="how-it-works">
          <article><span>01</span><div><strong>数阵营</strong><p>开局只知道对方有几张 UP、几张 DOWN。</p></div></article>
          <article><span>02</span><div><strong>暗出牌</strong><p>对手出牌后，阵营和点数都会保持隐藏。</p></div></article>
          <article><span>03</span><div><strong>下注摊牌</strong><p>过牌、跟注、加注或弃牌；赢家收走全部底池。</p></div></article>
        </section>
        <p className="lobby-footnote">每局结束，双方自动补充一张随机手牌。</p>
        {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
        {authOpen && <AuthModal onClose={() => { setAuthOpen(false); setAuthIntent(null); }} onSuccess={authenticated} />}
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <div><h1>索菲</h1><p>第 {game.round} 局 · {game.mode === "npc" ? "NPC 练习" : "在线对战"}</p></div>
        </div>
        <div className="game-nav-actions">
          <MusicControls enabled={soundEnabled} title={trackTitle} onToggle={toggleSound} onNext={nextTrack} />
          {game.mode === "online" && <button className="room-code" type="button" onClick={copyRoom}><span>房间</span><strong>{game.code}</strong><em>{copied ? "已复制" : "复制"}</em></button>}
          <button className="icon-button" type="button" onClick={() => setRulesOpen(true)} aria-label="查看玩法">?</button>
          <button className="leave-button" type="button" onClick={leave}>离桌</button>
        </div>
      </header>

      <div className="status-ribbon"><span className={`phase-dot ${game.actor === "you" ? "active" : ""}`} />{status}</div>

      <section className="game-table" aria-label="索菲牌桌">
        <div className="felt-lines" aria-hidden="true" />
        <div className={`opponent-zone ${opponentIsActive ? "current-turn" : ""}`}>
          <div className="avatar opponent-avatar">{game.opponent ? initials(game.opponent.name) : "?"}</div>
          <div className="player-meta">
            <strong>{game.opponent?.name ?? "等待对手"}</strong>
            <span>{game.opponent ? `${game.opponent.chips} 筹码` : "分享房间码邀请朋友"}</span>
          </div>
          {opponentIsActive && <span className="turn-badge">行动中</span>}
          <div className="opponent-cards">
            {game.opponent && <OpponentIntel up={game.opponent.startingBands.up} down={game.opponent.startingBands.down} hasPlayed={game.opponent.hasPlayed && game.phase !== "result" && game.phase !== "match-over"} />}
            {!game.opponent && <><div className="empty-card">?</div><div className="empty-card">?</div></>}
          </div>
        </div>

        <div className="pot">
          <span>本轮底池</span>
          <strong>{game.pot}</strong>
          <small>{game.phase === "betting" ? `当前注额 ${game.currentBet}` : "底注 20 / 人"}</small>
        </div>

        {game.phase !== "waiting" && game.phase !== "match-over" && (
          <>
            <ChipStack amount={20 + game.bets.opponent} label={`${game.opponent?.name ?? "对手"}已投入`} className="opponent-wager" />
            <ChipStack amount={20 + game.bets.you} label="你已投入" className="player-wager" />
          </>
        )}

        {game.phase === "betting" && (
          <div className="played-lane" aria-label="已出的牌">
            <div className="mystery-played"><span>?</span><small>对手暗牌</small></div>
            <span className="versus">VS</span>
            {game.you.played && <CardFace card={game.you.played} compact />}
          </div>
        )}

        {(game.phase === "result" || game.phase === "match-over") && game.result && (
          <div className="reveal-lane">
            {game.result.opponentCard ? <CardFace card={game.result.opponentCard} compact /> : <div className="card-placeholder">—</div>}
            <div className={`result-badge ${game.result.winner}`}><span>{game.result.winner === "you" ? "你赢了" : game.result.winner === "opponent" ? "对手获胜" : "平局"}</span><small>{game.result.message}</small></div>
            {game.result.yourCard ? <CardFace card={game.result.yourCard} compact /> : <div className="card-placeholder">—</div>}
          </div>
        )}

        <div className={`player-zone ${youAreActive ? "current-turn" : ""}`}>
          <div className="hand">
            {game.you.hand.map((card) => <CardFace key={card.id} card={card} playable={game.phase === "play" && !game.you.played && !busy} onPlay={() => act("play", { cardId: card.id })} />)}
            {game.you.played && game.phase === "play" && <div className="selected-note"><span>✓</span>已锁定出牌</div>}
          </div>
          <div className="self-meta"><span className="mini-avatar">{initials(game.you.name)}</span><strong>{game.you.name}</strong><em>{game.you.chips} 筹码</em>{youAreActive && <span className="turn-badge">轮到你</span>}</div>
        </div>

        <div className="table-event" aria-live="polite"><span>牌桌动态 · LIVE</span><p>{game.log[0] ?? status}</p></div>
      </section>

      <section className="control-panel">
        {game.phase === "waiting" && (
          <div className="waiting-control">
            <div><span className="eyebrow">邀请对手</span><h2>房间码 {game.code}</h2><p>朋友打开本页，输入房间码即可入座。</p></div>
            <button className="primary" type="button" onClick={copyRoom}>{copied ? "已复制房间码" : "复制房间码"}</button>
          </div>
        )}
        {game.phase === "play" && (
          <div className="play-control"><div><span className="eyebrow">暗牌阶段</span><h2>{game.you.played ? "等对手做出选择" : "哪张牌更能让对手犯错？"}</h2></div><p>牌面会在下注结束后同时揭晓。</p></div>
        )}
        {game.phase === "betting" && game.actor === "opponent" && (
          <div className="thinking-control"><div className="thinking-dots"><i /><i /><i /></div><div><strong>{game.opponent?.name} 正在思考</strong><p>服务器会自动同步对手的行动。</p></div></div>
        )}
        {game.phase === "betting" && game.actor === "you" && (
          <div className="betting-control">
            <div className="bet-summary"><span>需要跟注</span><strong>{toCall}</strong><small>你已投入 {game.bets.you}</small></div>
            <div className="raise-picker" aria-label="选择加注额">
              {[20, 50, 100].map((amount) => <button className={raiseAmount === amount ? "selected" : ""} type="button" key={amount} onClick={() => setRaiseAmount(amount)}>+{amount}</button>)}
            </div>
            <div className="bet-actions">
              <button className="fold" type="button" disabled={busy} onClick={() => act("fold")}>弃牌</button>
              {toCall === 0
                ? <button className="check" type="button" disabled={busy} onClick={() => act("check")}>过牌</button>
                : <button className="check" type="button" disabled={busy} onClick={() => act("call")}>跟注 {Math.min(toCall, game.you.chips)}</button>}
              <button className="raise" type="button" disabled={busy || !canRaise} onClick={() => act("raise", { amount: raiseAmount })}>{game.currentBet ? "加注" : "下注"} +{raiseAmount}</button>
            </div>
          </div>
        )}
        {game.phase === "result" && (
          <div className="result-control"><div><span className="eyebrow">手牌已补充</span><h2>{game.result?.message}</h2><p>下一局底注仍为每人 20 筹码。</p></div><button className="primary" type="button" disabled={busy} onClick={() => act("next")}>开始第 {game.round + 1} 局 →</button></div>
        )}
        {game.phase === "match-over" && (
          <div className="result-control"><div><span className="eyebrow">对局结束</span><h2>{game.result?.message}</h2><p>筹码不足以支付下一局底注。</p></div><button className="primary" type="button" disabled={busy} onClick={() => act("reset")}>重置筹码再来一场</button></div>
        )}
      </section>

      <aside className="table-log"><span>牌桌动态</span><div>{game.log.slice(0, 3).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div></aside>
      {error && <div className="toast" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div>}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </main>
  );
}

function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (account: Account) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, displayName }),
      });
      const data = await response.json().catch(() => ({ error: "登录服务暂时不可用" })) as { account?: Account; error?: string };
      if (!response.ok || !data.account) throw new Error(data.error || "登录失败");
      onSuccess(data.account);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="关闭">×</button>
        <span className="eyebrow">SUOFEI ACCOUNT</span>
        <h2 id="auth-title">{mode === "login" ? "欢迎回来" : "创建游戏账号"}</h2>
        <p className="auth-intro">使用邮箱和密码即可进入真人在线房间，不需要 ChatGPT 账号。</p>
        <div className="auth-tabs" role="tablist" aria-label="登录方式">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => { setMode("login"); setError(""); }}>登录</button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => { setMode("register"); setError(""); }}>注册</button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && <label><span>昵称</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={12} placeholder="牌桌上显示的名字" autoComplete="nickname" /></label>}
          <label><span>邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></label>
          <label><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={72} required /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary wide auth-submit" type="submit" disabled={busy}>{busy ? "请稍候…" : mode === "login" ? "登录并继续" : "注册并继续"}<span>→</span></button>
        </form>
        <p className="privacy-note">密码经加盐哈希后保存；登录状态使用安全的 HttpOnly Cookie。</p>
      </section>
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="关闭">×</button>
        <span className="eyebrow">HOW TO PLAY</span>
        <h2 id="rules-title">索菲怎么玩？</h2>
        <ol>
          <li><b>识别阵营</b><p>每人始终持有两张牌。开局只公布对手有几张 DOWN（2–7）、几张 UP（8–A）。</p></li>
          <li><b>同时出牌</b><p>双方各暗中选择一张。选择完成后，对手看不到你出的阵营和具体点数。</p></li>
          <li><b>下注博弈</b><p>每局底注 20。之后可以过牌、跟注、加注 20 / 50 / 100，或者弃牌。</p></li>
          <li><b>摊牌比较</b><p>普通情况下 A 最大、2 最小；唯一的反转是 2 可以击败 A。同点数平分底池。</p></li>
          <li><b>补充手牌</b><p>每局结束后，双方各随机补一张新牌，手牌数量回到两张。</p></li>
        </ol>
        <div className="special-rule"><span>唯一反转</span><strong>2</strong><i>击败</i><strong>A</strong></div>
        <button className="primary wide" type="button" onClick={onClose}>明白了，开始读心</button>
      </section>
    </div>
  );
}
