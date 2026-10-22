# AIoT 智慧温室种植系统

React 18 + TypeScript + Vite 温室管理系统，包含仿真、外部网关接入与回放运行类型。现已增加 Python 标准库 + SQLite 独立数据服务，支持持续采集、环境日报、灌溉事件复盘与人工核查；已有监测、控制、报警和答辩能力保留。

## 当前接入结论（2026-10-22 仓库审查）

不能由旧文档推断现场没有接硬件，也不能由 external 配置推断硬件已经在线。本仓库可确认的证据如下；现场可能存在独立服务，其部署与接线结果需另行核对。

| 能力 | 接口／模拟 | 真实接入代码 | 当前环境通信验证 | 真实设备动作反馈验证 |
|---|---|---|---|---|
| 传感器数据 | 本地模拟器、自定义网关 DTO | 已有 HTTP GET 客户端和严格校验；未发现设备原生 REST/MQTT/Modbus 适配服务 | 仅隔离 mock 验证；无现场通信结论 | 未验证 |
| 控制 | 模拟执行回执、命令协议 | 已有 HTTP POST 网关客户端、初始同步和后续 GET 执行器轮询 | 仅 mock 网关；不调用现场控制接口 | 未验证；输出通道回读也不能等同物理动作 |
| 边缘服务 | 原控制网关协议保留 | 新增独立只读数据服务；不替代现场控制网关 | SQLite、线程采集与本机 HTTP/浏览器隔离验证；未访问现场服务 | 未验证 |
| 存储与分析 | 浏览器缓存、SQLite 分区及历史查询 | 新增去重原始采样、事件、版本化上下文、日报与灌溉效果分析 | 确定性样例、备份恢复及浏览器验证 | 现场连续数据与实际效果未验证 |
| AI | 离线演示适配器 | 已有自定义网关推理客户端和响应校验；没有模型服务源码 | 模拟与客户端 mock 测试，真实模型未验证 | 不适用，AI 不下发控制命令 |
| 回放 | 运行类型预留，控制禁用 | 尚无时间序列回放引擎 | 空数据状态／隔离行为测试 | 不适用 |
| 安全保护 | 界面及协议设计 | 未发现服务端租约、最大连续运行、到期恢复实现 | 未验证 | 未验证 |

当前目录为 Git 仓库，本轮开始时工作树干净。现场运行配置未提供；新增数据服务示例默认禁用采集。设备持有清单与禁用 I/O 映射示例不是通信证据。未改动阈值、寄存器、I/O 分配或联锁，也未覆盖不可访问的现场独立服务。

## 数据应用升级：快速运行

需要 Python 3.11+，无需 pip 安装第三方包。详细模型、计算口径、手算样例、接口、迁移及备份恢复见 [数据应用说明](docs/data-application.md)。

```powershell
# 持续模拟采集及明确标注的软件测试样例，使用独立 simulation 分区
python -m edge_data --config edge_data/demo.config.json --load-test-fixture
```

另一个终端：

```powershell
$env:VITE_DATA_SERVICE_URL='http://127.0.0.1:8090'
node node_modules/vite/bin/vite.js --host 127.0.0.1
```

进入“数据分析”，选择 `software-test-zone`，查看 2026-10-20 08:00～08:10（Asia/Shanghai）的可核对样例；`simulation-zone` 是不依赖浏览器的持续模拟采集。两者都不是真实农艺证据。

不需要模拟时使用 `python -m edge_data --config edge-data.config.example.json`，默认无采集源，不生成数据。接入现场前核对配置与只读接口，不能把示例地址当作可用服务。

日报按真实时间间隔积分，区分有效、超限、目标未知与缺失。目标、作物和阶段未配置时只展示描述统计。灌溉区分请求、网关状态、输出回读、物理反馈与停止反馈；观察期未结束或证据不足时不会标为效果已证实。人工浇水、维护、校准等可关联复盘。

## 运行流程

- 顶部、首页、环境、控制、设备页使用同一状态口径。指标逐项显示仿真、硬件上报、回放或待核实来源；硬件上报仍需现场核验。
- 数据质量区分正常、过期、离线、无效和故障。采集时间、接收时间、最后有效时间独立记录。无效数据不覆盖最后有效值，不参与新自动决策。
- 外部模式从空读数和未知反馈开始。HTTP 响应成功不能掩盖重复旧采样；断线仍按各指标采集时间过期。
- 首页默认运行视图，先展示结论、异常和关键设备，再展示环境指标。演示视图只改变展示；演示操作在 external/playback 禁用。
- 报警保留首次／最近触发、持续时长、依据、位置和关联策略。可查看关联设备、期间控制记录，保存处理备注与时间。
- “已确认”“数据恢复”“人工处理完成”分别记录。确认与备注不会解除异常；数据失效不会使环境报警自动恢复。没有账号时不指定操作人员。
- 控制分目标、命令处理、网关／输出／物理反馈层级。缺少 actual 时显示未知；失败保留最后反馈和时间，不能推断设备已停止。
- 外部连接默认只监测。本次浏览器会话显式授权后才允许控制；刷新不恢复授权，通信故障撤销授权，不自动重发失败命令。授权操作本身可能导致后续设备命令，应仅在现场准备完成后使用。
- 自动→手动保留当时目标；手动→自动按现有统一策略重算。涉及全部四个逻辑执行设备。仿真、回放和来源未知的输入不允许驱动外部自动控制。
- 浏览器策略不提供连续运行安全保证。定时接管、到期恢复、最大连续运行、断电／服务重启恢复均未生效或未验证，界面明确说明。参见 [运行可信度与边缘协议](docs/runtime-evidence.md)。

## 指标与历史边界

- 今日灌溉统计按浏览器本地日期计算已记录的仿真停止→运行次数；跨日归零口径，不再显示累计次数为今日次数。
- 仿真运行时长是模拟周期累计；外部模式因反馈连续性和层级不足，启动计量／运行时长显示数据不足。没有流量计与电表，不提供实测用水量、实测节水率或节能率。
- 估算节水是模拟基线对比，并明确标为演示。外部模式不使用该指标。
- 既有浏览器缓存仍保留环境 500 条、控制 500 条、报警 40 条、人工备注每报警 30 条及 AI 复核 100 条，不当作完整历史。清理浏览器会丢失这些缓存。
- 新增独立数据服务按来源隔离 SQLite 文件，默认保留 90 天，前端通过历史查询接口访问，缺失时段不填造。没有多人同步或高可用保证；备份与恢复使用 SQLite 在线备份及新的恢复目录。
- 仿真可以保留示例历史并明确来源；导入快照只允许 simulation，不导入外部运行配置。旧 v2 仿真保存兼容，没有逐日启动记录时不从累计数反推。

## AI 使用边界

simulation 使用人工选择的演示结果，不是模型判断。external 只有配置网关地址、edge-gateway 提供者及显式启用后才调用 POST /api/v1/ai/infer；失败不会回退伪造结果。识别结果支持人工确认、纠正和待复查备注。复核不改写模型原始结果，不会触发设备动作。

## 运行与检查

需要 Node.js 20.19+ 或 22.12+；独立数据服务需要 Python 3.11+。保持现有 React/TypeScript 架构，无新增第三方依赖。

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test:run
npm run test:data
npm run build
npm run build:offline
npm run test:e2e
```

默认开发地址 http://127.0.0.1:5173。离线构建生成可双击打开的 dist/index.html；离线构建固定使用仿真通道。

本机 Codex 环境没有 npm 命令时，可使用现有依赖的等价 CLI：

```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
node node_modules/vite/bin/vite.js build --mode offline
node scripts/inline-offline.mjs
node node_modules/@playwright/test/cli.js test
```

浏览器测试配置显式隔离：5173 为 simulation，5174 为 external + mock-gateway.invalid；新增 5175 分析前端与 8091 临时软件样例服务。外部控制请求全部由 mock 拦截，分析项目禁止访问网关；不复用已有服务器。离线测试使用仿真单文件包。没有匹配的 Playwright Chromium 时，可指定已安装的 Edge（PowerShell）：

```powershell
$env:PLAYWRIGHT_BROWSER_CHANNEL='msedge'
node node_modules/@playwright/test/cli.js test
```

## 主要代码

- src/simulator/simulatorReducer.ts、stateEvidence.ts：状态归约、证据关联、质量失效与隔离。
- src/utils/runtimeStatus.ts：统一中文状态、运行结论和控制说明。
- src/channels/：数据／控制／AI 客户端与 DTO 校验。
- src/hooks/useGreenhouseSimulator.ts：通道生命周期、会话授权和本机存储。
- src/pages/：运行总览、环境、控制、AI、报警、设备及项目介绍。
- src/components/HistoryReview.tsx：时间范围复盘。
- edge_data/：独立采集、SQLite、日报、灌溉重建、HTTP API、迁移与测试。
- src/analysis/、src/pages/DataAnalysis.tsx：类型校验的历史客户端、统计、图表与人工核查。
- src/config/hardwareConfig.ts 与 integrations/advantech/：持有清单及禁用接线示例。
- docs/advantech-integration.md、docs/edge-compute-deployment.md：接线与部署规划；规划内容不能当作已部署事实。

## 2026-10-22 数据应用升级验证记录

- Python 标准库数据服务：30 项隔离测试通过，覆盖去重、乱序、来源分区、历史配置、不规则积分、跨日、灌溉证据、中断重启与备份恢复。
- TypeScript 两套配置检查、ESLint 零警告通过；Vitest 27 个文件、102 项测试通过。
- Playwright 14 项通过，覆盖既有仿真/外部 mock/离线流程及新增日报、灌溉详情、人工备注、种植上下文；已检查桌面与 390px 移动端截图。
- 标准构建与单文件离线构建通过；故意带入 external、网关和数据服务地址构建离线包，浏览器验证无 API 请求。
- 确定性样例的 600 秒窗口：有效 360 秒、覆盖率 60%、加权湿度 38.1666667%、测试目标内 150 秒、超限 210 秒。样例仅用于核对软件，不是农艺标准。
- 没有访问现场服务、操作真实设备、修改现场控制参数或部署生产环境。现场通信和真实灌溉效果仍未验证。

## 2026-10-19 既有功能验证记录

- TypeScript 严格类型检查、ESLint 零警告通过。
- Vitest：24 个测试文件、95 项测试通过。
- Playwright：11 项通过，使用本机 Edge headless 独立浏览器上下文，覆盖开发仿真、file:// 离线包与外部 mock 网关。
- 已检查桌面、390px 移动端页面截图；主要页面导航无页面异常，移动端无横向溢出。
- 已执行标准构建和单文件离线构建，未新增依赖。
- 首次 Chromium 启动因缓存版本不匹配失败，改用本机 Edge 后完成验证；浏览器外部 mock 测试发现并修复原生 fetch 接收者错误。
- 离线隔离回归：故意带入 external、网关地址与真实 AI 提供者配置构建，4 项离线浏览器测试仍通过，仿真主链路无网关请求。离线模式由 vite.config.ts 强制隔离。
- 全程未调用现场网关、未执行真实设备动作、未改控制阈值／接线映射、未部署或推送。上述结果只证明软件与 mock 流程，不构成真实硬件验证。
