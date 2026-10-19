# 现有研华硬件与接入规划

> 已持有 WISE-4012、ADAM-6050 和 EKI-2525，尚未完成实机接入。下文 I/O 为禁用的接线规划，量程为示例；网关 URL 为项目自定义协议，不是研华原生接口。

```text
React 前端 -- HTTP / WebSocket --> 项目自定义边缘网关 -- REST / MQTT / Modbus TCP --> WISE-4012、ADAM-6050
                                      |
                                可替换边缘计算节点
                                      |
                            EKI-2525（仅工业交换机）
```

前端只使用稳定业务协议，不能直接访问 Modbus TCP，也不能保存设备密码、Token 或密钥。WISE-4012 负责模拟量采集，ADAM-6050 负责 DI/DO，EKI-2525 不提供业务控制 API。

## 设备能力与配套缺口

| 已持有设备 | 能力 | 当前用途与边界 |
|---|---|---|
| WISE-4012 | 4 路通用输入、2 路 DO；2.4 GHz Wi-Fi | 通用输入可选择电压、电流或干接点 DI，AI 与 DI 共用通道，不能算成 4 AI + 4 独立 DI。DO 保留。 |
| ADAM-6050 | 12 DI、6 DO；以太网 | DO 为灌电流型开集电极输出，不能当作功率继电器直接驱动水泵、电机或照明负载。 |
| EKI-2525 | 5 口 10/100 Mbps 非网管交换机 | 连接边缘计算机、ADAM 与路由器 / AP；不提供 Wi-Fi、业务 API 或管理状态轮询。 |

规格参考：[WISE-4012 数据表](https://advdownload.advantech.com/productfile/PIS/WISE-4012/file/WISE-4012_DS%28103024%2920241030170145.pdf)、[ADAM-6050 数据表](https://advcloudfiles.advantech.com/ecatalog/2016/09140935.pdf)、[EKI-2525 产品页](https://ncin.advantech.com/products/EKI-2525/mod/9B9740CB-A5AC-42F1-BB84-735399422B33)。具体后缀、硬件版本、固件与支持协议需以实物铭牌及对应手册复核。

仍待确认：兼容的传感器 / 变送器、继电器 / 接触器与保护回路、电源、路由器 / AP、执行器、摄像头。普通计算机可承担边缘服务，无需额外指定某款边缘开发板；本仓库尚无真实网关服务。

## 建议通道分配

编号从 0 开始，全部 `enabled: false`。代码位于 `src/integrations/advantech/ioMapping.example.ts`，通道类型在 `types.ts` 中限制为设备有效编号范围；没有添加或猜测任何寄存器地址。

| WISE-4012 输入 | 指标 | 假设的变送器范围 → 工程量程 |
|---|---|---|
| UI0 | 土壤湿度 | 4–20 mA → 0–100% |
| UI1 | 温度 | 4–20 mA → -20–60°C |
| UI2 | 空气湿度 | 4–20 mA → 0–100% |
| UI3 | CO₂ | 4–20 mA → 0–2000 ppm |
| 未分配 | 光照 | 4 路已占用，需扩展采集设备或调整指标 |

4–20 mA 只是规划假设，不能据此认定已有传感器支持该输出；电流输入接法及所需外接电阻按对应手册核实。WISE 的 DO0/DO1 暂不承担执行控制。仿真保留 5 项读数，不表示单台 WISE 能同时采齐。

| ADAM-6050 输出 | 规划对象 |
|---|---|
| DO0 / DO1 / DO2 | 水泵 / 风机 / 补光灯的外部驱动模块 |
| DO3 / DO4 | 遮阳伸展 / 收回，必须互锁 |
| DO5 | 保留 |

| ADAM-6050 输入 | 规划信号 |
|---|---|
| DI0 / DI1 | 水泵 / 风机运行反馈 |
| DI2 / DI3 | 遮阳伸展 / 收回限位 |
| DI4 / DI5 / DI6 | 低液位 / 急停状态 / 设备故障 |
| DI7–DI11 | 保留 |

`activeHigh`、`safeState` 与反馈关系均为待确认参数；当前示例中的布尔值不是已验证的电气结论。DO 写入回执不等于设备运行反馈。急停由独立安全回路执行，DI 只采集其状态；遮阳布尔目标需在网关转换为互斥方向输出，并处理停止、限位、超时和掉电恢复。

## 现场接入顺序

1. 核实实物版本、电源及网络；WISE 经 Wi-Fi 接入路由器 / AP，AP、ADAM、计算机经 EKI 连接；通过链路灯和网络连通性确认 EKI 工作。
2. 确认传感器输出与输入模式、量程，先校验单路原始值与工程值，再接入其他通道；光照未解决通道缺口前保持不可用。
3. 在边缘网关实现对应固件支持的协议适配（优先核实 WISE REST / Modbus TCP 和 ADAM Modbus TCP），读取真实反馈；不把项目 API 当作设备接口。
4. 断开实际功率负载核对 DI/DO、电平、反馈、互锁与失联安全状态；完成现场验证后再启用经确认的映射。
5. 部署网关服务并完成健康检查与状态同步，最后把前端切到 external，验证断网、断电和异常输入。硬件清单的“已持有”标签始终不作为在线证据。

## 网关协议

网关 API：`GET /api/v1/health`、`GET /api/v1/sensors/latest`、`GET /api/v1/devices`、`GET /api/v1/actuators`、`POST /api/v1/control/commands`，并预留 `POST /api/v1/ai/infer`。这些 URL 是本项目自定义边缘网关接口，不是研华设备原生接口。所有 DTO 均含 `schemaVersion: 1`，外部 JSON 必须运行时校验。传感器包会携带来源、设备、通道、原始值、工程值、单位、采集/接收时间和质量；只有 `quality=good` 且 `valid=true` 可进入自动控制。

WebSocket 信封类型预留：`sensor.packet`、`device.status`、`actuator.state`、`control.result`、`gateway.status`、`heartbeat`。HTTP 和 WebSocket 共用相同验证器。

`stale` 表示超过时限未更新，`offline` 表示网关明确报告离线，`invalid` 表示格式或值无效，`error` 表示通信/设备错误。网络失败不清除最后有效数据。

## 控制与安全

命令生命周期：`pending → sent → acknowledged → succeeded`，或进入 `failed`、`timed_out`、`rejected`、`cancelled`。每条命令都有 `commandId` 和 `idempotencyKey`；HTTP 非 2xx 或无效 JSON 绝不能写为成功。目标状态与实际状态分开，实际状态仅来自模拟通道明确回执、网关响应或后续状态事件。

遮阳使用一个前端布尔状态，但网关映射允许伸展/收回两路输出、限位输入和动作超时；两路物理互锁必须由网关、控制器或电气回路保证，不能依赖前端。

模拟量换算一般为 `engineering = raw × scale + offset`，具体量程与系数必须按最终传感器确认。示例映射位于 `src/integrations/advantech/ioMapping.example.ts`，全部 `enabled: false`。

## 配置与真实接入清单

默认 `VITE_RUNTIME_MODE=simulation`，`external` 必须配置网关 URL；未配置时明确显示 `unconfigured`，不静默回退。`VITE_EDGE_NODE_TYPE` 只描述网关运行在哪类节点上，不能作为连接成功依据。离线构建始终为本地模拟，不会请求网关。

真实接入前需提供：固件版本、实际 IP、WISE-4012 各通道类型、每个传感器量程与工程换算、ADAM-6050 DI/DO 接线和有效电平、继电器/接触器类型、反馈输入、遮阳限位及互锁、最终 REST/MQTT/Modbus 方案、网关部署系统，以及断网/断电安全状态。
