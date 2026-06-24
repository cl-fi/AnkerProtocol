# AnkerProtocol agent-native 产品架构路线图

> 目的: 把当前 AnkerProtocol 项目从"真实页面和当前 Next serverless API 可运行"推进到"agent 可以安全做完整产品实验,且未来可迁移 runtime"。这里的产品实验包括页面、文案、状态矩阵、API contract mock、runtime adapter 和链上/第三方服务边界。当前 runtime 是 Next.js;未来可以是 Cloudflare Workers、Pages Functions、Durable Objects、普通 Node 服务或其他有状态后端。

## 1. 当前判断

当前项目已经有比较好的底座:

- `src/products/*`: 产品数学、报价、结算相关逻辑,基本不依赖 UI。
- `src/sui/*`: 链上对象、交易和 portfolio 读取。
- `src/deepbook/*`: DeepBook / Binance / Predict 数据连接。
- `src/server/*`: server response shaping、curated oracle、deterministic fixtures。
- `src/hooks/*`: React 查询层。
- `app/api/*`: 当前 Next HTTP/serverless adapter,属于后端边界,但不应该承载不可迁移的业务规则。
- `src/ui/*`: 已经抽出 Button、Card、Badge、Stat、Tabs、Field 等 primitives。
- `app/*/page.tsx`: 当前 Next page route 层很薄,基本只挂载页面组件。

主要问题集中在 `src/components/*`:

- 页面组件仍然同时做取数、状态派生、页面拼装和视觉 class。
- 完整页面还不能脱离 wallet/API/chain 独立渲染。
- Storybook 目前只覆盖 `src/ui/**/*.stories.tsx`,没有产品级区块和完整页面状态。
- `src/styles.css` 仍然是 4000+ 行全局页面样式,主题和页面 class 耦合较重。
- 当前项目没有 Tailwind 依赖,不要假设 Tailwind 工具可以直接接入。
- HTTP 后端入口和页面在同一个 Next repo,但仍要按 backend contract / frontend view / runtime adapter 分开治理。

本路线图的核心目标:

> 先选 Dashboard 做 pilot,跑通 backend contract -> runtime adapter -> container -> view model -> pure view -> fixtures -> design lab 的闭环。

## 2. 目标目录形态

推荐逐步把核心页面迁移到 feature 结构。短期不需要大搬家,但目标形态如下:

```txt
src/features/dashboard/
  dashboard.contract.ts
  dashboard.serverFixtures.ts
  DashboardPageContainer.tsx
  DashboardView.tsx
  dashboardViewModel.ts
  dashboard.fixtures.ts
  DashboardView.stories.tsx
  dashboard.copy.ts
  dashboard.types.ts

src/features/dual-investment/
  dualInvestment.contract.ts
  dualInvestment.serverFixtures.ts
  DualInvestmentPageContainer.tsx
  DualInvestmentView.tsx
  dualInvestmentViewModel.ts
  dualInvestment.fixtures.ts
  DualInvestmentView.stories.tsx
  dualInvestment.copy.ts
  dualInvestment.types.ts

src/design-system/
  primitives/
  layout/
  product/
  themes/

src/runtime/
  next/
    api/
    pages/
  cloudflare/        // future, only when migration starts
    workers/
    durable-objects/
```

为了降低风险,第一阶段可以先保留现有 `src/components/*`,新增文件逐步承接纯 view 和 fixtures。

## 3. 第 1 步: 固化架构边界

状态: 需要补齐。

产物:

- `docs/agent-native-product-architecture.md`
- `docs/anker-agent-native-roadmap.md`
- 后续建议新增 `AGENTS.md`

要明确:

```txt
Green zone: agent 可大胆改
- pure views
- fixtures
- stories
- themes
- copy
- visual-only CSS

Yellow zone: 谨慎改
- view models
- containers
- hooks
- framework routes
- HTTP handlers
- runtime adapters
- src/server response shaping

Red zone: 默认不碰
- src/products
- src/application
- src/sui
- src/deepbook pricing/quote logic
- API contracts
- transaction/preflight/settlement
- state transition invariants
```

完成标准:

- 文档写清楚。
- 后续每次视觉探索都能引用这套边界。
- Agent 不再为了改 UI 默认触碰 `products/sui/application/api`。
- Agent 不再为了造 demo 状态修改真实 API contract。

## 4. 第 2 步: 先标清 backend/runtime 边界

在做 Dashboard pilot 前,先把项目里的"后端"和"runtime"说清楚。当前代码运行在 Next.js 里,但架构目标不能被 Next.js 绑定。

当前 AnkerProtocol 的后端不是独立服务,但这些都是后端或后端 adapter 职责:

```txt
app/api/*        当前 Next HTTP adapter
src/server/*     response shaping、server fixtures、server helpers
src/deepbook/*   外部服务 adapter / Predict 数据连接
src/sui/*        链上读取/交易 primitive
src/application/* 用例编排
src/products/*   domain core
```

需要建立两个概念:

```txt
Server contract:
  HTTP endpoint 返回给前端/客户端的稳定 shape。

View model:
  页面最终消费的展示 shape。

Runtime adapter:
  把同一个 application/backend service 接到 Next、Cloudflare、Node 或其他平台。
```

它们不能混为一个东西。API contract 可以偏机器可读,ViewModel 可以偏页面友好,Runtime adapter 应该只处理 request/response/platform binding。

建议短期新增或整理:

```txt
src/server/dashboardResponse.ts       // 如果后续有 dashboard 聚合 API
src/server/dashboardResponse.test.ts
src/components/dashboardViewModel.ts
src/components/dashboardViewModel.test.ts
```

如果暂时没有 dashboard 聚合 API,也要在文档里声明: Dashboard 当前由 client hooks 聚合数据,backend 主要存在于 market/predict/current APR routes。

完成标准:

- `app/api/*` 被明确视为当前 Next runtime adapter。
- HTTP handler 只做 request/response/platform adapter,复杂规则下沉到 `src/server` / `src/application` / `src/products`。
- demo fixtures 不复用或污染真实 API response contract。
- 如果以后迁移 Cloudflare,优先新增 runtime adapter,不要重写 domain/application/view。

## 5. 第 3 步: 建立 runtime portability contract

这一步不是马上迁移 Cloudflare,而是避免现在写出以后迁不动的代码。

建议约束:

```txt
Domain core:
  不 import Next、Cloudflare、React、DOM。

Application service:
  接收显式 adapters,不直接读 process.env、Request、Response、window。

Server adapter:
  可以读 Request/env/bindings,但只负责转换输入输出。

State adapter:
  如果未来需要 Durable Object、数据库、队列或长连接,先定义接口,再绑定平台实现。
```

示例形态:

```ts
export type RuntimeAdapters = {
  predictClient: PredictClient;
  clock: Clock;
  cache?: CacheAdapter;
  stateStore?: StateStore;
};

export async function getCurrentApr(input: CurrentAprInput, adapters: RuntimeAdapters) {
  // application logic only
}
```

完成标准:

- 新增/改造后端逻辑时,优先写 application function,再写 Next route wrapper。
- `process.env`、`Request`、`Response`、platform bindings 不进入 `src/products`。
- 有状态能力先抽接口,再决定是 Cloudflare Durable Object、数据库还是普通 server process。

## 6. 第 4 步: Dashboard pilot

这是下一步最重要的工程动作。

### 6.1 新增 DashboardViewModel 类型

新增:

```txt
src/components/dashboardViewModel.ts
```

或如果愿意开始 feature 化:

```txt
src/features/dashboard/dashboard.types.ts
src/features/dashboard/dashboardViewModel.ts
```

建议模型:

```ts
export type DashboardViewState =
  | 'no-wallet'
  | 'contract-missing'
  | 'loading'
  | 'error'
  | 'empty'
  | 'populated';

export type DashboardViewModel = {
  state: DashboardViewState;
  locale: 'en' | 'zh';
  hero: {
    title: string;
    subtitle: string;
    refreshLabel: string;
    refreshDisabled: boolean;
  };
  portfolio?: {
    totalDeposited: string;
    expectedRewards: string;
    openPositions: string;
  };
  positionsHeading?: {
    title: string;
    countLabel: string;
  };
  filters: Array<{
    key: 'all' | 'ready' | 'active' | 'completed';
    label: string;
    count: number;
    visible: boolean;
  }>;
  activeFilter: 'all' | 'ready' | 'active' | 'completed';
  positions: PositionCardViewModel[];
  emptyMessage?: string;
  errorMessage?: string;
};
```

关键原则:

- ViewModel 里尽量放已经格式化好的字符串。
- View 不应该知道 `AnkerProductNoteRecord` 的原始结构。
- View 不应该自己判断 contract 是否配置。

### 6.2 抽 DashboardView

新增:

```txt
src/components/DashboardView.tsx
```

职责:

- 渲染完整 Dashboard 页面。
- 接收 `model` 和 `actions`。
- 不调用 wallet hook。
- 不调用 portfolio hook。
- 不调用 predict manager hook。
- 不调用 `Date.now()` 计算业务状态。

建议接口:

```ts
export type DashboardViewActions = {
  onRefresh: () => void;
  onFilterChange: (filter: PositionFilter) => void;
  onClaim?: (positionId: string) => void;
};

export function DashboardView({
  model,
  actions,
}: {
  model: DashboardViewModel;
  actions: DashboardViewActions;
}) {
  // render only
}
```

短期可以先让部分复杂子组件继续存在,但 DashboardView 本身必须不取数。

### 6.3 改 DashboardPage 成 container

当前 `src/components/DashboardPage.tsx` 应变薄:

```txt
DashboardPage
  - useCurrentAccount
  - useAnkerPortfolio
  - usePredictManagers
  - useProductNoteEventIndex
  - buildDashboardViewModel(...)
  - <DashboardView model={model} actions={actions} />
```

完成后,DashboardPage 仍是生产入口,DashboardView 是设计入口。

### 6.4 新增 Dashboard fixtures

新增:

```txt
src/components/dashboard.fixtures.ts
```

至少包含:

```ts
export const dashboardNoWalletFixture
export const dashboardLoadingFixture
export const dashboardErrorFixture
export const dashboardEmptyFixture
export const dashboardPopulatedFixture
export const dashboardPopulatedZhFixture
export const dashboardManyPositionsFixture
export const dashboardLongTextFixture
```

这些 fixture 必须直接喂给 `DashboardView`。

### 6.5 新增 Dashboard full-page story

修改 `.storybook/main.ts`:

```ts
stories: [
  '../src/ui/**/*.stories.@(ts|tsx)',
  '../src/components/**/*.stories.@(ts|tsx)',
]
```

新增:

```txt
src/components/DashboardView.stories.tsx
```

Stories:

- Populated
- PopulatedChinese
- NoWallet
- Loading
- Error
- Empty
- ManyPositions

完成标准:

- 不启动生产 app / 不连真实 runtime 也能看完整 Dashboard。
- 不连钱包也能看 claim/action 状态。
- agent 可以只改 DashboardView / fixtures / CSS 做视觉探索。

## 7. 第 5 步: 抽 PositionCard pure view

当前 `DashboardProductNoteCard` 里还有:

- `usePredictManagerState`
- `useQuery(fetchOracleMarket)`
- proof link 计算
- lifecycle 计算
- 展示 markup

建议拆成:

```txt
ProductNoteCardContainer.tsx
ProductNoteCardView.tsx
productNoteCardViewModel.ts
productNoteCard.fixtures.ts
```

目标:

```tsx
<ProductNoteCardView model={readyToClaimPositionFixture} />
<ProductNoteCardView model={activePositionFixture} />
<ProductNoteCardView model={completedPositionFixture} />
<ProductNoteCardView model={actionNeededPositionFixture} />
```

完成标准:

- DashboardView 可以用纯 `PositionCardViewModel[]` 渲染卡片。
- 卡片所有视觉状态都可以在 stories 中独立查看。
- 链上 proof 的实时查询只存在 container 或 viewModel builder 里。

## 8. 第 6 步: Dual Investment 页面重复同样模式

Dashboard pilot 跑通后,再处理 `DualInvestmentPage`。

拆分目标:

```txt
DualInvestmentPageContainer
  - useMarketData
  - useDualInvestmentScan
  - useBinanceDualInvestment
  - debounce live quote verification
  - selectedOracle / principal / target / legCount state

DualInvestmentView
  - 完整页面渲染
  - DirectionPairBar
  - ReturnOverview
  - ReferenceTable
  - BuyLowControls
  - Confirm panel
  - Advanced details

dualInvestmentViewModel
  - market ticker display
  - selection options
  - quote display state
  - reference table rows
  - confirm state
```

Fixtures:

- loading market
- stale snapshot
- no valid target
- estimate quote
- live executable quote
- quote verification error
- Binance benchmark present
- long settlement date
- Chinese copy

完成标准:

- 不连 DeepBook / Binance 也能看完整 Dual Investment 页面。
- 视觉实验不需要触发 live quote。
- 真实报价逻辑仍留在 container/hooks/products。

## 9. 第 7 步: 文案与国际化

你提到中英文切换,这个应该在 view model / copy 层解决,不要让中文英文散落在 JSX 里。

新增:

```txt
src/i18n/types.ts
src/i18n/en.ts
src/i18n/zh.ts
```

或按 feature:

```txt
src/features/dashboard/dashboard.copy.ts
src/features/dual-investment/dualInvestment.copy.ts
```

原则:

- Pure View 接收已经选好的 copy 或 `locale`。
- Story/fixture 必须覆盖中英文。
- 中文要专门测长文本换行。
- 不要在 JSX 中写一堆条件: `{locale === 'zh' ? ... : ...}`。

完成标准:

- Dashboard 和 DualInvestment 至少支持 English / Chinese fixture。
- 所有核心页面 story 都有中文状态。
- 长中文不会撑爆按钮、卡片、表格。

## 10. 第 8 步: Theme / token 实验层

当前 `src/styles.css` 是主样式来源,`src/ui/tokens.css` 只有初步 token。

建议下一步不是立刻迁移 Tailwind,而是先建立主题入口:

```txt
src/ui/tokens.css
src/ui/themes/sticker.css
src/ui/themes/fintech.css
src/ui/themes/terminal.css
src/ui/themes/minimal.css
```

先做 CSS variables:

```css
:root,
[data-theme='sticker'] {
  --color-bg: ...;
  --color-surface: ...;
  --color-text: ...;
  --color-accent: ...;
  --radius-card: ...;
  --shadow-card: ...;
}

[data-theme='terminal'] {
  --color-bg: ...;
}
```

完成标准:

- 同一个 DashboardView 可以通过 `data-theme` 切换视觉方向。
- 主题主要改 token,不是复制 JSX。
- 设计 branch 改主题时不需要动业务逻辑。

## 11. 第 9 步: Design Lab

有两种方式,可以并行。

### 11.1 Storybook

适合:

- 组件状态矩阵
- 页面状态矩阵
- 开发时快速切换 props
- 视觉回归

必做:

- `DashboardView.stories.tsx`
- `ProductNoteCardView.stories.tsx`
- `DualInvestmentView.stories.tsx`
- `ReturnOverview.stories.tsx`

### 11.2 `/design` preview

适合:

- 产品经理直接看完整页面
- 更接近真实 app shell
- query 参数切换 state/theme/locale

建议路由:

```txt
app/design/dashboard/page.tsx
app/design/dual-investment/page.tsx
```

这是当前 Next 实现。未来如果部署到 Cloudflare,它也可以是独立 preview app 或 Worker preview URL,不必绑定 Next route。

示例:

```txt
/design/dashboard?state=populated&theme=sticker&locale=en
/design/dashboard?state=populated&theme=terminal&locale=zh
```

完成标准:

- 不连钱包、不调真实 API 也能看完整产品页面。
- 一个 URL 可以表达一个设计状态。
- branch 上的设计方案可以直接发 URL 审查。

## 12. 第 10 步: 视觉验证

当 design lab 成型后,再加自动验证。

建议:

- Playwright 打开 `/design/*` 或 Storybook iframe。
- 对 desktop/mobile 截图。
- 检查关键文本是否可见。
- 检查 console error。
- 对核心 states 做 snapshot baseline。

初始覆盖:

- Dashboard populated desktop/mobile
- Dashboard empty desktop/mobile
- Dashboard Chinese desktop/mobile
- DualInvestment executable quote desktop/mobile
- DualInvestment empty/invalid target desktop/mobile

完成标准:

- 视觉实验 merge 前有截图验证。
- agent 改页面后能自己跑检查。

## 13. 第 11 步: Branch 实验机制

推荐命名:

```txt
codex/design-dashboard-minimal
codex/design-dashboard-terminal
codex/design-dashboard-premium
codex/design-dashboard-sticker-v2
```

每个设计 branch 允许改:

- `DashboardView.tsx`
- `ProductNoteCardView.tsx`
- fixtures
- themes
- visual CSS
- copy

默认不允许改:

- `src/products/*`
- `src/sui/*`
- `src/application/*`
- transaction / quote / settlement logic
- API contracts
- runtime state invariants

合并前检查:

- typecheck
- unit tests for view model
- visual screenshots
- diff 是否只落在 green/yellow zone

## 14. 推荐执行顺序

短期 1-2 天:

1. 新增本路线图和学习文档。
2. 标清 backend/runtime 边界。
3. 建立 runtime portability contract。
4. 给 Dashboard 定义 `DashboardViewModel`。
5. 抽 `DashboardView`。
6. 写 Dashboard fixtures。
7. 写 `DashboardView.stories.tsx`。

中期 3-5 天:

1. 抽 `ProductNoteCardView`。
2. 把 DashboardPage 变薄。
3. 补中文/英文 copy fixture。
4. 扩 Storybook 到产品级 components。
5. 建立第一个 `/design/dashboard` route。

中期 1-2 周:

1. DualInvestment 重复 container/view/viewModel/fixtures。
2. 建立 theme tokens。
3. 做 3 个 dashboard theme branch。
4. 增加 Playwright visual smoke tests。

长期:

1. 所有核心页面都有 pure view。
2. 所有核心页面都有状态矩阵。
3. 所有核心页面都可通过 fixture 运行。
4. agent 工作流固定为: design branch -> fixture screenshots -> select -> merge。

## 15. 还需要补的工作流文档

为了把这套系统真正跑起来,建议后续再补这些文档。

### 15.1 `AGENTS.md`

给 agent 的仓库操作规则。

内容:

- green/yellow/red edit zones
- 视觉任务默认流程
- 禁止触碰的业务核心目录
- 测试和截图要求
- branch 命名规则

优先级: 最高。

### 15.2 `docs/architecture.md`

给人和 agent 共用的项目架构说明。

内容:

- 当前目录职责
- domain/application/adapter/container/view 分层
- backend adapter / runtime adapter 分层
- 数据流图
- API contract 和 view model 的区别
- 哪些模块可以互相依赖
- 当前 Next.js 在项目里的边界
- 未来 Cloudflare / stateful backend 迁移边界

优先级: 高。

### 15.3 `docs/design-workflow.md`

定义设计探索流程。

内容:

- 怎么开 design branch
- 怎么选 fixture
- 怎么加新视觉方向
- 怎么评审截图
- 怎么把胜出方案 merge 回生产
- 怎么清理失败实验

优先级: 高。

### 15.4 `docs/api-contracts.md`

定义后端 API contract。

内容:

- 每个 HTTP endpoint 的输入/输出 shape
- response versioning 策略
- upstream error 如何映射
- stale snapshot 如何表达
- deterministic fixtures 如何组织
- 哪些 API 可以为了设计实验 mock,哪些不能改 contract

优先级: 高。

### 15.5 `docs/runtime-portability.md`

定义未来迁移到 Cloudflare 或有状态服务时的边界。

内容:

- 当前 Next runtime adapter 清单
- 哪些逻辑必须保持 runtime-agnostic
- `process.env` / platform binding 使用规则
- cache、queue、cron、state store 的 adapter interface
- Cloudflare Workers / Durable Objects / Node service 的可能映射
- 迁移时哪些测试必须保持不变

优先级: 高。

### 15.6 `docs/state-matrix.md`

列出每个核心页面必须覆盖的状态。

内容:

- Dashboard states
- DualInvestment states
- wallet states
- quote states
- error states
- i18n stress states
- mobile/desktop states

优先级: 高。

### 15.7 `docs/i18n-copy-guidelines.md`

中英文和未来多语言文案规范。

内容:

- copy key 命名
- 中文长度策略
- 金融产品术语表
- APR / settlement / claim 等词汇标准
- 禁止 JSX 内散落硬编码文案

优先级: 中。

### 15.8 `docs/visual-regression.md`

视觉验证规范。

内容:

- 哪些 route/story 必须截图
- desktop/mobile 尺寸
- 如何判断失败
- 如何更新 baseline

优先级: 中。

### 15.9 `docs/theme-token-contract.md`

主题 token contract。

内容:

- 允许的 token 名称
- primitive/semantic/component token 分层
- 新主题必须实现哪些变量
- 禁止组件直接引用 raw pigment 的规则

优先级: 中。

## 16. 最重要的下一步

不要同时重构所有页面。下一步先标清 backend/runtime 边界,再做 Dashboard pilot。

目标闭环:

```txt
DashboardPageContainer
  -> buildDashboardViewModel
  -> DashboardView
  -> dashboard fixtures
  -> DashboardView stories
```

这个闭环跑通之后,再复制到 DualInvestment。否则会变成大重构,风险高,反馈慢。
