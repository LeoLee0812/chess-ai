<div align="center">

# ♟️ chess-ai

**纯 JavaScript 手写国际象棋引擎 + 单文件网页对弈 UI——零依赖，从走法生成到 alpha-beta 搜索全部手写**

[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![零依赖](https://img.shields.io/badge/依赖-0-brightgreen?style=flat-square)](./engine.js)
[![Perft](https://img.shields.io/badge/perft-6%2F6_全过-success?style=flat-square)](./test/perft.test.js)
[![棋盘](https://img.shields.io/badge/棋盘表示-0x88-8B4513?style=flat-square)](#-引擎技术细节)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)

**🎮 在线试玩**：<https://chess-ai-nine.vercel.app>

</div>

## ✨ 简介

一个不依赖任何第三方库的国际象棋引擎：0x88 棋盘表示、完整规则的走法生成、迭代加深 alpha-beta 搜索、Zobrist 置换表——全部手写在约 1000 行的 `engine.js` 里，Node 与浏览器双兼容（UMD 风格）。配套一个全内联的单文件网页 UI（`index.html`），通过 Web Worker 调用引擎（失败时自动降级主线程），打开即可对弈。

## 🚀 功能特性

- **完整规则支持**：王车易位（含路径受攻击判定）、吃过路兵、四种升变、兵双步。
- **终局判定齐全**：将杀 / 逼和 / 五十步（将杀优先）/ 三次重复（幻影过路兵格已规范化，不干扰重复判定）/ 子力不足。
- **对弈 UI**：可选执白/执黑（执黑自动翻转棋盘）、引擎思考时间三档（0.5s / 1s / 3s）、悔棋（一次撤销双方各一步）、实时显示引擎评估分 / 搜索深度 / 节点数。
- **Web Worker 异步搜索**：引擎在 Worker 线程里思考，UI 不卡顿；Worker 不可用时降级主线程。
- **perft 全过**：6 个标准基准局面（含地狱难度的 Kiwipete）节点数逐位精确匹配。

## 🏗️ 引擎技术细节

- **棋盘表示**：0x88 mailbox——越界判断一条位运算搞定（`sq & 0x88`）。
- **走法生成**：完整规则覆盖，make/unmake 后校验己方王安全保证合法性。
- **搜索**：迭代加深 + alpha-beta（negamax）+ 静态搜索（quiescence，含被将军时的全逃将扩展），支持按深度或按时间（`{depth}` / `{timeMs}`）搜索。
- **置换表**：53 位 Zobrist 哈希（双 31 位随机数组合，降低碰撞），将杀分数按 ply 归一化存取，避免 mate 分污染。
- **着法排序**：置换表着法 → MVV-LVA 吃子 → 杀手着法（killer moves）。
- **评估**：子力价值 + 每兵种 piece-square table。

### perft 基准

perft 是国际象棋引擎的黄金标准测试：从给定局面枚举所有合法着法序列到指定深度，节点总数必须与社区公认的精确值完全一致——王车易位、吃过路兵、升变、将军规则里任何一个细节写错，数字都对不上。本引擎 6 个基准局面全部精确通过，初始局面 perft(5) = 4,865,609 在 Node 下约 0.4 秒。

## ⚡ 快速开始

```bash
# 1. 走法生成正确性：6 个标准 perft 基准局面，节点数逐位精确匹配（约 2 秒）
node test/perft.test.js

# 2. 搜索冒烟测试：找将杀、不送子、搜索不污染局面
node test/search.test.js

# 3. 对弈：起个静态服务打开 index.html 即可下棋
python3 -m http.server 8000   # 然后访问 http://localhost:8000
```

或者直接打开在线版：<https://chess-ai-nine.vercel.app>

## 📁 项目结构

| 文件 | 说明 |
|---|---|
| `engine.js` | 引擎核心，Node / 浏览器双兼容（约 1000 行） |
| `index.html` | 对弈 UI，全部内联，通过 Web Worker 调引擎（失败时降级主线程） |
| `test/perft.test.js` | perft 正确性测试 |
| `test/search.test.js` | 搜索行为测试 |
| `SPEC.md` | 项目规格（接口定义与验收基准） |

## 🔬 开发过程

本项目由多智能体流水线协作完成：Sonnet 并行实现引擎与 UI（UI 仅依赖接口规格盲写），Haiku 独立验证测试，Opus 双视角审计（引擎正确性 + UI 健壮性）共发现 11 个 perft 测不出来的问题（静态搜索将军盲区、置换表 mate 分污染、悔棋软锁死等），全部修复并有回归验证。

## 📄 许可证

本项目基于 [MIT License](./LICENSE) 开源。

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=LeoLee0812/chess-ai&type=Date)](https://www.star-history.com/#LeoLee0812/chess-ai&Date)
