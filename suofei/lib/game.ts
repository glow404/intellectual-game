export type Suit = "♠" | "♥" | "♣" | "♦";

export type Card = {
  id: string;
  rank: number;
  suit: Suit;
};

export type Seat = "p1" | "p2";
export type GamePhase = "waiting" | "play" | "betting" | "result" | "match-over";
export type BandCounts = { up: number; down: number };

export type Player = {
  id: string;
  name: string;
  chips: number;
  hand: Card[];
  played: Card | null;
  npc?: boolean;
};

export type RoundResult = {
  winner: Seat | "tie";
  reason: "showdown" | "fold" | "bankrupt";
  message: string;
  p1Card: Card | null;
  p2Card: Card | null;
};

export type InternalGame = {
  code: string;
  mode: "online" | "npc";
  phase: GamePhase;
  round: number;
  pot: number;
  currentBet: number;
  bets: Record<Seat, number>;
  actor: Seat | null;
  checks: number;
  startingBands: Record<Seat, BandCounts>;
  players: { p1: Player; p2: Player | null };
  result: RoundResult | null;
  log: string[];
  updatedAt: number;
};

export type PublicCard = Card & { label: string; band: "UP" | "DOWN"; red: boolean };

export type GameView = {
  code: string;
  mode: "online" | "npc";
  phase: GamePhase;
  round: number;
  pot: number;
  currentBet: number;
  bets: { you: number; opponent: number };
  actor: "you" | "opponent" | null;
  you: {
    seat: Seat;
    name: string;
    chips: number;
    hand: PublicCard[];
    played: PublicCard | null;
  };
  opponent: null | {
    name: string;
    chips: number;
    startingBands: BandCounts;
    hasPlayed: boolean;
    played: PublicCard | null;
    npc: boolean;
  };
  result: null | {
    winner: "you" | "opponent" | "tie";
    reason: RoundResult["reason"];
    message: string;
    yourCard: PublicCard | null;
    opponentCard: PublicCard | null;
  };
  log: string[];
};

const SUITS: Suit[] = ["♠", "♥", "♣", "♦"];
const RANKS = Array.from({ length: 13 }, (_, index) => index + 2);
const ANTE = 20;
const STARTING_CHIPS = 1000;

function randomInt(max: number) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

export function rankLabel(rank: number) {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

export function cardBand(card: Card): "UP" | "DOWN" {
  return card.rank >= 8 ? "UP" : "DOWN";
}

function publicCard(card: Card): PublicCard {
  return {
    ...card,
    label: rankLabel(card.rank),
    band: cardBand(card),
    red: card.suit === "♥" || card.suit === "♦",
  };
}

function countBands(cards: Card[]): BandCounts {
  return cards.reduce<BandCounts>((counts, card) => {
    if (cardBand(card) === "UP") counts.up += 1;
    else counts.down += 1;
    return counts;
  }, { up: 0, down: 0 });
}

function drawCard(excluded: Card[] = []): Card {
  const excludedIds = new Set(excluded.map((card) => card.id));
  const available = RANKS.flatMap((rank) =>
    SUITS.map((suit) => ({ id: `${rank}-${suit}`, rank, suit })),
  ).filter((card) => !excludedIds.has(card.id));
  return available[randomInt(available.length)];
}

function dealHands(game: InternalGame) {
  const p2 = game.players.p2;
  if (!p2) return;
  const used: Card[] = [];
  game.players.p1.hand = [drawCard(used)];
  used.push(game.players.p1.hand[0]);
  game.players.p1.hand.push(drawCard(used));
  used.push(game.players.p1.hand[1]);
  p2.hand = [drawCard(used)];
  used.push(p2.hand[0]);
  p2.hand.push(drawCard(used));
}

function pushLog(game: InternalGame, message: string) {
  game.log = [message, ...game.log].slice(0, 8);
}

function payAnte(game: InternalGame) {
  const p2 = game.players.p2;
  if (!p2) return false;
  if (game.players.p1.chips < ANTE || p2.chips < ANTE) return false;
  game.players.p1.chips -= ANTE;
  p2.chips -= ANTE;
  game.pot = ANTE * 2;
  return true;
}

function prepareRound(game: InternalGame) {
  const p2 = game.players.p2;
  if (!p2) return;
  game.players.p1.played = null;
  p2.played = null;
  game.startingBands = {
    p1: countBands(game.players.p1.hand),
    p2: countBands(p2.hand),
  };
  game.currentBet = 0;
  game.bets = { p1: 0, p2: 0 };
  game.actor = null;
  game.checks = 0;
  game.result = null;
  if (!payAnte(game)) {
    const winner: Seat = game.players.p1.chips >= p2.chips ? "p1" : "p2";
    game.phase = "match-over";
    game.result = {
      winner,
      reason: "bankrupt",
      message: `${game.players[winner]?.name ?? "玩家"} 赢得整场对局`,
      p1Card: null,
      p2Card: null,
    };
    return;
  }
  game.phase = "play";
  pushLog(game, `第 ${game.round} 局开始，双方投入底注 ${ANTE}`);
}

export function createGame(code: string, name: string, mode: "online" | "npc", playerId: string): InternalGame {
  const game: InternalGame = {
    code,
    mode,
    phase: mode === "online" ? "waiting" : "play",
    round: 1,
    pot: 0,
    currentBet: 0,
    bets: { p1: 0, p2: 0 },
    actor: null,
    checks: 0,
    startingBands: { p1: { up: 0, down: 0 }, p2: { up: 0, down: 0 } },
    players: {
      p1: { id: playerId, name: cleanName(name), chips: STARTING_CHIPS, hand: [], played: null },
      p2: mode === "npc"
        ? { id: "npc", name: "索菲", chips: STARTING_CHIPS, hand: [], played: null, npc: true }
        : null,
    },
    result: null,
    log: mode === "online" ? ["房间已创建，等待对手加入"] : ["NPC 索菲已入座"],
    updatedAt: Date.now(),
  };
  if (mode === "npc") {
    dealHands(game);
    prepareRound(game);
  }
  return game;
}

export function joinGame(game: InternalGame, name: string, playerId: string) {
  if (game.mode !== "online") throw new Error("这个房间不接受在线玩家");
  if (game.players.p2) throw new Error("房间已经满员");
  game.players.p2 = {
    id: playerId,
    name: cleanName(name),
    chips: STARTING_CHIPS,
    hand: [],
    played: null,
  };
  dealHands(game);
  pushLog(game, `${game.players.p2.name} 已加入房间`);
  prepareRound(game);
}

function cleanName(name: string) {
  const value = name.trim().replace(/[<>]/g, "").slice(0, 12);
  return value || "神秘玩家";
}

export function seatFor(game: InternalGame, playerId: string): Seat {
  if (game.players.p1.id === playerId) return "p1";
  if (game.players.p2?.id === playerId) return "p2";
  throw new Error("玩家凭证无效，请重新加入房间");
}

function otherSeat(seat: Seat): Seat {
  return seat === "p1" ? "p2" : "p1";
}

function playerAt(game: InternalGame, seat: Seat): Player {
  const player = game.players[seat];
  if (!player) throw new Error("对手尚未加入");
  return player;
}

function transitionToBetting(game: InternalGame) {
  game.phase = "betting";
  game.actor = game.round % 2 === 1 ? "p1" : "p2";
  game.checks = 0;
  pushLog(game, `${playerAt(game, game.actor).name} 先行动`);
  if (game.mode === "npc" && game.actor === "p2") npcTurn(game);
}

function chooseNpcCard(hand: Card[]) {
  if (hand.length === 1) return hand[0];
  const high = [...hand].sort((a, b) => b.rank - a.rank)[0];
  const low = hand.find((card) => card.id !== high.id) ?? high;
  const bluff = randomInt(100) < 28;
  return bluff ? low : high;
}

function playCard(game: InternalGame, seat: Seat, cardId: string) {
  if (game.phase !== "play") throw new Error("现在不是出牌阶段");
  const player = playerAt(game, seat);
  if (player.played) throw new Error("你已经出过牌了");
  const card = player.hand.find((item) => item.id === cardId);
  if (!card) throw new Error("手牌不存在");
  player.played = card;
  player.hand = player.hand.filter((item) => item.id !== cardId);
  pushLog(game, `${player.name} 已选择一张牌`);

  if (game.mode === "npc" && seat === "p1") {
    const npc = playerAt(game, "p2");
    const npcCard = chooseNpcCard(npc.hand);
    npc.played = npcCard;
    npc.hand = npc.hand.filter((item) => item.id !== npcCard.id);
    pushLog(game, "索菲已选择一张牌");
  }

  if (game.players.p1.played && game.players.p2?.played) transitionToBetting(game);
}

function commitChips(game: InternalGame, seat: Seat, amount: number) {
  const player = playerAt(game, seat);
  const paid = Math.min(player.chips, amount);
  player.chips -= paid;
  game.bets[seat] += paid;
  game.pot += paid;
  return paid;
}

function replenishHands(game: InternalGame) {
  const p2 = game.players.p2;
  if (!p2) return;
  const excluded = [
    ...game.players.p1.hand,
    ...p2.hand,
    ...(game.players.p1.played ? [game.players.p1.played] : []),
    ...(p2.played ? [p2.played] : []),
  ];
  while (game.players.p1.hand.length < 2) {
    const card = drawCard(excluded);
    game.players.p1.hand.push(card);
    excluded.push(card);
  }
  while (p2.hand.length < 2) {
    const card = drawCard(excluded);
    p2.hand.push(card);
    excluded.push(card);
  }
}

export function compareCards(a: Card, b: Card) {
  if (a.rank === b.rank) return 0;
  if (a.rank === 2 && b.rank === 14) return 1;
  if (a.rank === 14 && b.rank === 2) return -1;
  return a.rank > b.rank ? 1 : -1;
}

function finishShowdown(game: InternalGame) {
  const p1 = game.players.p1;
  const p2 = playerAt(game, "p2");
  if (!p1.played || !p2.played) throw new Error("双方还没有完成出牌");
  const comparison = compareCards(p1.played, p2.played);
  let winner: Seat | "tie" = "tie";
  let message = `平局，双方各收回 ${Math.floor(game.pot / 2)} 筹码`;
  if (comparison > 0) {
    winner = "p1";
    message = `${p1.name} 赢下 ${game.pot} 筹码`;
    p1.chips += game.pot;
  } else if (comparison < 0) {
    winner = "p2";
    message = `${p2.name} 赢下 ${game.pot} 筹码`;
    p2.chips += game.pot;
  } else {
    const half = Math.floor(game.pot / 2);
    p1.chips += half;
    p2.chips += game.pot - half;
  }
  game.result = { winner, reason: "showdown", message, p1Card: p1.played, p2Card: p2.played };
  game.phase = "result";
  game.actor = null;
  pushLog(game, `摊牌：${rankLabel(p1.played.rank)} 对 ${rankLabel(p2.played.rank)} · ${message}`);
  replenishHands(game);
}

function finishFold(game: InternalGame, folder: Seat) {
  const winner = otherSeat(folder);
  const winningPlayer = playerAt(game, winner);
  winningPlayer.chips += game.pot;
  const p2 = playerAt(game, "p2");
  game.result = {
    winner,
    reason: "fold",
    message: `${playerAt(game, folder).name} 弃牌，${winningPlayer.name} 收下 ${game.pot} 筹码`,
    p1Card: game.players.p1.played,
    p2Card: p2.played,
  };
  game.phase = "result";
  game.actor = null;
  pushLog(game, game.result.message);
  replenishHands(game);
}

function raiseBet(game: InternalGame, seat: Seat, amount: number) {
  if (![20, 50, 100].includes(amount)) throw new Error("请选择有效的加注额");
  const target = game.currentBet + amount;
  const needed = target - game.bets[seat];
  const player = playerAt(game, seat);
  if (player.chips < needed) throw new Error("筹码不足，无法完成这次加注");
  commitChips(game, seat, needed);
  game.currentBet = target;
  game.checks = 0;
  game.actor = otherSeat(seat);
  pushLog(game, `${player.name} 加注到 ${target}`);
}

function callBet(game: InternalGame, seat: Seat) {
  const needed = Math.max(0, game.currentBet - game.bets[seat]);
  const player = playerAt(game, seat);
  const paid = commitChips(game, seat, needed);
  pushLog(game, `${player.name} 跟注 ${paid}`);
  finishShowdown(game);
}

function checkBet(game: InternalGame, seat: Seat) {
  if (game.bets[seat] !== game.currentBet) throw new Error("需要先跟注或弃牌");
  game.checks += 1;
  pushLog(game, `${playerAt(game, seat).name} 过牌`);
  if (game.checks >= 2) {
    finishShowdown(game);
  } else {
    game.actor = otherSeat(seat);
  }
}

function npcStrength(card: Card | null) {
  if (!card) return 0;
  if (card.rank === 2) return 8;
  return card.rank;
}

function npcTurn(game: InternalGame) {
  if (game.phase !== "betting" || game.actor !== "p2") return;
  const npc = playerAt(game, "p2");
  const toCall = Math.max(0, game.currentBet - game.bets.p2);
  const strength = npcStrength(npc.played);
  const roll = randomInt(100);

  if (toCall > 0) {
    const pressure = toCall / Math.max(1, game.pot);
    if (strength <= 6 && pressure > 0.22 && roll < 58) {
      finishFold(game, "p2");
      return;
    }
    const raiseAmount = strength >= 11 && npc.chips >= toCall + 20 && roll < 28 ? 20 : 0;
    if (raiseAmount) {
      raiseBet(game, "p2", raiseAmount);
      return;
    }
    callBet(game, "p2");
    return;
  }

  const shouldRaise = (strength >= 11 && roll < 72) || (strength >= 8 && roll < 28);
  if (shouldRaise && npc.chips >= 20) {
    const amount = strength >= 13 && npc.chips >= 50 && roll < 38 ? 50 : 20;
    raiseBet(game, "p2", amount);
  } else {
    checkBet(game, "p2");
  }
}

export function applyAction(game: InternalGame, playerId: string, action: string, payload: Record<string, unknown>) {
  const seat = seatFor(game, playerId);
  if (game.mode === "npc" && seat !== "p1") throw new Error("NPC 不接受外部操作");

  if (action === "play") {
    playCard(game, seat, String(payload.cardId ?? ""));
  } else if (action === "check") {
    if (game.phase !== "betting" || game.actor !== seat) throw new Error("还没轮到你行动");
    checkBet(game, seat);
    if (game.mode === "npc" && game.actor === "p2") npcTurn(game);
  } else if (action === "call") {
    if (game.phase !== "betting" || game.actor !== seat) throw new Error("还没轮到你行动");
    callBet(game, seat);
  } else if (action === "raise") {
    if (game.phase !== "betting" || game.actor !== seat) throw new Error("还没轮到你行动");
    raiseBet(game, seat, Number(payload.amount));
    if (game.mode === "npc" && game.actor === "p2") npcTurn(game);
  } else if (action === "fold") {
    if (game.phase !== "betting" || game.actor !== seat) throw new Error("还没轮到你行动");
    finishFold(game, seat);
  } else if (action === "next") {
    if (game.phase !== "result") throw new Error("本局尚未结束");
    game.round += 1;
    prepareRound(game);
    if (game.mode === "npc" && (game.phase as GamePhase) === "play") pushLog(game, "索菲正在观察你的手牌阵营");
  } else if (action === "reset") {
    const p2 = playerAt(game, "p2");
    game.players.p1.chips = STARTING_CHIPS;
    p2.chips = STARTING_CHIPS;
    game.players.p1.hand = [];
    p2.hand = [];
    game.round = 1;
    dealHands(game);
    prepareRound(game);
  } else {
    throw new Error("未知操作");
  }
  game.updatedAt = Date.now();
}

export function viewFor(game: InternalGame, playerId: string): GameView {
  const seat = seatFor(game, playerId);
  const opponentSeat = otherSeat(seat);
  const you = playerAt(game, seat);
  const opponent = game.players[opponentSeat];
  const isReveal = game.phase === "result" || game.phase === "match-over";
  const resultWinner = game.result?.winner === "tie"
    ? "tie"
    : game.result?.winner === seat
      ? "you"
      : "opponent";
  const legacyStartingCards = opponent
    ? (opponent.played ? [opponent.played, ...opponent.hand].slice(0, 2) : opponent.hand.slice(0, 2))
    : [];
  const opponentStartingBands = game.startingBands?.[opponentSeat] ?? countBands(legacyStartingCards);

  return {
    code: game.code,
    mode: game.mode,
    phase: game.phase,
    round: game.round,
    pot: game.pot,
    currentBet: game.currentBet,
    bets: { you: game.bets[seat], opponent: game.bets[opponentSeat] },
    actor: game.actor === null ? null : game.actor === seat ? "you" : "opponent",
    you: {
      seat,
      name: you.name,
      chips: you.chips,
      hand: you.hand.map(publicCard),
      played: you.played ? publicCard(you.played) : null,
    },
    opponent: opponent
      ? {
          name: opponent.name,
          chips: opponent.chips,
          startingBands: opponentStartingBands,
          hasPlayed: Boolean(opponent.played),
          played: isReveal && opponent.played ? publicCard(opponent.played) : null,
          npc: Boolean(opponent.npc),
        }
      : null,
    result: game.result
      ? {
          winner: resultWinner,
          reason: game.result.reason,
          message: game.result.message,
          yourCard: seat === "p1"
            ? (game.result.p1Card ? publicCard(game.result.p1Card) : null)
            : (game.result.p2Card ? publicCard(game.result.p2Card) : null),
          opponentCard: seat === "p1"
            ? (game.result.p2Card ? publicCard(game.result.p2Card) : null)
            : (game.result.p1Card ? publicCard(game.result.p1Card) : null),
        }
      : null,
    log: game.log,
  };
}

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}
