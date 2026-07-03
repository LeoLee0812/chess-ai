/**
 * perft 正确性测试
 * node test/perft.test.js 运行，全过输出 ALL PASS 并 exit 0，任一失败 exit 1
 */
const path = require('path');
const ChessEngine = require(path.join(__dirname, '..', 'engine.js'));

const CASES = [
  {
    name: '初始局面',
    fen: 'startpos',
    expected: [20, 400, 8902, 197281, 4865609]
  },
  {
    name: 'Kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expected: [48, 2039, 97862, 4085603]
  },
  {
    name: '局面3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expected: [14, 191, 2812, 43238, 674624]
  },
  {
    name: '局面4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expected: [6, 264, 9467, 422333]
  },
  {
    name: '局面5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expected: [44, 1486, 62379, 2103487]
  },
  {
    name: '局面6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    expected: [46, 2079, 89890, 3894594]
  }
];

const STARTPOS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

let allPass = true;

for (const testCase of CASES) {
  const fen = testCase.fen === 'startpos' ? STARTPOS_FEN : testCase.fen;
  const game = new ChessEngine.Game();
  game.loadFEN(fen);

  console.log(`\n=== ${testCase.name} ===`);
  console.log(`FEN: ${fen}`);

  for (let i = 0; i < testCase.expected.length; i++) {
    const depth = i + 1;
    const expected = testCase.expected[i];
    const start = Date.now();
    const actual = game.perft(depth);
    const elapsed = Date.now() - start;
    const pass = actual === expected;
    if (!pass) allPass = false;
    console.log(
      `  depth ${depth}: expected=${expected} actual=${actual} ${pass ? 'PASS' : 'FAIL'} (${elapsed}ms)`
    );
  }
}

console.log('');
if (allPass) {
  console.log('ALL PASS');
  process.exit(0);
} else {
  console.log('SOME TESTS FAILED');
  process.exit(1);
}
