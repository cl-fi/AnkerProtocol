# Anker 设计系统 · 现状审计

> **日期**:2026-06-22
> **分支**:`design-system`(`main` 为比赛提交分支,已冻结;所有设计系统工作在本分支进行)
> **范围**:纯分析报告,不含代码改动。
> **目的**:把 Anker hackathon 原型的 UI 从"页面级写死"逐步工程化为可复用的设计系统,作为产品化的地基。

---

## 一、总体结论

**核心判断:问题不是"没设计",而是"设计没被结构化"。**

视觉语言已经成型且有辨识度(纸感 / sticker 风格:硬偏移阴影 + 粗描边 + 暖色纸底),值得保留;但它只活在一份 **4280 行、按页面堆叠的 `src/styles.css`** 里,没有被抽象成 token 体系和可复用组件。

| 维度 | 现状 | 评价 |
|---|---|---|
| 视觉资产 | 纸感 / sticker 风格,色板源自 anchor 图标(navy + gold + cream) | ✅ 有辨识度,值得留 |
| Token | 仅 38 个,几乎全是颜色 | ⚠️ 太薄,缺间距/字阶/动效/层级/断点 |
| 组件 | 10 个组件全是页面/区块级,样式是一次性 class | ⚠️ 零抽象,复用靠复制 |
| 数据/视图分离 | 少数大组件把 `useQuery` + 钱包 + 渲染揉在一起 | ⚠️ 无法独立渲染/测试 |

**结论:提炼路线清晰、性价比高,且可增量推进(一个组件一个组件地做,不必停下整个产品)。**

---

## 二、Token 审计

### 2.1 现有 38 个 token(全在单个 `:root`,单主题、无暗色)

| 类别 | 数量 | 样例 |
|---|---|---|
| 字体 | 3 | `--font-sans` `--font-mono` `--font-display`(Fredoka) |
| 中性 / 表面色 | 10 | `--cream` `--cream-2` `--paper` `--paper-2` `--navy` `--navy-2` `--navy-panel` `--slate` `--ink` `--ink-soft` |
| 品牌强调色 | 4 | `--gold` `--gold-2` `--gold-3` `--gold-tint` |
| 语义状态色 | 4 | `--grass`(正) `--grass-tint` · `--coral`(负) `--coral-tint` |
| 说明态铜色 | 5 | `--copper` `--copper-deep` `--copper-tint` `--copper-tint-2` `--copper-line`(只服务一个模块) |
| 形状 | 4 | `--bw`(2px) `--bw-thick`(3px) `--r`(16px) `--r-sm`(12px) |
| 阴影 | 5 | `--shadow-hard` `--shadow-hard-sm`(主)· `--shadow-sm/md/lg`(legacy) |
| 别名 | 3 | `--accent` `--accent-strong` `--focus-ring` |

### 2.2 三个关键缺口(要补的核心)

1. **无间距尺度** —— 全文件 128 个裸 `gap`、87 个裸 `padding`。数据显示已隐含一套 ~4px 基准(高频值 8 / 10 / 12 / 14 / 16 / 18),只是从没被命名成 token。
2. **无字阶体系** —— 132 个裸 `font-size`,没有 `--text-sm/base/lg` 阶梯,也没有行高 / 字重 token。
3. **无动效 / 层级 / 断点 token** —— 响应式断点 `980px` `640px` 在文件里写死 10+ 次;没有 `z-index` 层级,没有 `duration` / `easing`。

### 2.3 冗余与不一致(收敛目标)

- **双套阴影并存**:sticker 硬阴影(`--shadow-hard*`)+ legacy 软阴影(`--shadow-sm/md/lg`),源码注释自己已标 "Legacy"。需定主次,逐步淘汰一套。
- **颜色按"颜料名"而非"角色"命名**:`--gold` / `--navy` / `--cream`,而非 `--accent` / `--text` / `--surface`。这是**做不了换肤 / 暗色**的根因。
- **状态词表分裂成三套**:`good/warn/neutral`(校验)、`active/ready/attention/done`(持仓)、`validation-*`(链上)——同一个"语义状态"概念三种叫法,应合并为一个 `Tone` enum。

---

## 三、组件审计

### 3.1 运行时耦合分布(10 个非测试组件)

| 纯展示(可直接抽) | 耦合 wallet/query(需"容器 + 展示"解耦) |
|---|---|
| `AppHeader` `HomePage` `DualInvestmentPage` `DualInvestmentQuoteDetail` `DualInvestmentQuoteSections` `PayoffChart` | `DashboardPage` `DashboardProductNoteCard` `DashboardClaimAction` `TargetBuyExecutionPanel` `WalletConnectButton`* |

> \* `WalletConnectButton` 仅 1 行,转发第三方 `@mysten/dapp-kit-react` 的 `ConnectButton`,**不是重构目标**。真正的耦合大户是大卡片:`DashboardProductNoteCard`、`TargetBuyExecutionPanel`。

### 3.2 原子组件其实已存在,只是"埋"在页面 class 里

以 `DashboardProductNoteCard` 一个文件为证,内含 6 个可复用原语:

| 现状 class | 实际是 | 复用信号 |
|---|---|---|
| `.detail-panel` | **Card / Panel** | 多处复用 |
| `.di-status-pill is-${tone}` | **Badge**(带 tone 变体) | 教科书级变体组件 |
| `.di-position-stats > div` | **Stat**(标签 + 值 + 副值) | 一卡内重复 3 次 |
| `.oracle-meta > div(span + dd)` | **KeyValueRow** | 一卡内重复 **~20 次** |
| `.di-position-proof`(`<details>`) | **Disclosure** | — |
| `ProofLink`(已是局部函数) | **Link** | 已半成形,信号最好 |

### 3.3 Button:重复最严重的点

`.primary-action` / `.secondary-action` / `.ghost-button` / `.small-action` / `.subscribe-button` / `.redeem-action` / `.preview-action` / `.view-more`
—— **8 个 class 名,实际只是 3–4 个变体**,定义散落在文件 **6+ 个位置**,`hover`/`active` 在响应式块里反复重写。应合并为单个 `Button(variant, size)`。

---

## 四、推荐:三层 Token 方案

```
原始层 (primitive)        语义层 (semantic)              组件层 (component, 按需)
--gold-500: #eaa53a   →   --color-accent             →   --btn-bg: var(--color-accent)
--navy-900: #20304d   →   --color-text / --border    →   --card-shadow: var(--shadow-card)
--space-4: 8px (新增)  →   --space-inline / -stack    →   ...
```

**铁律:组件只准引用语义层(角色),不准直接碰原始色值。**

- **换肤 / 暗色** = 只改"语义层 → 原始层"这一层映射,所有组件零改动。
- **迁移可渐进**:先给现有 38 个套上语义别名(零破坏),再逐步把组件里的裸 px 换成新增的 `--space-*` / `--text-*`。

---

## 五、第一批原子组件抽取清单(按优先级)

| 优先级 | 组件 | 来源 class | 变体 | 需解耦数据? |
|---|---|---|---|---|
| **P0** | `Button` | 8 个 `*-action` 类 | variant: primary/secondary/ghost · size: sm/md | 否 |
| **P0** | `Card` / `Panel` | `.detail-panel` | 默认 / 强调 | 否 |
| **P0** | `Badge` | `.di-status-pill` `.quote-badge` | tone:(统一后)neutral/positive/warning/done | 否 |
| **P0** | `Stat` | `.di-position-stats` `.pair-stat` | 带 / 不带副值 | 否 |
| **P1** | `KeyValueRow` / `DescriptionList` | `.oracle-meta` | — | 否 |
| **P1** | `Tabs` | `.mode-tabs` `.direction-tabs` `.return-scenario-tabs` | — | 否 |
| **P1** | `Disclosure` | `.di-position-proof` | — | 否 |
| **P1** | `Field` / `Input` | `.di-input-wrap` `.custom-grid` | — | 否 |
| **P2** | `DataTable` | `.offer-table` `.di-reference-table` | — | 视用法 |

> P0 这一组全部**无运行时耦合**,可以立即开始抽,不需要碰 wallet/query。

---

## 六、路线图

```
①定地基            ②抽原子组件        ③回填            ④(可选)沙盒     ⑤(可选)进工具
token 三层      →  把 inline 样式  →  用 <Button>   →  Storybook    →  /design-sync
+ 间距/字阶 enum    抽成纯函数组件      替换页面里的        看变体           或抽成 npm 包
                   (顺手解耦数据)      手写样式
```

1. **Token 分层 + 补间距/字阶**(地基,零破坏增量做)
2. **抽 P0 四件套**(Button / Card / Badge / Stat)→ 回填进现有页面
3. **统一 tone 词表**(三套合一)
4. **抽 P1 / P2**
5. 此时 `/design-sync` 才真正跑得通(它要求组件能脱离 app 独立渲染)

---

## 七、关键认知备忘

- **两条独立的线**:① 数据/视图解耦(组件职责)② 样式结构化(token + 复用)。可分开做——`Button` 不碰数据,只走线 ②。
- **"解耦" ≠ 删逻辑**,而是拆成"容器(管数据)+ 展示(纯函数)"两层;脏活搬家,不消失。
- **不是所有组件都要返工**:10 个里 5 个本来就基本是纯展示。
- **建议起手点**:从零数据的 `Button` 开刀,先把"定 token → 抽组件 → 回填"整条流程跑通,体感对了再推广。
