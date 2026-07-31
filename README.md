# AIoT 智慧温室种植系统

这是一个面向大学生创新创业项目申报和现场答辩的 **React + TypeScript AIoT 智慧温室原型**。项目采用研华远程 I/O 与可替换边缘计算节点，使用可测试的本地模拟器展示“数据采集 - 规则判断 - 设备执行 - 状态反馈”闭环。

> 重要：当前没有连接真实传感器、MQTT、后端数据库、YOLO/YieldNet 模型或真实控制器。页面中的识别、节水率和节能率均明确标注为演示或策略估算。

> 边缘节点说明：本系统不绑定特定边缘计算硬件。当前原型可使用普通 Windows 笔记本或台式机运行边缘网关、控制策略、数据存储、AI 推理客户端和 React 页面；后续可迁移至 Jetson、工业计算机或其他兼容平台。

## 当前系统架构

```text
传感器
  ↓
WISE-4012
  ↓ Wi-Fi / 局域网
路由器或 Wi-Fi AP
  ↓
EKI-2525
  ├── ADAM-6050 ── 水泵 / 风机 / 补光灯 / 遮阳机构
  └── 可替换边缘计算节点
        ├── 边缘网关
        ├── 确定性控制策略
        ├── 数据存储
        ├── 可替换 AI 推理提供者
        └── React 控制平台
```

当前参考边缘节点是 Windows 笔记本或台式机。未来可替换为 Jetson、工业计算机或其他兼容平台。React 前端只访问项目自定义边缘网关，不直接连接研华设备，也不保存设备账号、密码、MQTT 凭据、Token 或密钥。

### 当前参考方案

- WISE-4012：计划负责温度、湿度、土壤湿度、CO₂、光照等真实环境数据采集。
- ADAM-6050：计划负责水箱低液位、设备反馈、限位、急停等数字输入，以及水泵、风机、补光灯、遮阳机构等数字输出。
- EKI-2525：负责工业以太网交换，不提供前端业务 API。
- Windows 计算机：当前原型阶段的参考边缘网关与 AI 推理节点，不是永久固定硬件。
- React：监控和控制界面，通过 HTTP/WebSocket 访问项目自定义边缘网关。

MIC-711D 不再作为当前原型的必要依赖。项目采用硬件解耦架构，可根据条件选择普通计算机、Jetson 或工业边缘计算平台。

## 已实现

- 7 个演示页面：数据总览、环境监测、智能控制、AI 识别、报警中心、设备管理和项目介绍。
- 每 2.6 秒生成一次单帧模拟快照，同一帧内更新读数、控制目标、实际状态和报警；随机序列由可记录的种子驱动。
- 答辩场景控制台：可一键切换正常运行、土壤干旱、高温高 CO₂、传感器离线和水泵故障，并支持暂停、继续、单步、重置、复制或更新随机种子。
- 统一的温室策略配置，包含滴灌启停回差、通风、补光、遮阳和告警阈值。
- 传感器离线后数据中断，保留最后有效值和更新时间，并阻止依赖无效数据的新控制指令。
- 执行器区分“目标状态”与“实际状态”；设备离线时指令会失败并产生报警。
- 报警去重、累计次数、确认和恢复生命周期。
- 带版本的 `localStorage` 持久化，数据损坏或版本不兼容时安全回到初始状态。
- 数据与控制通道：已实现本地模拟通道，以及面向本项目边缘网关协议的 HTTP 轮询数据通道和 HTTP 控制通道；WebSocket 事件信封、MQTT 和 Modbus TCP 仍仅为协议预留，绝不伪装为已连接。
- 已完成：研华接入接口、边缘网关协议、运行时校验和 I/O 映射示例预留；尚未完成真实硬件通信、寄存器映射或 MQTT/Modbus/REST 设备接入。
- 已完成：simulation 与 external 运行链路隔离；external 会先完成网关健康检查与执行器状态同步，再授权控制。控制失败会保留最后已知实际状态。
- 传感器包包含来源、采集/接收时间、单位、质量和有效性；`good`、`stale`、`offline`、`invalid`、`error` 明确区分，非 `good` 数据不应参与自动控制。
- 可导入/导出演示快照（独立 `snapshotVersion`），导入前校验 JSON、版本、场景、质量、读数、设备和运行模式；失败不会改写当前状态。
- 报警中心支持时间、等级、状态、设备/传感器和关键词筛选，并可导出当前或全部结果 CSV；CSV 使用 UTF-8 BOM。
- 答辩场景关键操作保存为上限 200 条的轻量操作记录，可从控制台导出 CSV。
- AI 演示识别适配器：验证图片类型、大小和解码，支持预览与稳定内容指纹，结果来自用户明确选择的演示场景。
- 可替换 AI 推理通道：simulation 使用离线模拟通道；external 可显式启用项目自定义 `POST /api/v1/ai/infer` 客户端，响应从 `unknown` 开始校验。
- 独立边缘节点配置：节点类型、节点名称、网关地址和 AI 提供者与 simulation/external/playback 运行模式分开。
- 基于模拟基线和设备运行时长/功率的策略节水、节能估算；样本不足时显示“数据不足”。
- ESLint、Vitest、React Testing Library、TypeScript 类型检查和一键工程检查。

## 未实现／预留方向

- 真实温湿度、光照、土壤湿度和 CO₂ 传感器。
- 真实设备的 MQTT、Modbus TCP、研华原生 REST 或 WebSocket 实时接入。
- 后端服务、数据库和云端同步。
- YOLO、YieldNet 或其他真实图像推理服务。
- PLC、继电器、LoRa 网关或边缘控制盒。
- 基于真实流量计和电表的节水节能计量。

## 核心策略

策略位于 `src/simulator/policy.ts`，页面文案、控制引擎和报警共用该配置。当前滴灌策略为：

- 土壤湿度低于 36% 时开启水泵。
- 高于 45% 时关闭水泵。
- 低于 34% 时产生高风险告警。

36%-45% 之间保持上一状态，用于避免在阈值附近频繁启停。这三个数值用途不同，但来自同一配置源。

## 代码结构

```text
src/
  simulator/
    policy.ts                 # 统一策略和页面解释
    readingSimulator.ts       # 可测试的读数生成
    controlEngine.ts          # 启停回差、目标和实际状态
    alarmEngine.ts            # 报警去重与生命周期
    metricsEngine.ts          # 节水节能演示估算
    persistence.ts            # 带版本本地持久化
    aiRecognitionAdapter.ts   # 演示／远程识别适配器
    simulatorReducer.ts       # 单帧状态归约
  channels/                   # 模拟/边缘网关数据与控制通道、协议校验和通道工厂
    ai/                       # 模拟/边缘网关 AI 推理通道及严格 DTO 校验
  config/
    edgeNodeConfig.ts         # 可替换边缘节点与 AI 提供者配置
    runtimeConfig.ts          # simulation/external/playback 与通信时限
  snapshots/demoSnapshot.ts   # 快照格式、导出与导入校验
  utils/exportFile.ts         # file:// 可用的 JSON/CSV 下载和 CSV 转义
  hooks/
    useGreenhouseSimulator.ts # 调度、持久化和 UI 交互入口
```

## 安装与运行

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

默认地址：`http://127.0.0.1:5173`

根目录的 `index.html` 是源码入口，不能直接双击打开。

## 离线答辩包

若需要把项目交给没有 Node.js 环境的答辩电脑，请执行：

```bash
npm run build:offline
```

命令会生成单个 `dist/index.html`。该文件内联了样式和应用模块，可直接双击通过 Chrome 或 Edge 打开；不需要本地服务器。常规 `npm run build` 保持原有的标准多文件生产构建方式。

## 边缘网关预留

默认仍是 `simulation`，不会发出外部网络请求。若后续部署边缘网关，可复制 `.env.example`，设置独立的边缘节点配置，并显式将 `VITE_RUNTIME_MODE` 设为 `external`。缺少 `VITE_EDGE_API_BASE_URL` 时页面会明确显示“边缘网关未配置”，不会假装已连接，也不会自动回退到模拟器。节点类型只描述部署位置，`local-pc` 不等于已连接；连接状态仍由 `GET /api/v1/health` 和后续数据状态决定。

AI 提供者取值为 `simulation`、`edge-gateway` 或 `disabled`。只有在 external 模式下同时配置网关地址、`VITE_EDGE_AI_PROVIDER=edge-gateway` 和 `VITE_EDGE_AI_ENABLED=true`，前端才会调用项目自定义 `POST /api/v1/ai/infer`。没有真实 AI 服务时不会生成伪造成功结果。AI 输出只用于识别、报警和建议，水泵、风机、补光与遮阳仍由确定性规则和人工控制决定。

所有 `VITE_` 变量会暴露给浏览器，禁止放密码、Token 或设备密钥。

详细协议、命令生命周期、I/O 映射和真实接入资料清单见 [docs/advantech-integration.md](docs/advantech-integration.md)。边缘节点部署、职责边界和迁移步骤见 [docs/edge-compute-deployment.md](docs/edge-compute-deployment.md)。

## 技术栈

### 前端基础

| 分类 | 技术 | 项目中的用途 |
|---|---|---|
| 前端框架 | React 18 | 组成数据总览、环境监测、控制、报警等页面，并通过 `lazy` 按页面加载。 |
| 开发语言 | TypeScript 5 | 为温室读数、设备状态、控制命令、网关 DTO 和页面参数提供严格类型。 |
| 构建工具 | Vite 8 | 提供本地开发服务器、生产构建和离线构建。 |
| 页面与视觉 | HTML5、原生 CSS、React JSX | 构建界面；图标和趋势图由项目内 React 组件及原生 SVG 实现，未使用路由、Redux、Tailwind 或第三方图表库。 |

### 状态管理与业务架构

- 使用 React Hooks、`useReducer` 和自定义 `useGreenhouseSimulator` 统一管理模拟状态、持久化、场景操作和通道生命周期。
- `simulatorReducer` 只根据 action 归约状态；`controlEngine` 使用纯函数计算自动控制目标，不直接发网络请求或创建通道。
- `SensorDataChannel` 与 `DeviceControlChannel` 抽象数据和控制边界；`createRuntimeChannels` 通过工厂在 simulation、external、playback 模式间替换通道，测试可注入替代实现。
- `AiInferenceChannel` 抽象 AI 推理提供者；模拟通道保持离线演示，边缘网关通道只负责请求、DTO 校验和结果展示，不包含真实模型。
- 执行器的目标状态与实际状态分开保存。模拟模式使用确定性模拟回执；外部模式只能以网关控制响应写入实际状态。

### 数据、通信与本地存储

已实现：

- 面向项目自定义边缘网关的 HTTP 轮询：`GET /api/v1/sensors/latest`，含 `AbortController` 超时、重复连接保护、订阅取消和 stale 标记。
- 面向边缘网关的 HTTP 控制：`POST /api/v1/control/commands`，含幂等键、命令状态、HTTP 非 2xx 和无效 JSON 的失败处理。
- 带 `schemaVersion` 的网关 DTO、轻量 TypeScript 运行时校验、`good/stale/offline/invalid/error` 数据质量区分。
- AI 推理客户端 DTO 与运行时校验，包括 requestId、置信度、边界框、状态和错误响应校验。
- `localStorage` 状态持久化，以及 JSON 快照和 UTF-8 BOM CSV 的导入导出。

尚未实现：真实 MQTT Broker、真实 Modbus TCP、研华设备原生 REST 适配、真实 WebSocket 连接、正式后端服务和数据库。WebSocket 目前只有事件协议类型，不会建立浏览器连接。

### 工业物联网与研华硬件规划

- WISE-4012 计划采集温度、湿度、土壤湿度、CO₂ 和光照等环境数据。
- ADAM-6050 计划读取数字输入，并驱动水泵、风机、补光灯和遮阳等数字输出。
- EKI-2525 仅计划作为工业以太网交换机，不提供前端业务控制 API。
- React 前端不会直接访问工业设备；后续由边缘网关统一适配 REST、MQTT 或 Modbus TCP。
- 当前只提供网关软件接口和禁用的 I/O 映射示例，未连接真实 WISE-4012、ADAM-6050 或 EKI-2525。
- MIC-711D 只可作为未来候选设备之一，不是当前必需设备，也未被描述为已经接入。

### 测试与质量保障

| 范围 | 工具与方式 |
|---|---|
| 类型检查 | TypeScript `tsc --noEmit`，项目启用 `strict`。 |
| 单元与组件测试 | Vitest、JSDOM、React Testing Library，覆盖策略、reducer、通道、快照、持久化和主要组件。 |
| 端到端测试 | Playwright，在开发服务器和离线 `file://` 页面验证答辩主链路。 |
| 代码规范 | ESLint、`typescript-eslint`、React Hooks 规则。 |
| 自动化工作流 | 当前仓库未发现 GitHub Actions 配置。 |

### 构建与运行模式

- `npm run dev` 启动 Vite 开发服务器；`npm run build` 生成常规生产构建。
- `npm run build:offline` 生成可直接打开的单文件 `dist/index.html`；离线构建默认使用 simulation，不会主动访问边缘网关。
- `.env.example` 提供独立的运行模式、边缘节点、AI 提供者、边缘网关 URL、轮询间隔、超时和 stale 时限。默认模式为 simulation；external 缺少 API URL 时显示未配置，不自动回退。
- playback 已预留运行类型且不会建立网络连接，目前未实现完整的快照时间序列回放；仓库没有 Docker、云端部署、正式服务器或数据库配置。

## 答辩场景控制台

控制台位于“数据总览”页顶部。切换场景后，系统仍复用同一套读数模拟、自动控制、设备执行和报警引擎。

1. **土壤干旱**：第一步进入低湿度区间，水泵启动；随后湿度逐步恢复，报警解除。
2. **高温高 CO₂**：第一步触发环境报警和风机；后续步骤逐步降温、降低 CO₂，风机停止且报警恢复。
3. **传感器离线**：土壤传感器被注入离线状态，读数变为不可用，自动灌溉不再使用该数据；第 4 步恢复上线。
4. **水泵故障**：存在灌溉需求但水泵处于离线状态，目标开启、实际停止，并产生控制失败报警；第 4 步恢复执行。

“暂停模拟”会停止自动周期；“单步推进”每次只执行一个完整周期。重置当前场景会保留种子并从场景起点复现；生成新种子会重新开始当前场景。

“答辩复位”会将系统恢复为固定种子、正常运行、暂停、步数 0、全部设备在线和安全默认设备状态；已恢复的历史报警与操作记录保留。

## 工程检查

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run build:offline
npm run check
npm run test:e2e
```

`npm run check` 会依次执行类型检查、ESLint、自动化测试和生产构建。

## 当前项目阶段

### 已完成

- simulation 模式、external 软件接口和 playback 类型预留。
- 边缘网关 DTO、HTTP 数据与控制通道、运行时校验和 I/O 映射示例。
- 独立边缘节点配置及 simulation、edge-gateway、disabled AI 提供者。
- AI 演示页面、离线答辩构建、数据监控、确定性控制、报警与设备管理。

### 尚未完成

- 真实 WISE-4012、ADAM-6050 联调和真实传感器、继电器接线。
- 正式边缘网关服务、真实 MQTT、Modbus TCP 和研华原生 REST 适配。
- 真实 AI 模型、摄像头采集、正式数据库和云端部署。
- 断网、断电、低液位、限位和急停的现场安全验证。

后续迁移只替换操作系统适配、服务启动方式、GPU 推理后端和摄像头驱动；网关 API、DTO、控制规则、前端页面和数据库模型保持硬件无关。

## 答辩演示建议

1. 在“数据总览”明确说明当前是本地模拟快照。
2. 在“智能控制”讲解 36% 启动、45% 停止的回差策略。
3. 在“设备管理”将土壤传感器或水泵设为离线，展示数据中断、控制失败和报警。
4. 恢复设备在线，展示业务流恢复且报警不重复爆增。
5. 在“AI 识别”选择演示场景，强调这是适配器流程，不是真实模型精度演示。
6. 刷新页面展示控制模式和报警确认仍保留，最后使用二次确认的“重置演示数据”。

## 构建体积

整改前的单一主 JS 产物为 553,788 字节（Vite 显示 549.73 kB）。整改后移除 `recharts`，改用原生 SVG 趋势图，并对 7 个页面按需加载。主 JS 产物约为 174 kB，不再出现 500 kB 构建警告。
