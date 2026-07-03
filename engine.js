/**
 * chess-ai 引擎核心
 * 纯 JavaScript 实现，0x88 棋盘表示，UMD 风格：
 *   - Node: module.exports = { Game }
 *   - 浏览器: window.ChessEngine = { Game }
 *
 * 公开接口见 SPEC.md。
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  if (typeof root !== 'undefined') {
    root.ChessEngine = mod;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // ------------------------------------------------------------------
  // 常量定义
  // ------------------------------------------------------------------
  const WHITE = 0, BLACK = 1;
  const EMPTY = 0;
  const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;

  const TYPE_LETTER = { [PAWN]: 'P', [KNIGHT]: 'N', [BISHOP]: 'B', [ROOK]: 'R', [QUEEN]: 'Q', [KING]: 'K' };
  const LETTER_TYPE = { P: PAWN, N: KNIGHT, B: BISHOP, R: ROOK, Q: QUEEN, K: KING };

  // 王车易位权限位
  const WK = 1, WQ = 2, BK = 4, BQ = 8;

  // 走子方向偏移量（0x88 表示法）
  const KNIGHT_OFFSETS = [-33, -31, -18, -14, 14, 18, 31, 33];
  const KING_OFFSETS = [-17, -16, -15, -1, 1, 15, 16, 17];
  const BISHOP_OFFSETS = [-17, -15, 15, 17];
  const ROOK_OFFSETS = [-16, -1, 1, 16];
  const QUEEN_OFFSETS = BISHOP_OFFSETS.concat(ROOK_OFFSETS);

  // 王车易位相关格子编号（0x88）
  const E1 = 4, F1 = 5, G1 = 6, H1 = 7, A1 = 0, B1 = 1, C1 = 2, D1 = 3;
  const E8 = 116, F8 = 117, G8 = 118, H8 = 119, A8 = 112, B8 = 113, C8 = 114, D8 = 115;

  function TYPE(code) { return code & 7; }
  function COLOR(code) { return code >> 3; }
  function makePiece(type, color) { return type + color * 8; }
  function RANK(sq) { return sq >> 4; }
  function FILE(sq) { return sq & 7; }
  function sqOnBoard(sq) { return (sq & 0x88) === 0; }

  function sqToAlgebraic(sq) {
    return String.fromCharCode(97 + FILE(sq)) + (RANK(sq) + 1);
  }
  function algebraicToSq(str) {
    if (typeof str !== 'string' || str.length !== 2) return -1;
    const file = str.charCodeAt(0) - 97;
    const rank = parseInt(str[1], 10) - 1;
    if (file < 0 || file > 7 || isNaN(rank) || rank < 0 || rank > 7) return -1;
    return rank * 16 + file;
  }

  // ------------------------------------------------------------------
  // 子力价值 & 位置分表（PST，白方视角，从 rank8 到 rank1 排列）
  // ------------------------------------------------------------------
  const PIECE_VALUE = { [PAWN]: 100, [KNIGHT]: 320, [BISHOP]: 330, [ROOK]: 500, [QUEEN]: 900, [KING]: 0 };

  const PST_PAWN = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0
  ];
  const PST_KNIGHT = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50
  ];
  const PST_BISHOP = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20
  ];
  const PST_ROOK = [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0
  ];
  const PST_QUEEN = [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20
  ];
  const PST_KING = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20
  ];
  const PST = { [PAWN]: PST_PAWN, [KNIGHT]: PST_KNIGHT, [BISHOP]: PST_BISHOP, [ROOK]: PST_ROOK, [QUEEN]: PST_QUEEN, [KING]: PST_KING };

  function pstValue(type, color, sq) {
    const rank = RANK(sq), file = FILE(sq);
    const idx = color === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;
    return PST[type][idx];
  }

  // ------------------------------------------------------------------
  // Zobrist 哈希表（用于置换表 & 重复局面检测）
  // ------------------------------------------------------------------
  function rand31() {
    // 生成一个 31 位随机整数，异或组合后当作哈希片段
    return (Math.random() * 0x7fffffff) | 0;
  }
  // 每个哈希片段由两个独立的 31 位随机数组成，最终组合为 53 位安全整数哈希；
  // 32 位哈希在百万节点级搜索中生日碰撞概率过高，会污染置换表和重复局面判定
  function randPair() {
    return [rand31(), rand31()];
  }
  const ZPIECE = [];
  for (let i = 0; i < 12; i++) {
    const arr = new Array(128);
    for (let sq = 0; sq < 128; sq++) arr[sq] = randPair();
    ZPIECE.push(arr);
  }
  const ZCASTLE = [randPair(), randPair(), randPair(), randPair()]; // 对应 WK, WQ, BK, BQ
  const ZEP = new Array(128);
  for (let sq = 0; sq < 128; sq++) ZEP[sq] = randPair();
  const ZSIDE = randPair();

  function zPieceIndex(type, color) { return (type - 1) + color * 6; }

  // ------------------------------------------------------------------
  // Game 类
  // ------------------------------------------------------------------
  const STARTPOS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const MATE_SCORE = 100000;

  class TimeUp extends Error {}

  class Game {
    constructor(fen) {
      this.loadFEN(fen || STARTPOS_FEN);
    }

    // ------------------------------------------------------------
    // FEN 载入 / 导出
    // ------------------------------------------------------------
    loadFEN(fen) {
      if (typeof fen !== 'string') throw new Error('非法 FEN：必须是字符串');
      const parts = fen.trim().split(/\s+/);
      if (parts.length < 4) throw new Error('非法 FEN：字段不足');
      const [placement, activeColor, castling, epStr] = parts;
      const halfmoveStr = parts[4];
      const fullmoveStr = parts[5];

      const rows = placement.split('/');
      if (rows.length !== 8) throw new Error('非法 FEN：棋盘应有 8 行');

      const board = new Array(128).fill(0);
      for (let r = 0; r < 8; r++) {
        const rankIndex = 7 - r;
        let file = 0;
        for (const ch of rows[r]) {
          if (/[1-8]/.test(ch)) {
            file += parseInt(ch, 10);
          } else if (LETTER_TYPE[ch.toUpperCase()]) {
            if (file > 7) throw new Error('非法 FEN：某行格数超出 8');
            const type = LETTER_TYPE[ch.toUpperCase()];
            const color = ch === ch.toUpperCase() ? WHITE : BLACK;
            board[rankIndex * 16 + file] = makePiece(type, color);
            file++;
          } else {
            throw new Error('非法 FEN：无法识别的字符 ' + ch);
          }
        }
        if (file !== 8) throw new Error('非法 FEN：第 ' + (r + 1) + ' 行格数不等于 8');
      }

      let turnColor;
      if (activeColor === 'w') turnColor = WHITE;
      else if (activeColor === 'b') turnColor = BLACK;
      else throw new Error('非法 FEN：行动方字段必须是 w 或 b');

      let castlingRights = 0;
      if (castling !== '-') {
        for (const ch of castling) {
          if (ch === 'K') castlingRights |= WK;
          else if (ch === 'Q') castlingRights |= WQ;
          else if (ch === 'k') castlingRights |= BK;
          else if (ch === 'q') castlingRights |= BQ;
          else throw new Error('非法 FEN：王车易位字段含非法字符');
        }
      }

      let epSquare = -1;
      if (epStr !== '-') {
        epSquare = algebraicToSq(epStr);
        if (epSquare === -1) throw new Error('非法 FEN：过路兵目标格非法');
        // 与 _make 保持同一规范：仅当行棋方确有兵可实施过路兵吃法时才保留 ep 格
        const victimSq = epSquare + (turnColor === WHITE ? -16 : 16); // 刚双步的敌兵所在格
        const isCapturerPawn = (sq) =>
          sqOnBoard(sq) && board[sq] !== 0 && TYPE(board[sq]) === PAWN && COLOR(board[sq]) === turnColor;
        if (!isCapturerPawn(victimSq - 1) && !isCapturerPawn(victimSq + 1)) epSquare = -1;
      }

      const halfmoveClock = halfmoveStr !== undefined ? parseInt(halfmoveStr, 10) : 0;
      const fullmoveNumber = fullmoveStr !== undefined ? parseInt(fullmoveStr, 10) : 1;
      if (isNaN(halfmoveClock) || isNaN(fullmoveNumber)) throw new Error('非法 FEN：回合计数字段非法');

      // 校验双方各有且仅有一个王
      let wKing = -1, bKing = -1;
      for (let sq = 0; sq < 128; sq++) {
        if (!sqOnBoard(sq) || !board[sq]) continue;
        if (TYPE(board[sq]) === KING) {
          if (COLOR(board[sq]) === WHITE) {
            if (wKing !== -1) throw new Error('非法 FEN：白王数量不为一个');
            wKing = sq;
          } else {
            if (bKing !== -1) throw new Error('非法 FEN：黑王数量不为一个');
            bKing = sq;
          }
        }
      }
      if (wKing === -1 || bKing === -1) throw new Error('非法 FEN：缺少王');

      this.board = board;
      this.turnColor = turnColor;
      this.castlingRights = castlingRights;
      this.epSquare = epSquare;
      this.halfmoveClock = halfmoveClock;
      this.fullmoveNumber = fullmoveNumber;
      this.kingSq = [wKing, bKing];
      this._history = []; // make/unmake 内部栈
      this.moveHistorySAN = [];
      this.positionHistory = [this._computeHash()];
    }

    getFEN() {
      let placement = '';
      for (let r = 0; r < 8; r++) {
        const rankIndex = 7 - r;
        let empty = 0;
        let rowStr = '';
        for (let file = 0; file < 8; file++) {
          const sq = rankIndex * 16 + file;
          const piece = this.board[sq];
          if (!piece) {
            empty++;
          } else {
            if (empty > 0) { rowStr += empty; empty = 0; }
            const letter = TYPE_LETTER[TYPE(piece)];
            rowStr += COLOR(piece) === WHITE ? letter : letter.toLowerCase();
          }
        }
        if (empty > 0) rowStr += empty;
        placement += rowStr;
        if (r < 7) placement += '/';
      }
      const activeColor = this.turnColor === WHITE ? 'w' : 'b';
      let castling = '';
      if (this.castlingRights & WK) castling += 'K';
      if (this.castlingRights & WQ) castling += 'Q';
      if (this.castlingRights & BK) castling += 'k';
      if (this.castlingRights & BQ) castling += 'q';
      if (castling === '') castling = '-';
      const ep = this.epSquare === -1 ? '-' : sqToAlgebraic(this.epSquare);
      return `${placement} ${activeColor} ${castling} ${ep} ${this.halfmoveClock} ${this.fullmoveNumber}`;
    }

    turn() { return this.turnColor === WHITE ? 'w' : 'b'; }

    // ------------------------------------------------------------
    // 攻击检测
    // ------------------------------------------------------------
    _isAttacked(sq, byColor) {
      const board = this.board;
      // 兵攻击
      if (byColor === WHITE) {
        const p1 = sq - 15, p2 = sq - 17;
        if (sqOnBoard(p1) && board[p1] === makePiece(PAWN, WHITE)) return true;
        if (sqOnBoard(p2) && board[p2] === makePiece(PAWN, WHITE)) return true;
      } else {
        const p1 = sq + 15, p2 = sq + 17;
        if (sqOnBoard(p1) && board[p1] === makePiece(PAWN, BLACK)) return true;
        if (sqOnBoard(p2) && board[p2] === makePiece(PAWN, BLACK)) return true;
      }
      // 马攻击
      for (const off of KNIGHT_OFFSETS) {
        const to = sq + off;
        if (sqOnBoard(to) && board[to] === makePiece(KNIGHT, byColor)) return true;
      }
      // 王攻击
      for (const off of KING_OFFSETS) {
        const to = sq + off;
        if (sqOnBoard(to) && board[to] === makePiece(KING, byColor)) return true;
      }
      // 斜线攻击（象/后）
      for (const dir of BISHOP_OFFSETS) {
        let to = sq + dir;
        while (sqOnBoard(to)) {
          const piece = board[to];
          if (piece !== 0) {
            if (COLOR(piece) === byColor && (TYPE(piece) === BISHOP || TYPE(piece) === QUEEN)) return true;
            break;
          }
          to += dir;
        }
      }
      // 直线攻击（车/后）
      for (const dir of ROOK_OFFSETS) {
        let to = sq + dir;
        while (sqOnBoard(to)) {
          const piece = board[to];
          if (piece !== 0) {
            if (COLOR(piece) === byColor && (TYPE(piece) === ROOK || TYPE(piece) === QUEEN)) return true;
            break;
          }
          to += dir;
        }
      }
      return false;
    }

    // ------------------------------------------------------------
    // 伪合法走法生成
    // ------------------------------------------------------------
    _genMoves(color) {
      const board = this.board;
      const moves = [];
      const forward = color === WHITE ? 16 : -16;
      const startRank = color === WHITE ? 1 : 6;
      const promoRank = color === WHITE ? 7 : 0;
      const opponent = 1 - color;
      const capOffsets = color === WHITE ? [15, 17] : [-15, -17];

      for (let sq = 0; sq < 128; sq++) {
        if (!sqOnBoard(sq)) continue;
        const piece = board[sq];
        if (!piece || COLOR(piece) !== color) continue;
        const type = TYPE(piece);

        if (type === PAWN) {
          const one = sq + forward;
          if (sqOnBoard(one) && board[one] === 0) {
            if (RANK(one) === promoRank) {
              for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) {
                moves.push({ from: sq, to: one, piece: PAWN, promotion: promo, flag: 'n', captured: 0 });
              }
            } else {
              moves.push({ from: sq, to: one, piece: PAWN, promotion: 0, flag: 'n', captured: 0 });
              if (RANK(sq) === startRank) {
                const two = sq + forward * 2;
                if (board[two] === 0) {
                  moves.push({ from: sq, to: two, piece: PAWN, promotion: 0, flag: 'd', captured: 0 });
                }
              }
            }
          }
          for (const off of capOffsets) {
            const to = sq + off;
            if (!sqOnBoard(to)) continue;
            const target = board[to];
            if (target !== 0 && COLOR(target) === opponent) {
              if (RANK(to) === promoRank) {
                for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) {
                  moves.push({ from: sq, to, piece: PAWN, promotion: promo, flag: 'c', captured: TYPE(target) });
                }
              } else {
                moves.push({ from: sq, to, piece: PAWN, promotion: 0, flag: 'c', captured: TYPE(target) });
              }
            } else if (to === this.epSquare && this.epSquare !== -1) {
              moves.push({ from: sq, to, piece: PAWN, promotion: 0, flag: 'e', captured: PAWN });
            }
          }
        } else if (type === KNIGHT || type === KING) {
          const offs = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
          for (const off of offs) {
            const to = sq + off;
            if (!sqOnBoard(to)) continue;
            const target = board[to];
            if (target === 0) {
              moves.push({ from: sq, to, piece: type, promotion: 0, flag: 'n', captured: 0 });
            } else if (COLOR(target) === opponent) {
              moves.push({ from: sq, to, piece: type, promotion: 0, flag: 'c', captured: TYPE(target) });
            }
          }
          if (type === KING) this._genCastling(color, moves, sq);
        } else {
          const dirs = type === BISHOP ? BISHOP_OFFSETS : type === ROOK ? ROOK_OFFSETS : QUEEN_OFFSETS;
          for (const dir of dirs) {
            let to = sq + dir;
            while (sqOnBoard(to)) {
              const target = board[to];
              if (target === 0) {
                moves.push({ from: sq, to, piece: type, promotion: 0, flag: 'n', captured: 0 });
                to += dir;
                continue;
              }
              if (COLOR(target) === opponent) {
                moves.push({ from: sq, to, piece: type, promotion: 0, flag: 'c', captured: TYPE(target) });
              }
              break;
            }
          }
        }
      }
      return moves;
    }

    _genCastling(color, moves, kingSq) {
      const board = this.board;
      const them = 1 - color;
      if (color === WHITE) {
        if ((this.castlingRights & WK) && board[F1] === 0 && board[G1] === 0 && board[H1] === makePiece(ROOK, WHITE)) {
          if (!this._isAttacked(E1, them) && !this._isAttacked(F1, them) && !this._isAttacked(G1, them)) {
            moves.push({ from: E1, to: G1, piece: KING, promotion: 0, flag: 'ck', captured: 0 });
          }
        }
        if ((this.castlingRights & WQ) && board[D1] === 0 && board[C1] === 0 && board[B1] === 0 && board[A1] === makePiece(ROOK, WHITE)) {
          if (!this._isAttacked(E1, them) && !this._isAttacked(D1, them) && !this._isAttacked(C1, them)) {
            moves.push({ from: E1, to: C1, piece: KING, promotion: 0, flag: 'cq', captured: 0 });
          }
        }
      } else {
        if ((this.castlingRights & BK) && board[F8] === 0 && board[G8] === 0 && board[H8] === makePiece(ROOK, BLACK)) {
          if (!this._isAttacked(E8, them) && !this._isAttacked(F8, them) && !this._isAttacked(G8, them)) {
            moves.push({ from: E8, to: G8, piece: KING, promotion: 0, flag: 'ck', captured: 0 });
          }
        }
        if ((this.castlingRights & BQ) && board[D8] === 0 && board[C8] === 0 && board[B8] === 0 && board[A8] === makePiece(ROOK, BLACK)) {
          if (!this._isAttacked(E8, them) && !this._isAttacked(D8, them) && !this._isAttacked(C8, them)) {
            moves.push({ from: E8, to: C8, piece: KING, promotion: 0, flag: 'cq', captured: 0 });
          }
        }
      }
    }

    // ------------------------------------------------------------
    // make / unmake
    // ------------------------------------------------------------
    _make(move) {
      const us = this.turnColor;
      const them = 1 - us;
      const board = this.board;
      const fromPiece = board[move.from];

      const undo = {
        move,
        castlingRights: this.castlingRights,
        epSquare: this.epSquare,
        halfmoveClock: this.halfmoveClock,
        capturedPiece: 0,
        capturedSquare: -1,
        prevKingSq: -1
      };

      if (move.flag === 'e') {
        const capSq = move.to + (us === WHITE ? -16 : 16);
        undo.capturedPiece = board[capSq];
        undo.capturedSquare = capSq;
        board[capSq] = 0;
      } else if (board[move.to] !== 0) {
        undo.capturedPiece = board[move.to];
        undo.capturedSquare = move.to;
      }

      board[move.to] = move.promotion ? makePiece(move.promotion, us) : fromPiece;
      board[move.from] = 0;

      if (move.flag === 'ck') {
        const rookFrom = us === WHITE ? H1 : H8;
        const rookTo = us === WHITE ? F1 : F8;
        board[rookTo] = board[rookFrom];
        board[rookFrom] = 0;
      } else if (move.flag === 'cq') {
        const rookFrom = us === WHITE ? A1 : A8;
        const rookTo = us === WHITE ? D1 : D8;
        board[rookTo] = board[rookFrom];
        board[rookFrom] = 0;
      }

      if (TYPE(fromPiece) === KING) {
        undo.prevKingSq = this.kingSq[us];
        this.kingSq[us] = move.to;
      }

      // 更新王车易位权限：任何一方王/车从起始格移动，或车在起始格被吃，都会取消对应权限
      const clearMask = (sq) => {
        if (sq === E1) this.castlingRights &= ~(WK | WQ);
        else if (sq === H1) this.castlingRights &= ~WK;
        else if (sq === A1) this.castlingRights &= ~WQ;
        else if (sq === E8) this.castlingRights &= ~(BK | BQ);
        else if (sq === H8) this.castlingRights &= ~BK;
        else if (sq === A8) this.castlingRights &= ~BQ;
      };
      clearMask(move.from);
      clearMask(move.to);

      // 双步兵仅在确有敌兵可实施过路兵吃法时才记录 ep 格：
      // 幻影 ep 会让本质相同的局面哈希/FEN 不一致，妨碍合法的三次重复判定
      this.epSquare = -1;
      if (move.flag === 'd') {
        const isEnemyPawn = (sq) =>
          sqOnBoard(sq) && board[sq] !== 0 && TYPE(board[sq]) === PAWN && COLOR(board[sq]) === them;
        if (isEnemyPawn(move.to - 1) || isEnemyPawn(move.to + 1)) {
          this.epSquare = move.from + (us === WHITE ? 16 : -16);
        }
      }

      this.halfmoveClock = (TYPE(fromPiece) === PAWN || undo.capturedPiece) ? 0 : this.halfmoveClock + 1;

      if (us === BLACK) this.fullmoveNumber++;

      this.turnColor = them;
      this._history.push(undo);
    }

    _unmake() {
      const undo = this._history.pop();
      const move = undo.move;
      const us = 1 - this.turnColor;
      this.turnColor = us;
      if (us === BLACK) this.fullmoveNumber--;
      this.castlingRights = undo.castlingRights;
      this.epSquare = undo.epSquare;
      this.halfmoveClock = undo.halfmoveClock;

      const board = this.board;
      const movedPiece = move.promotion ? makePiece(PAWN, us) : board[move.to];
      board[move.from] = movedPiece;

      if (move.flag === 'e') {
        board[move.to] = 0;
        board[undo.capturedSquare] = undo.capturedPiece;
      } else {
        board[move.to] = undo.capturedPiece;
      }

      if (move.flag === 'ck') {
        const rookFrom = us === WHITE ? H1 : H8;
        const rookTo = us === WHITE ? F1 : F8;
        board[rookFrom] = board[rookTo];
        board[rookTo] = 0;
      } else if (move.flag === 'cq') {
        const rookFrom = us === WHITE ? A1 : A8;
        const rookTo = us === WHITE ? D1 : D8;
        board[rookFrom] = board[rookTo];
        board[rookTo] = 0;
      }

      if (TYPE(movedPiece) === KING) {
        this.kingSq[us] = undo.prevKingSq;
      }
    }

    // ------------------------------------------------------------
    // 合法走法生成（伪合法 + make/unmake 检查己方王是否被将军）
    // ------------------------------------------------------------
    _generateLegalMoves() {
      const color = this.turnColor;
      const pseudo = this._genMoves(color);
      const legal = [];
      for (const m of pseudo) {
        this._make(m);
        if (!this._isAttacked(this.kingSq[color], 1 - color)) legal.push(m);
        this._unmake();
      }
      return legal;
    }

    legalMoves() {
      return this._generateLegalMoves().map((m) => this._toPublicMove(m));
    }

    _toPublicMove(m) {
      const flagMap = { n: 'n', d: 'b', c: 'c', e: 'e', ck: 'k', cq: 'q' };
      let flags = flagMap[m.flag] || 'n';
      if (m.promotion) flags += 'p';
      const pub = {
        from: sqToAlgebraic(m.from),
        to: sqToAlgebraic(m.to),
        flags
      };
      if (m.promotion) pub.promotion = TYPE_LETTER[m.promotion].toLowerCase();
      return pub;
    }

    // ------------------------------------------------------------
    // SAN 生成
    // ------------------------------------------------------------
    _toSAN(move, legalMovesAtPos) {
      if (move.flag === 'ck') return 'O-O';
      if (move.flag === 'cq') return 'O-O-O';
      const pieceLetter = move.piece === PAWN ? '' : TYPE_LETTER[move.piece];
      let disambig = '';
      if (move.piece !== PAWN) {
        const others = legalMovesAtPos.filter((o) => o !== move && o.piece === move.piece && o.to === move.to);
        if (others.length > 0) {
          const sameFile = others.some((o) => FILE(o.from) === FILE(move.from));
          const sameRank = others.some((o) => RANK(o.from) === RANK(move.from));
          if (!sameFile) disambig = String.fromCharCode(97 + FILE(move.from));
          else if (!sameRank) disambig = String(RANK(move.from) + 1);
          else disambig = sqToAlgebraic(move.from);
        }
      } else if (move.flag === 'c' || move.flag === 'e') {
        disambig = String.fromCharCode(97 + FILE(move.from));
      }
      const capture = (move.flag === 'c' || move.flag === 'e') ? 'x' : '';
      const dest = sqToAlgebraic(move.to);
      const promo = move.promotion ? '=' + TYPE_LETTER[move.promotion] : '';
      return pieceLetter + disambig + capture + dest + promo;
    }

    move(moveSpec) {
      if (!moveSpec || typeof moveSpec.from !== 'string' || typeof moveSpec.to !== 'string') return null;
      const fromSq = algebraicToSq(moveSpec.from);
      const toSq = algebraicToSq(moveSpec.to);
      if (fromSq === -1 || toSq === -1) return null;
      const promoType = moveSpec.promotion ? LETTER_TYPE[moveSpec.promotion.toUpperCase()] : 0;

      const legal = this._generateLegalMoves();
      let found = null;
      for (const m of legal) {
        if (m.from !== fromSq || m.to !== toSq) continue;
        if (m.promotion) {
          if (promoType && m.promotion === promoType) { found = m; break; }
          if (!promoType && m.promotion === QUEEN) { found = m; break; }
        } else if (!promoType) {
          found = m;
          break;
        }
      }
      if (!found) return null;

      const sanBase = this._toSAN(found, legal);
      this._make(found);

      let suffix = '';
      if (this.isCheck()) {
        suffix = this._generateLegalMoves().length === 0 ? '#' : '+';
      }
      const san = sanBase + suffix;
      this.moveHistorySAN.push(san);
      this.positionHistory.push(this._computeHash());

      const pub = this._toPublicMove(found);
      pub.san = san;
      return pub;
    }

    undo() {
      if (this._history.length === 0) return null;
      this._unmake();
      this.moveHistorySAN.pop();
      this.positionHistory.pop();
      return true;
    }

    isCheck() {
      return this._isAttacked(this.kingSq[this.turnColor], 1 - this.turnColor);
    }
    isCheckmate() {
      return this.isCheck() && this._generateLegalMoves().length === 0;
    }
    isStalemate() {
      return !this.isCheck() && this._generateLegalMoves().length === 0;
    }
    isDraw() {
      // 五十步规则：若第 100 个半回合的着法同时完成将杀，则胜负优先于和棋
      if (this.halfmoveClock >= 100 && !this.isCheckmate()) return true;
      const h = this._computeHash();
      let count = 0;
      for (const ph of this.positionHistory) if (ph === h) count++;
      if (count >= 3) return true;
      if (this._insufficientMaterial()) return true;
      return false;
    }
    gameOver() {
      return this.isCheckmate() || this.isStalemate() || this.isDraw();
    }

    _insufficientMaterial() {
      const pieces = [];
      for (let sq = 0; sq < 128; sq++) {
        if (!sqOnBoard(sq) || !this.board[sq]) continue;
        const type = TYPE(this.board[sq]);
        if (type === KING) continue;
        pieces.push({ type, color: COLOR(this.board[sq]), sq });
      }
      if (pieces.length === 0) return true; // 单王对单王
      if (pieces.length === 1 && (pieces[0].type === BISHOP || pieces[0].type === KNIGHT)) return true; // 单象/单马 vs 王
      if (pieces.length === 2 && pieces.every((p) => p.type === BISHOP)) {
        // 双象且颜色相同，各执一方（同色格）视为不足以将死
        const colorOf = (sq) => (RANK(sq) + FILE(sq)) % 2;
        if (pieces[0].color !== pieces[1].color && colorOf(pieces[0].sq) === colorOf(pieces[1].sq)) return true;
      }
      return false;
    }

    history() {
      return this.moveHistorySAN.slice();
    }

    // ------------------------------------------------------------
    // perft
    // ------------------------------------------------------------
    perft(depth) {
      return this._perft(depth);
    }

    _perft(depth) {
      if (depth === 0) return 1;
      const color = this.turnColor;
      const moves = this._genMoves(color);
      let nodes = 0;
      for (const m of moves) {
        this._make(m);
        if (!this._isAttacked(this.kingSq[color], 1 - color)) {
          nodes += depth === 1 ? 1 : this._perft(depth - 1);
        }
        this._unmake();
      }
      return nodes;
    }

    // ------------------------------------------------------------
    // 局面评估
    // ------------------------------------------------------------
    _evaluate() {
      let score = 0;
      const board = this.board;
      for (let sq = 0; sq < 128; sq++) {
        if (!sqOnBoard(sq)) continue;
        const piece = board[sq];
        if (!piece) continue;
        const type = TYPE(piece);
        const color = COLOR(piece);
        const value = PIECE_VALUE[type] + pstValue(type, color, sq);
        score += color === WHITE ? value : -value;
      }
      return this.turnColor === WHITE ? score : -score;
    }

    // ------------------------------------------------------------
    // Zobrist 哈希
    // ------------------------------------------------------------
    _computeHash() {
      let h1 = 0, h2 = 0;
      const board = this.board;
      for (let sq = 0; sq < 128; sq++) {
        if (!sqOnBoard(sq)) continue;
        const piece = board[sq];
        if (!piece) continue;
        const z = ZPIECE[zPieceIndex(TYPE(piece), COLOR(piece))][sq];
        h1 ^= z[0]; h2 ^= z[1];
      }
      if (this.castlingRights & WK) { h1 ^= ZCASTLE[0][0]; h2 ^= ZCASTLE[0][1]; }
      if (this.castlingRights & WQ) { h1 ^= ZCASTLE[1][0]; h2 ^= ZCASTLE[1][1]; }
      if (this.castlingRights & BK) { h1 ^= ZCASTLE[2][0]; h2 ^= ZCASTLE[2][1]; }
      if (this.castlingRights & BQ) { h1 ^= ZCASTLE[3][0]; h2 ^= ZCASTLE[3][1]; }
      if (this.epSquare !== -1) { h1 ^= ZEP[this.epSquare][0]; h2 ^= ZEP[this.epSquare][1]; }
      if (this.turnColor === BLACK) { h1 ^= ZSIDE[0]; h2 ^= ZSIDE[1]; }
      // 组合为 31+22=53 位安全整数（h1 ∈ [0,2^31)，乘 2^22 后仍 < 2^53）
      return (h1 >>> 0) * 0x400000 + ((h2 >>> 0) & 0x3fffff);
    }

    // ------------------------------------------------------------
    // 搜索：迭代加深 + alpha-beta + 静态搜索 + 置换表 + 杀手着法
    // ------------------------------------------------------------
    search(opts) {
      opts = opts || {};
      const maxDepth = opts.depth || 64;
      const deadline = opts.timeMs ? Date.now() + opts.timeMs : null;

      this._tt = new Map();
      this._killers = [];
      for (let i = 0; i < 128; i++) this._killers.push([null, null]);
      this._nodes = 0;
      this._deadline = deadline;

      let bestMove = null;
      let bestScore = 0;
      let completedDepth = 0;

      for (let d = 1; d <= maxDepth; d++) {
        this._rootBestMove = null;
        this._rootBestScore = -Infinity;
        let score;
        try {
          score = this._negamax(d, -Infinity, Infinity, 0);
        } catch (e) {
          if (e instanceof TimeUp) break;
          throw e;
        }
        if (this._rootBestMove) {
          bestMove = this._rootBestMove;
          bestScore = this._rootBestScore;
          completedDepth = d;
        } else {
          bestScore = score;
        }
        // 已经找到杀棋，没必要继续加深
        if (Math.abs(bestScore) > MATE_SCORE - 1000) break;
        if (deadline && Date.now() >= deadline) break;
      }

      return {
        move: bestMove ? this._toPublicMove(bestMove) : null,
        score: bestScore,
        depth: completedDepth,
        nodes: this._nodes
      };
    }

    _moveKey(m) {
      return m.from * 1000 + m.to * 10 + (m.promotion || 0);
    }

    _orderMoves(moves, ttMoveKey, ply) {
      const killers = this._killers[ply] || [null, null];
      const scored = moves.map((m) => {
        let s = 0;
        const key = this._moveKey(m);
        if (ttMoveKey !== null && key === ttMoveKey) {
          s = 1000000;
        } else if (m.captured) {
          s = 100000 + PIECE_VALUE[m.captured] * 10 - PIECE_VALUE[m.piece];
        } else if (killers[0] && this._moveKey(killers[0]) === key) {
          s = 90000;
        } else if (killers[1] && this._moveKey(killers[1]) === key) {
          s = 80000;
        }
        if (m.promotion === QUEEN) s += 5000;
        return { m, s };
      });
      scored.sort((a, b) => b.s - a.s);
      return scored.map((x) => x.m);
    }

    _checkTime() {
      this._nodes++;
      if (this._deadline !== null && (this._nodes & 1023) === 0 && Date.now() >= this._deadline) {
        throw new TimeUp();
      }
    }

    _quiescence(alpha, beta, ply) {
      this._checkTime();
      const color = this.turnColor;
      const inCheck = this._isAttacked(this.kingSq[color], 1 - color);

      // 被将军时不能“停着不动”，stand-pat 下界不成立，必须搜索全部逃将着法；
      // 否则地平线处的将杀会被评成普通材料分，引擎会走入被杀线路
      if (!inCheck) {
        const standPat = this._evaluate();
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;
      }

      const gen = this._genMoves(color);
      const moves = inCheck ? gen : gen.filter((m) => m.captured || m.promotion);
      const ordered = this._orderMoves(moves, null, ply);

      let legalCount = 0;
      for (const m of ordered) {
        this._make(m);
        if (this._isAttacked(this.kingSq[color], 1 - color)) { this._unmake(); continue; }
        legalCount++;
        const score = -this._quiescence(-beta, -alpha, ply + 1);
        this._unmake();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      // 被将军且无任何合法逃将手 => 当前节点即被将杀
      if (inCheck && legalCount === 0) return -(MATE_SCORE - ply);
      return alpha;
    }

    _negamax(depth, alpha, beta, ply) {
      this._checkTime();

      const origAlpha = alpha;
      const hashKey = this._computeHash();
      const ttEntry = this._tt.get(hashKey);
      let ttMoveKey = null;
      if (ttEntry) {
        ttMoveKey = ttEntry.moveKey;
        if (ttEntry.depth >= depth && ply > 0) {
          // 将杀分在表中以“距本节点”编码，取出时换算回“距根”视角（减去当前 ply）
          let ttScore = ttEntry.score;
          if (ttScore > MATE_SCORE - 1000) ttScore -= ply;
          else if (ttScore < -(MATE_SCORE - 1000)) ttScore += ply;
          if (ttEntry.flag === 0) return ttScore;
          if (ttEntry.flag === 1) alpha = Math.max(alpha, ttScore);
          else if (ttEntry.flag === 2) beta = Math.min(beta, ttScore);
          if (alpha >= beta) return ttScore;
        }
      }

      if (depth <= 0) {
        return this._quiescence(alpha, beta, ply);
      }

      const color = this.turnColor;
      const pseudo = this._genMoves(color);
      const ordered = this._orderMoves(pseudo, ttMoveKey, ply);

      let legalCount = 0;
      let bestScore = -Infinity;
      let bestMoveLocal = null;

      for (const m of ordered) {
        this._make(m);
        if (this._isAttacked(this.kingSq[color], 1 - color)) { this._unmake(); continue; }
        legalCount++;
        const score = -this._negamax(depth - 1, -beta, -alpha, ply + 1);
        this._unmake();

        if (score > bestScore) {
          bestScore = score;
          bestMoveLocal = m;
        }
        if (score > alpha) alpha = score;
        if (alpha >= beta) {
          if (!m.captured) {
            const killers = this._killers[ply];
            if (!killers[0] || this._moveKey(killers[0]) !== this._moveKey(m)) {
              killers[1] = killers[0];
              killers[0] = m;
            }
          }
          break;
        }
      }

      if (legalCount === 0) {
        const inCheck = this._isAttacked(this.kingSq[color], 1 - color);
        const score = inCheck ? -(MATE_SCORE - ply) : 0;
        return score;
      }

      const flag = bestScore <= origAlpha ? 2 : bestScore >= beta ? 1 : 0;
      // 将杀分以“距根”视角计算（MATE_SCORE - 杀棋所在 ply），存表前换算成“距本节点”
      // 编码（加回当前 ply），否则同一局面经不同深度换位命中时会得到错误的杀距
      let storeScore = bestScore;
      if (storeScore > MATE_SCORE - 1000) storeScore += ply;
      else if (storeScore < -(MATE_SCORE - 1000)) storeScore -= ply;
      this._tt.set(hashKey, { depth, score: storeScore, flag, moveKey: bestMoveLocal ? this._moveKey(bestMoveLocal) : null });

      if (ply === 0 && bestMoveLocal) {
        this._rootBestMove = bestMoveLocal;
        this._rootBestScore = bestScore;
      }

      return bestScore;
    }
  }

  return { Game };
});
