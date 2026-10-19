/** 用户已持有的硬件。持有状态与软件连接状态无关，不写入仿真在线率。 */
export const hardwareInventory = [
  {
    model: 'WISE-4012',
    role: '无线数据采集',
    capacity: '4 路通用输入（AI / 干接点 DI 共用）+ 2 路 DO',
    connection: '2.4 GHz Wi-Fi → 路由器 / AP → EKI-2525',
    plan: 'UI0 土壤湿度、UI1 温度、UI2 空气湿度、UI3 CO₂；2 路 DO 保留。',
    limitation: '光照尚无空余输入；传感器需另配匹配的电压 / 电流变送器，不能直接接任意探头。',
    sourceUrl: 'https://advdownload.advantech.com/productfile/PIS/WISE-4012/file/WISE-4012_DS%28103024%2920241030170145.pdf',
  },
  {
    model: 'ADAM-6050',
    role: '数字输入与执行控制',
    capacity: '12 路 DI + 6 路 DO（灌电流型开集电极输出）',
    connection: '以太网 → EKI-2525 → 边缘计算机',
    plan: 'DO0 水泵、DO1 风机、DO2 补光、DO3 / DO4 遮阳双向；DO5 保留。',
    limitation: 'DO 通过匹配的继电器 / 接触器驱动负载；遮阳需要双向互锁、限位和超时保护。',
    sourceUrl: 'https://advcloudfiles.advantech.com/ecatalog/2016/09140935.pdf',
  },
  {
    model: 'EKI-2525',
    role: '工业以太网交换',
    capacity: '5 个 10/100 Mbps 以太网端口，非网管型',
    connection: '连接 ADAM-6050、边缘计算机和路由器 / AP',
    plan: '只承担有线网络互联；WISE-4012 的无线接入由路由器 / AP 提供。',
    limitation: '不提供业务 API 或可轮询的管理状态；通过现场指示灯和链路连通性确认。',
    sourceUrl: 'https://ncin.advantech.com/products/EKI-2525/mod/9B9740CB-A5AC-42F1-BB84-735399422B33',
  },
] as const;

export const hardwareTopology = `传感器 / 变送器 → WISE-4012 ~~ Wi-Fi ~~ 路由器 / AP
                                                │ 以太网
                                           EKI-2525
                                            ├─ ADAM-6050 → 驱动模块 → 执行器
                                            └─ 边缘计算机 → 网关服务 → React 页面`;

export const hardwarePendingItems = '待确认配套：传感器 / 变送器、继电器 / 接触器、电源、路由器 / AP、执行器和摄像头。普通计算机可作为边缘节点，网关服务尚未实现。';
