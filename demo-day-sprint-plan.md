# Demo Day 冲刺工程计划（2026-07-13 → 07-19）

目标：在 7 月 19 日（周日）Demo Day 前，用剩余约 4 个工程日把 Anker 从"稳三四"推向"冲一二"。
本文档只列**涉及代码改动的工程任务**。演讲稿、X 运营、排练等非工程事项不在此列。

评审背景（决定优先级的依据）：

- 评分权重：Real-World Application 50% / Product & UX 20% / Technical 20% / Presentation 10%。
- 评委为 Sui 生态方，明确关注：能否真实赚钱、能否长期运营、GitHub 持续更新、给 Sui 带新用户。
- 已确认不做：刷测试网交易量、把测试网协议费包装成收入（机制验证 ≠ 需求验证）。

---

## 已完成（本周合入）

### Day-scale live discovery 不再被小时级 churn 挤掉

**现象**：6-24 已开出 day-scale Expiry Market 后，产品页偶尔又扫不到，day 档退回 4-16 Legacy Oracle。

**原因**：discovery 拉的是 `/markets?limit=500`（最近创建事件流）。1m/5m/1h cadence 几小时就能把窗口刷满，day 市场的 `market_created` 滚出窗口后 `computeDayRows` 降级到 Legacy。

**修复**：discovery 改为 `/markets?limit=500&active=true`，直接取当前未到期市场集合。代码在 `src/deepbook/predictAdapter.ts`；day live 与 hourly live 共用同一清单，再由 `filterMarketsForTenorGroup` 分流。Legacy → Snapshot 降级链保留作兜底。

**状态**：已解决（v0.2.1）。

---

## P0 — 排查负 Edge 成因（今天，最高优先）

**现象**（2026-07-13 实测线上）：Price & APR reference 表中所有 matched 行 Edge 均为负：

- $63,000 档：Anker 66.24% vs Binance 98.81% → **-32.57 pts**
- $62,500 档：52.73% vs 71.29% → -18.56 pts
- $62,000 档：-12.52 pts
- 最靠近现价的 $64,000 / $63,500 两档 Binance 侧显示 "No product"（匹配缺口）

而 README / 提交页 / pitch 的核心卖点是 "+15~29 pts edge"。评委本周随时可能打开 app 看到相反的数字。

**排查方向**（按嫌疑排序）：

1. **匹配质量**：Binance 匹配是"目标价 + 最近结算日"。day-tenor 上线后，是否存在拿 Anker 3–4 天期与 Binance 不同期限产品对比的情况？期限不可比会系统性扭曲 Edge。检查匹配逻辑中 tenor 容差，考虑输出"匹配质量"标签（exact / near / incomparable），不可比时显示 "No comparable product" 而不是负 Edge。
2. **新 6-24 部署的 SVI 定价**：与旧 4-16 部署相比，leg ask 成本是否系统性变贵（testnet PLP 深度 / vol 参数差异）。
3. **费用与 ladder 参数**：day-tenor browse ladder（$500 tick）下 coupon 是否被 leg 数量/宽度设置吃掉，试对比 3/6/9 legs 预设的 net APR 差异。

**产出**：结论写进本文档附录；若是匹配问题则修匹配（这既救数字又更诚实）；若是市场现实，则 P1 的统计叙事承接（"我们让价差可见，且历史上 X% 时间领先"）。

---

## P1 — Edge 历史快照记录器 + 透明度统计页（今天启动采集，UI 可后补）

**为什么是第一优先**：这是唯一不依赖用户、机器自动积累的"证据级"卖点来源。今天开始跑，到 Demo Day 有 ~6 天数据。它同时是：50% 权重项的直接证据、"edge 可持续吗"必问题的答案、现场 edge 为负时的底气。

**采集端**（先跑起来，每小时都值钱）：

- 每 15–30 分钟对所有 matched 行快照：`{timestamp, tenor, target_price, anker_net_apr, binance_apr, edge_pts, match_quality, liquidity_status}`。
- 实现选项（择一，倾向零运维）：
  - **方案 A（推荐）**：GitHub Action cron 调用现有 `/api/predict` wrapper + Binance API（仓库已有 Binance 缓存层，commit 7928c3e），把 JSONL 快照直接 commit 进仓库 `data/edge-snapshots/`。零基础设施、数据公开在 git 里可审计——本身就是透明度叙事的一部分，且让仓库保持每日绿格。
  - 方案 B：Vercel Cron + KV/Postgres。运维面大一点，数据不公开。
- 注意：采集走只读报价路径（估价/`devInspect` 预览），不发交易，不碰核心订阅流程。

**展示端**（1–2 天内补上，路由建议 `/stats` 或 `/transparency`）：

- Benchmark 统计卡：样本数、Anker 领先时间占比、中位/最大 Edge、按 tenor 分组。
- Edge 时序图（一条线即可，别过度设计）。
- 机制证明区（如实标注 "Mechanism verified on Sui testnet"）：累计 ProductNote 数、链上费用捕获交易的 explorer 链接、包 ID。**不使用 revenue/traction 字样。**
- 数据来源说明 + 快照仓库链接（可审计）。

---

## P2 — Enoki zkLogin（Google 登录）（约 1 天，feature flag 保护）

**为什么**：目标用户是没有钱包的 CEX 用户；"降低进入 Sui 的门槛/带新用户"是评委原话诉求。Flicky/Skew 均已有，属于本届 cohort 的 table stakes。

**实现**：

- `@mysten/enoki` 的 `registerEnokiWallets()` 挂入现有 dapp-kit WalletProvider，Google OAuth 走 Enoki Portal 配置（需要 Enoki API key + Google OAuth client id）。
- 增量集成：zkLogin 钱包出现在现有 connect 列表中，不改动任何交易构建路径。
- Feature flag：`NEXT_PUBLIC_ENABLE_ZKLOGIN`，默认关，验证通过后再开。测试网 network 配置注意 Enoki 对 testnet 的支持面。

**Stretch（时间富余才做，否则砍）**：sponsored gas 仅覆盖"创建 product container"这一笔结构简单的首交易（Enoki sponsorship API）。demo 词："Google 登录 → 第一笔交易免 gas → 60 秒内买到第一个 Buy Low"。

**风险控制**：此项绝不允许影响现有钱包流程；出现任何不稳定迹象立即关 flag。

---

## P3 — 新手引导 + 大白话解释层（约半天）

**为什么**：Product & UX 20% 里最便宜的分。Skew v2 有 5 步 guided tour + "How to read the surface" 白话卡片，教育做得比我们显性。

**实现**：

- 首次访问 3–4 步引导（localStorage 记忆）：① 对比表怎么读（Anker APR / Binance APR / Edge）→ ② 点一行载入 builder → ③ 两种结算结果 → ④ Advanced details 里能看到什么。
- "这个收益从哪来"解释卡：coupon = 本金 − 底价储备 − legs 成本，配一句白话（"你的收益是市场为期权支付的真实价格，不是平台补贴"）。挂在 Rewards 数字旁的 info 图标上。
- 中英双语同步（现有 i18n 体系）。

---

## P4 — 移动端细节 pass（约半天）

**背景**：375px 实测响应式基础良好（布局正常堆叠、APR 表自动转卡片），不需要原生 App。只做细节：

- 触控目标 ≥44px 检查（tenor 下拉、表格行、Refresh）。
- Dashboard 卡片与 On-chain proof 区在小屏的间距/换行。
- Advanced details / legs 表在窄屏的横向滚动容器。
- 首屏加载顺序：BTC price 与 APR 表的 skeleton 状态。
- （可选）PWA manifest + 图标，成本极低，演讲可提 "installable"。

---

## 明确不做（防 scope creep）

- ❌ 原生 iOS/Android App
- ❌ Sell High 完整实现（roadmap 讲述即可）
- ❌ 核心订阅/claim 路径的任何重构
- ❌ 拉真实用户冲交易量、自刷交易（评委即 DeepBook 团队，indexer 在他们手里；且与产品的诚实定位自相矛盾）
- ❌ 把测试网协议费表述为 revenue

---

## 时间表与冻结纪律

| 日期 | 工程内容 |
|---|---|
| 7-13（日） | P0 排查负 Edge；**P1 采集端上线开始积累数据** |
| 7-14（一） | P1 统计页 UI；P0 结论落地（若需修匹配则修） |
| 7-15（二) | P2 zkLogin（flag 保护）；P1 收尾 |
| 7-16（三） | P3 引导层；P4 移动端 pass；全量回归 `npm run ci` |
| 7-17（四） | **代码冻结**（此后只允许改文案/配置）。录制对 6-24 部署的完整 E2E 备份视频（订阅 → ProductNote → claim，带 explorer 链接） |
| 7-18（五） | 不改码。排练。 |
| 7-19（六/日） | Demo Day（北京时间周日约 22:10，提前 15 分钟进 Zoom） |

**每项合入前必须过**：`npm run ci`（lint → unit → move test → build → e2e，含 7 条护栏）。冻结后发现的 bug 只允许 revert，不允许 forward-fix。

---

## 附录：待填

- [ ] P0 负 Edge 成因结论：
- [ ] P1 截至 Demo Day 的统计摘要（样本数 / 领先占比 / 中位 Edge）：
- [ ] zkLogin flag 最终状态（开/关）及原因：
