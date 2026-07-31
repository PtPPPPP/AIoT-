# 研华接入预留说明

> 本轮未连接真实硬件；所有通道号、量程和 URL 都只是本项目的边缘网关协议预留，不是研华原生接口声明。

```text
React 前端 -- HTTP / WebSocket --> 项目自定义边缘网关 -- REST / MQTT / Modbus TCP --> WISE-4012、ADAM-6050
                                      |
                                可替换边缘计算节点
                                      |
                            EKI-2525（仅工业交换机）
```

前端只使用稳定业务协议，不能直接访问 Modbus TCP，也不能保存设备密码、Token 或密钥。WISE-4012 负责模拟量采集，ADAM-6050 负责 DI/DO，EKI-2525 不提供业务控制 API。

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
