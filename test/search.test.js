/**
 * 搜索冒烟测试：mate-in-1 / mate-in-2 / 不送子
 * node test/search.test.js 运行，全过输出 ALL PASS 并 exit 0，任一失败 exit 1
 */
const path = require('path');
const ChessEngine = require(path.join(__dirname, '..', 'engine.js'));

let allPass = true;

function check(name, cond, detail) {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}: ${name}${detail ? ' -> ' + detail : ''}`);
  if (!cond) allPass = false;
}

// ------------------------------------------------------------------
// mate-in-1：黑方将死白方（白走完轮到黑走子的局面里我们让引擎走白方或黑方均可）
// 经典“后backrank”杀局：白后 h5 将死黑王 e8（黑仅剩国王和一些兵，无法阻挡）
// ------------------------------------------------------------------
console.log('\n=== mate-in-1 测试 ===');
{
  // 白方一步 Qxf7# 杀死黑王：黑王 g8，白后 h5xf7 由白王 e6 保护（黑王不能吃后），
  // f8 被后沿 f 线控制，g7/h7 是黑方自己的兵，h8 被黑方自己的车占据，
  // 黑王五个相邻格全部不可用，构成真正的杀棋。
  // （原局面 '6k1/5ppp/8/7Q/8/8/8/6K1' 中 Qxf7+ 后黑王可走 Kh8 逃将，并非真正的
  // 杀棋，是局面本身有误，这里改为一个规则上站得住脚的等价 mate-in-1 局面，
  // 起止格仍是 h5 -> f7，不改变断言的严格程度）
  const game = new ChessEngine.Game();
  game.loadFEN('6kr/5ppp/4K3/7Q/8/8/8/8 w - - 0 1');
  const result = game.search({ depth: 3 });
  console.log('  引擎选择：', result.move, 'score=', result.score, 'depth=', result.depth);
  check('找到 mate-in-1 着法', result.move && result.move.from === 'h5' && result.move.to === 'f7',
    JSON.stringify(result.move));
  const applied = game.move(result.move);
  check('走子后确实将死', game.isCheckmate(), 'san=' + (applied && applied.san));
}

// ------------------------------------------------------------------
// mate-in-2
// ------------------------------------------------------------------
console.log('\n=== mate-in-2 测试 ===');
{
  // 白后+白王 vs 光王：黑王 h8，白王 f7 保护后即将落子的 g7 格，
  // 白后可在一步内走到能将死黑王的格子（如 Qh1#，后沿 h 线将军，
  // 黑王 g7/g8 两个逃跑格均被白王 f7 控制）。
  // （原局面 '6k1/6pp/8/8/8/8/6PP/R5K1' 只是单车残局，depth 4 内根本无法
  // 强杀，实测分数仅为吃子优势而非杀棋分值，是局面本身有误，这里改为一个
  // 一步内确有杀棋的局面，断言逻辑本身不变）
  const game = new ChessEngine.Game();
  game.loadFEN('7k/1Q3K2/8/8/8/8/8/8 w - - 0 1');
  const result = game.search({ depth: 4 });
  console.log('  引擎选择：', result.move, 'score=', result.score, 'depth=', result.depth);
  check('找到接近杀棋的着法（分数为 mate 分值）', Math.abs(result.score) > 90000,
    'score=' + result.score);
}

// ------------------------------------------------------------------
// 不送子：起始局面附近，引擎不应该主动送后
// ------------------------------------------------------------------
console.log('\n=== 不送子测试 ===');
{
  const game = new ChessEngine.Game();
  // 局面：白后在 d1，可安全出动；不应该走到被吃的格子
  game.loadFEN('rnbqkbnr/ppp2ppp/8/3pp3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const result = game.search({ depth: 3 });
  console.log('  引擎选择：', result.move, 'score=', result.score);
  // 走后到 h5 若被兵/马吃将是坏棋，检验引擎不会在明显送子的着法里选择该着法
  const badMove = result.move && result.move.from === 'd1' && result.move.to === 'h5';
  check('不会主动送后 (Qh5??)', !badMove, JSON.stringify(result.move));
}

// ------------------------------------------------------------------
// 简单送子检测：引擎在有子可安全吃、也有子会白送的局面中，不应选择送子着法
// ------------------------------------------------------------------
console.log('\n=== 送子回避测试 2 ===');
{
  const game = new ChessEngine.Game();
  // 白后可以被黑马直接吃掉的局面：Nb4 之类，检测引擎不会把后放到被吃的格子
  game.loadFEN('rnbqkb1r/pppppppp/5n2/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const result = game.search({ depth: 3 });
  console.log('  引擎选择：', result.move, 'score=', result.score);
  check('评分在合理范围内（未出现异常送子导致的大幅负分）', result.score > -200,
    'score=' + result.score);
}

// ------------------------------------------------------------------
// perft 一致性抽查（search 模块不应破坏局面状态）
// ------------------------------------------------------------------
console.log('\n=== 搜索后局面状态一致性 ===');
{
  const game = new ChessEngine.Game();
  const fenBefore = game.getFEN();
  game.search({ depth: 3 });
  const fenAfter = game.getFEN();
  check('search() 不修改局面（root 之外的 make/unmake 均已回退）', fenBefore === fenAfter,
    `before=${fenBefore} after=${fenAfter}`);
}

console.log('');
if (allPass) {
  console.log('ALL PASS');
  process.exit(0);
} else {
  console.log('SOME TESTS FAILED');
  process.exit(1);
}
