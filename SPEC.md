# chess-ai 项目规格说明

## 目标
纯 JavaScript 实现的国际象棋引擎 + 单文件网页对弈 UI。零依赖，Node 22 可跑测试，浏览器可玩。

## 文件布局
- `engine.js` — 引擎核心（UMD 风格：Node `module.exports` + 浏览器 `window.ChessEngine` 双兼容）
- `test/perft.test.js` — perft 正确性测试，`node test/perft.test.js` 运行，全过输出 `ALL PASS` 并 exit 0，任一失败 exit 1
- `test/search.test.js` — 搜索冒烟测试（能找到 mate-in-1 / mate-in-2、不走送子等）
- `index.html` — 对弈 UI（内联全部 CSS/JS，通过 `<script src="engine.js">` 引入引擎）

## engine.js 公开接口（挂在 ChessEngine 对象上）
```js
const g = new ChessEngine.Game();            // 默认初始局面
g.loadFEN(fen);                              // 载入 FEN，非法则 throw
g.getFEN();                                  // 导出完整 FEN（含半回合钟/回合数）
g.turn();                                    // 'w' | 'b'
g.legalMoves();                              // 合法着法数组，元素形如 {from:'e2', to:'e4', promotion?:'q'|'r'|'b'|'n', flags}
g.move({from,to,promotion});                 // 走子，非法返回 null，合法返回着法对象（含 san 字段）
g.undo();                                    // 悔棋一步
g.isCheck(); g.isCheckmate(); g.isStalemate();
g.isDraw();                                  // 五十步 / 三次重复 / 子力不足
g.gameOver();                                // 布尔
g.perft(depth);                              // 返回节点数（用于验收）
g.search({depth} 或 {timeMs});               // 返回 {move, score, depth, nodes}；score 以走棋方视角、厘兵为单位，mate 用 ±(100000-ply)
g.history();                                 // SAN 字符串数组
```

## 引擎技术要求
- 棋盘表示：0x88 或 120 格 mailbox 均可，重点是正确
- 走法生成必须完整覆盖：王车易位（含路径受攻击判定）、吃过路兵、升变（Q/R/B/N 四种）、双步兵
- 合法性：make/unmake 后检查己方王是否被将军，或增量攻击检测
- 搜索：迭代加深 + alpha-beta + 静态搜索（quiescence，至少吃子扩展）+ MVV-LVA 排序 + 置换表（Zobrist 哈希）+ 杀手着法
- 评估：子力价值 + 每兵种 piece-square table（中局/残局王表可插值或简单二选一）
- 性能目标：初始局面 perft(5) 在 Node 下 < 30 秒；search 深度 5 在普通局面 < 5 秒

## perft 验收基准（必须全部精确匹配）
| 局面 | FEN | 深度 | 节点数 |
|---|---|---|---|
| 初始局面 | startpos | 1..5 | 20, 400, 8902, 197281, 4865609 |
| Kiwipete | r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - | 1..4 | 48, 2039, 97862, 4085603 |
| 局面3 | 8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - | 1..5 | 14, 191, 2812, 43238, 674624 |
| 局面4 | r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1 | 1..4 | 6, 264, 9467, 422333 |
| 局面5 | rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8 | 1..4 | 44, 1486, 62379, 2103487 |
| 局面6 | r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10 | 1..4 | 46, 2079, 89890, 3894594 |

## index.html UI 要求
- 8x8 棋盘（CSS grid），Unicode 棋子字符，点击选中/落子，合法目标格高亮
- 玩家执白 vs 引擎执黑（可切换先后手、可选引擎思考时间 0.5s/1s/3s）
- 显示：当前局面 FEN、着法历史（SAN）、引擎评分与搜索深度、将军/将死/和棋提示
- 悔棋按钮（一次撤销双方各一步）、新局按钮
- 引擎在 Web Worker 中跑（用 Blob URL 内联创建 worker，加载同目录 engine.js 的源码字符串或 importScripts），避免卡 UI；若实现困难可用 setTimeout 让出主线程，但要保证 UI 不冻结超过所选思考时间
- 深色/浅色主题自适应；所有注释和界面文案用中文

## 语言规则
所有代码注释、README、文档一律用简体中文；标识符用英文。
