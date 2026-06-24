# Agent-native product architecture 学习指南

> 目的: 帮你建立一套面向 agent 协作的软件设计开发心智模型。它不是某个框架教程,而是解释在代码生成变便宜之后,产品、设计、前端、后端、部署 runtime 和架构应该怎么重新分工。

## 1. 核心判断

Agent 时代真正变化的不是"前端可以写得更快",也不是"后端 API 可以写得更快",而是:

> 代码实现变便宜之后,设计载体会从静态稿逐渐迁移到可运行页面;但新的主要成本变成代码熵。

传统时代的问题是实现贵,所以先用 Figma、PRD、接口文档降低试错成本。Agent 时代可以直接生成可运行页面、HTTP endpoint、数据 mock、测试和脚本,所以试错成本下降;但如果没有架构边界,agent 会把业务规则、后端 runtime、链上 adapter、取数逻辑、视觉样式、文案和状态分支混在一起,短期很快,长期很乱。

所以 agent-native 架构的目标不是"让 agent 多写代码",而是:

> 把代码库设计成 agent 可以安全修改、快速实验、可控收敛的系统。

## 2. 从"前后端分离"到"变化速度分层"

传统工程里最常见的分界是:

```txt
frontend / backend
```

但在现代全栈项目里,页面、HTTP endpoint、serverless function、edge runtime、有状态服务、wallet SDK、React hooks、第三方 API、链上 SDK 经常混在同一个 repo 里。这个时候"前端/后端"仍然有意义,但不够指导 agent 怎么安全改代码。Next.js 的 `app/api/*`、Cloudflare Worker 的 `fetch()` handler、普通 Node 服务的 route handler 都是后端入口,只是 runtime 不同。

Agent 时代更重要的分界是:

```txt
稳定层 / 可变层 / 实验层
```

稳定层:

- 产品数学
- 交易构造
- 链上规则
- 结算规则
- 风控规则
- API contract
- HTTP / worker route behavior
- external service adapters
- stateful service invariants

可变层:

- 页面信息架构
- view model
- 页面状态组合
- API response shaping
- cache / retry policy
- runtime placement
- 产品文案
- layout
- 主题

实验层:

- 视觉方向
- 页面 variants
- 假数据状态
- demo copy
- theme tokens
- branch prototypes

Agent 可以频繁改实验层,谨慎改可变层,默认不碰稳定层。

## 3. Runtime adapter 也是架构边界

如果一个文件负责这些事情,它就是后端边界:

- 接收 HTTP request
- 调外部服务
- 读写数据库或链上数据
- 隐藏 API key 或环境变量
- 聚合多个数据源
- 处理缓存、重试、allowlist、rate limit
- 返回稳定 response contract
- 管理有状态对象、队列、定时任务或后台 worker

不同 runtime 只是不同 adapter:

```txt
Next.js:
  app/api/*
  server actions
  route handlers

Cloudflare:
  Workers fetch handler
  Pages Functions
  Durable Objects / stateful coordination
  Queues / Cron Triggers

Serverful Node:
  Fastify/Express/Hono routes
  background workers
  long-lived processes

Shared backend:
  src/server/*
  external API clients
  chain indexer / transaction preflight services
```

Agent-native 架构不是把这些后端拆到另一个 repo 才算清楚,也不是绑定某一个框架才算清楚。真正要保持的是 contract、adapter、application 和 domain 的边界。部署到 Next、Cloudflare、普通 VPS 或有状态服务,只是最外层 runtime adapter 的替换。

## 4. 理想分层

一个 agent-native 产品项目可以按下面的层次组织:

```txt
1. Domain Core
   产品规则、数学、状态机、报价、结算
   纯 TypeScript, 不依赖 React / Next / Cloudflare / CSS

2. Application Layer
   用例编排
   例如 subscribe、claim、settle、validate、preflight

3. Contracts
   稳定边界
   API response schema、view model schema、event shape、error shape、state transition shape

4. Server Adapters
   后端连接器
   HTTP handlers、serverless functions、Workers、stateful services、外部 API、链 RPC、数据库、缓存、队列

5. Client Adapters
   客户端连接器
   React Query hooks、wallet SDK、browser storage、client-side polling

6. Containers
   页面运行时容器
   调 hooks、读 URL、拿 wallet、处理 loading/error、提交 action

7. ViewModel Layer
   把复杂业务数据整理成页面直接可渲染的数据结构

8. Pure Views
   完整页面 UI
   不 fetch、不连钱包、不读 URL、不调链、不构造交易

9. Design System
   tokens、components、layout primitives、product components、themes

10. Design Lab
   fixtures、stories、/design preview、state matrix、visual snapshots

11. Production Shell
   framework routing、metadata、providers、deployment/runtime glue
```

这不是为了制造很多目录,而是为了让每种变化都有明确落点。

## 5. 两个核心公式

把页面理解成一个纯函数:

```txt
ViewModel + Theme + Locale + Viewport -> Rendered Page
```

把 HTTP/backend endpoint 理解成另一个纯边界:

```txt
Request + Config + External Services -> Contracted Response
```

理想状态下,完整页面可以不依赖真实系统运行:

```tsx
<DashboardView model={dashboardPopulatedFixture} />
<DashboardView model={dashboardEmptyZhFixture} />
<DashboardView model={dashboardErrorFixture} />
```

这就是 code-native design lab 的基础。

理想状态下,API 也可以用 deterministic fixtures 测试:

```txt
Predict fixture + current time -> current APR response
Portfolio fixture + manager fixture -> dashboard backend response
```

这就是 agent 不污染后端逻辑的基础。

## 6. Pure View 是什么

Pure View 不是小组件,而是完整页面。

它可以包含:

- 页面布局
- section
- table
- card grid
- button
- empty state
- error state
- responsive layout
- local UI state, 比如展开/收起、tab 选择

它不应该包含:

- `useQuery`
- wallet SDK hook
- API fetch
- transaction builder
- pricing math
- settlement math
- URL parsing
- environment variable
- localStorage side effect

Pure View 的输入应该是页面模型:

```ts
export type DashboardViewModel = {
  locale: 'en' | 'zh';
  state: 'no-wallet' | 'loading' | 'error' | 'empty' | 'populated';
  hero: {
    title: string;
    subtitle: string;
  };
  portfolio?: {
    totalDeposited: string;
    expectedRewards: string;
    openPositions: string;
  };
  positions: PositionCardViewModel[];
};
```

这样 agent 改 UI 的时候,不用理解钱包、链、API 和结算细节。反过来,agent 改 API contract 的时候,也不应该顺手改页面视觉。

## 7. Fixture-first product development

传统开发常见流程是:

```txt
先接真实数据 -> 页面能跑 -> 再处理 loading/error/empty
```

Agent-native 推荐反过来:

```txt
先列产品状态矩阵 -> 写 fixtures -> 设计完整页面和 API contract -> 接真实数据
```

每个核心页面至少需要这些 view fixtures:

- no wallet
- loading
- error
- empty
- populated
- populated with many rows
- long text / long address
- Chinese
- English
- mobile stress

每个关键后端入口至少需要这些 server fixtures:

- upstream success
- upstream timeout
- upstream malformed response
- empty result
- stale snapshot
- permission/allowlist failure
- deterministic current time

这会逼迫产品经理和工程师先说清楚页面到底有哪些状态。

## 8. Design System 的升级

传统 design system:

```txt
Color
Typography
Button
Card
Input
Badge
```

Agent-native design system:

```txt
Tokens
Primitive components
Layout primitives
Product components
Page views
Fixtures
State matrix
Copy dictionary
Theme variants
Agent edit rules
Visual QA
```

换句话说,设计系统不再只是 UI 组件库,而是 agent 可操作的产品界面实验室。

## 9. 工具应该怎么理解

工具不是核心答案,但工具可以承载某一层能力。

Storybook:

- 不只是看小组件,也可以看完整页面
- 适合状态矩阵、fixtures、视觉回归
- 前提是页面已经可以用假数据纯渲染

`/design` preview:

- 更接近真实 app shell
- 适合产品经理直接点 URL 看完整页面
- 可以是 Next route、独立 preview app、Storybook iframe、Cloudflare preview URL
- 适合组合 query 参数: `?state=populated&theme=terminal&locale=zh`

Branch prototypes:

- 适合同时试 3-5 个视觉方向
- 需要限制改动范围,否则 branch 会变成多个不同版本的混乱生产代码

Visual builder:

- 适合拖拽和局部编辑
- 必须建立在稳定组件和 token 之上
- 不能替代架构边界

## 10. Agent edit boundary

Agent-native repo 必须明确哪些文件能改。

建议规则:

```txt
Green zone: 可以大胆改
- views
- fixtures
- stories
- themes
- copy
- visual-only CSS

Yellow zone: 谨慎改
- viewModel
- containers
- hooks
- framework routes / HTTP handlers
- runtime adapters

Red zone: 默认不碰
- products
- application
- sui
- transaction
- pricing
- settlement
- API contracts
```

这类规则应该写进 `AGENTS.md` 或 `docs/architecture.md`,因为它是给 agent 的操作边界。

## 11. Branch 工作流

推荐:

```txt
main
  stable production

codex/design-dashboard-minimal
codex/design-dashboard-terminal
codex/design-dashboard-premium
codex/design-dashboard-sticker
```

每个设计 branch 只能改:

- pure views
- themes
- fixtures
- stories
- copy

选中方案后:

1. 对比同一批 fixtures 的截图
2. 把胜出的 view/theme 收敛回主线
3. 删除未采用的实验代码
4. 保证 production container 和 domain core 没被污染

Branch 解决并行实验,架构边界解决长期可维护。

## 12. Framework/runtime 在这个架构里的位置

Next.js、Cloudflare Workers、Hono、Fastify、serverful Node 都不是问题;问题是让 runtime 变成业务架构。

Framework/runtime 应该负责:

- routing / HTTP handling
- metadata
- server/client composition, if applicable
- providers / runtime bindings
- backend entry adapter
- deployment glue
- platform-specific state, queue, cron, durable coordination adapters

Framework/runtime 不应该承载:

- 产品数学
- 复杂状态机
- 链上交易规则
- 外部 API response contract 的隐式变形
- 页面大段 JSX + fetch + formatting 混写
- 视觉实验的主要场地

理想的 page / screen entry 应该很薄:

```tsx
export default function Page() {
  return <DashboardPageContainer />;
}
```

理想的 backend endpoint 也应该很薄:

```ts
export async function handleCurrentApr(request: Request, runtime: RuntimeBindings) {
  const input = parseRequest(request);
  const result = await getCurrentApr(input, buildAdapters(runtime));
  return Response.json(toCurrentAprResponse(result));
}
```

业务规则在 application/domain, HTTP handler 只做 runtime adapter。今天这个 handler 可以包成 Next route;明天可以包成 Cloudflare Worker;如果需要有状态协调,也可以把 stateful 部分放进专门的 state adapter,而不是散落在页面或 API handler 里。

## 13. 反模式

需要警惕这些情况:

- 一个 page component 同时 fetch、format、branch、render、style
- 一个 HTTP handler 同时 parse request、调多个外部服务、做业务规则、拼 response、吞错误
- agent 为了改视觉去改 hook 或交易逻辑
- agent 为了改 demo 数据去改真实 API response
- 文案散落在 JSX 里,没有 locale/copy 层
- loading/error/empty 只有真实触发时才看得到
- 后端错误状态只有真实第三方服务挂掉时才看得到
- runtime-specific binding 泄漏进 domain core
- 为了迁移部署平台而改产品规则
- 每个视觉实验都复制一整套页面
- Tailwind class 或 CSS class 无约束堆叠
- design system 只抽 Button,但完整页面仍然无法假数据运行
- Storybook 只有 primitive components,没有 page states
- branch 实验没有收敛规则

## 14. 学习路线

第一阶段: 建立分层意识

- 理解 domain / application / adapter / container / view 的区别
- 看现有项目中哪些逻辑属于稳定层,哪些属于实验层
- 练习把一个页面拆成 container + view model + pure view
- 练习把一个 HTTP endpoint 拆成 runtime handler + application service + external adapter
- 练习把部署平台能力包成 adapter,例如 KV/cache、queue、cron、durable state

第二阶段: 建立状态矩阵

- 为一个页面列出所有用户状态
- 为每个状态写 fixture
- 用同一个 Pure View 渲染这些 fixture
- 为一个 backend endpoint 列出 upstream success/error/stale 状态

第三阶段: 建立设计实验室

- 用 Storybook 或 `/design` preview 展示完整页面
- 增加 theme / locale / viewport 切换
- 加入截图验证

第四阶段: 建立 agent 工作流

- 写清楚 green/yellow/red edit zones
- 规定 design branch 只能改哪些目录
- 规定 merge 前必须通过哪些截图和测试

第五阶段: 产品化

- 把核心页面都转成可假数据渲染
- 把文案和国际化抽出来
- 把视觉 tokens 主题化
- 把设计探索变成稳定流程

## 15. 最终目标

一个成熟的 agent-native 产品系统应该满足:

- 真实产品可以运行
- 完整页面可以用假数据运行
- 后端 API 可以用 deterministic fixtures 验证
- API contract 明确且有测试
- runtime adapter 可以替换或迁移
- 有状态服务有明确 state transition contract
- 每个核心页面有状态矩阵
- 每个核心页面支持语言切换测试
- 每个核心页面支持 theme/density 试验
- agent 知道哪些文件可以改
- 视觉实验不会污染业务核心
- demo 数据不会污染真实后端 contract
- 选中方案可以干净合并回生产代码
- 代码生成速度快,维护成本不失控

最短总结:

> Agent-native architecture = production app + runnable design lab + explicit edit boundaries.
