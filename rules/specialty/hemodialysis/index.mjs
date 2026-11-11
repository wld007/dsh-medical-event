/**
 * 专科层：血液透析。透析用语、本队列常见药名、内瘘手术。
 * 词表条目用 { extend: true, re } 追加到通用层同名词表。
 */
export default {
  id: 'hemodialysis',
  layer: 'specialty',
  version: '0.1.0',
  basedOn: { '工序2': 'v2.2', '工序3': 'v1.5' },

  concepts: [
    { group: '用药', name: '华法林', aliases: ["华法林", "华法令"], nature: '写法变体' },
    { group: '用药', name: '氯吡格雷', aliases: ["氯吡格雷", "硫酸氯吡格雷", "泰嘉", "氢氯吡格雷", "氢氯吡咯雷"], nature: '商品名→通用名（需药师复核）；含疑似笔误' },
    { group: '用药', name: '阿司匹林', aliases: ["阿司匹林"], nature: '同名' },
    { group: '用药', name: '利伐沙班', aliases: ["利伐沙班"], nature: '同名' },
    { group: '用药', name: '胺碘酮', aliases: ["胺碘酮", "可达龙"], nature: '商品名→通用名（需药师复核）' },
    { group: '用药', name: '米多君', aliases: ["米多君", "盐酸米多君"], nature: '同名' },
    { group: '用药', name: '硝苯地平', aliases: ["硝苯地平", "拜新同"], nature: '商品名→通用名（需药师复核）' },
    { group: '用药', name: '卡维地洛', aliases: ["卡维地洛"], nature: '同名' },
    { group: '用药', name: '曲美他嗪', aliases: ["曲美他嗪", "万爽力"], nature: '商品名→通用名（需药师复核）' },
    { group: '用药', name: '甲钴胺', aliases: ["甲钴胺", "弥可保"], nature: '商品名→通用名（需药师复核）' },
    { group: '用药', name: '骨化三醇', aliases: ["骨化三醇", "盖三淳"], nature: '商品名→通用名（需药师复核）' },
    { group: '用药', name: '西那卡塞', aliases: ["西那卡塞"], nature: '同名' },
    { group: '用药', name: '司维拉姆', aliases: ["司维拉姆"], nature: '同名' },
    { group: '用药', name: '阿托伐他汀', aliases: ["阿托伐他汀"], nature: '同名' },
    { group: '用药', name: '孟鲁司特', aliases: ["孟鲁司特"], nature: '同名' },
    { group: '用药', name: '己酮可可碱', aliases: ["己酮可可碱"], nature: '同名' },
    { group: '用药', name: '稳心颗粒', aliases: ["稳心颗粒"], nature: '同名' },
    { group: '用药', name: '艾司唑仑', aliases: ["艾司唑仑"], nature: '同名' },
    { group: '用药', name: '托拉塞米', aliases: ["托拉塞米", "拖拉塞米"], nature: '写法变体' },
    { group: '用药', name: '呋塞米', aliases: ["呋塞米"], nature: '同名' },
    { group: '用药', name: '爱倍（未归通用名）', aliases: ["爱倍"], nature: '商品名，通用名未确认，保留原名' },
    { group: '用药', name: '莫西沙星', aliases: ["莫西沙星"], nature: '同名' },
    { group: '用药', name: '头孢地尼', aliases: ["头孢地尼"], nature: '同名' },
    { group: '用药', name: '头孢克肟', aliases: ["头孢克肟"], nature: '同名' },
    { group: '用药', name: '头孢噻肟', aliases: ["头孢噻肟"], nature: '同名' },
    { group: '用药', name: '非布司他', aliases: ["非布司他"], nature: '同名' },
    { group: '用药', name: '碳酸氢钠', aliases: ["碳酸氢钠", "苏打片"], nature: '俗称→通用名' },
    { group: '用药', name: '琥珀酸亚铁', aliases: ["琥珀酸亚铁"], nature: '同名' },
    { group: '用药', name: '复方α-酮酸', aliases: ["复方α-酮酸", "α-酮酸"], nature: '同名' },
    { group: '用药', name: '阿魏酸哌嗪', aliases: ["阿魏酸哌嗪"], nature: '同名' },
    { group: '用药', name: '多糖铁复合物', aliases: ["力蜚能"], nature: '商品名→通用名（需药师复核）' },
    { group: '用药', name: '百令胶囊', aliases: ["百令"], nature: '同名' },
    { group: '用药', name: '肾衰宁', aliases: ["肾衰宁"], nature: '同名' },
    { group: '用药', name: '环磷腺苷葡胺', aliases: ["环磷腺苷葡胺", "环磷腺苷"], nature: '同名' },
    { group: '用药', name: '甲泼尼龙', aliases: ["甲强龙", "甲泼尼龙"], nature: '商品名→通用名（需药师复核）' },
    { group: '用药', name: '倍他米松', aliases: ["倍他米松"], nature: '同名' },
    { group: '用药', name: '复方甲氧那明', aliases: ["复方甲氧那明", "甲氧那明"], nature: '同名' },
    { group: '用药', name: '强力枇杷露', aliases: ["强力枇杷露", "枇杷露"], nature: '同名' },
    { group: '用药', name: '复方鱼腥草', aliases: ["复方鱼腥草", "鱼腥草"], nature: '同名' },
    { group: '用药', name: '乳清蛋白', aliases: ["乳清蛋白"], nature: '同名' },
    // 透析
    { group: '透析', name: '开始维持性透析', aliases: ['开始血透', '开始透析', '开始血液透析', '开始维持性'], once: true, nature: '一次性；仅当原文为“开始／于某日行”' },
    { group: '透析', name: '干体重调整', aliases: ['下调干体重', '上调干体重', '调整干体重'], nature: '点事件' },
    { group: '透析', name: '维持性血液透析', aliases: ['血透', '血液透析', '透析'], nature: '状态' },
    // 手术操作
    { group: '手术操作', name: '动静脉内瘘成形术', aliases: ['内瘘成形术', '内瘘吻合术', '动静脉内瘘术', '内瘘手术', '动静脉内瘘成形'], nature: '写法变体' },
    { group: '手术操作', name: '内瘘球囊扩张及支架植入', aliases: ['球囊扩张及支架植入', '内瘘扩张', '球囊扩张'], nature: '写法变体' },
    { group: '手术操作', name: '子宫切除术', aliases: ['子宫切除'], once: true, nature: '一次性' },
    { group: '手术操作', name: '右下肢动脉扩张术', aliases: ['右下肢动脉扩张'], nature: '同名' },
    { group: '手术操作', name: '肱骨骨折切开复位内固定', aliases: ['肱骨骨折切开复位', '骨折术后'], nature: '写法变体' },
    { group: '手术操作', name: '胸腔穿刺引流', aliases: ['胸腔穿刺'], nature: '同名' },
    { group: '手术操作', name: '肛周脓肿手术', aliases: ['脓肿手术'], nature: '同名' },
    { group: '手术操作', name: '拆线', aliases: ['拆线'], repeatable: true },
    { group: '手术操作', name: '换药', aliases: ['换药'], repeatable: true },
    { group: '手术操作', name: '清创', aliases: ['清创'], repeatable: true },
    { group: '手术操作', name: '拔除临时透析导管', aliases: ['拔除临时管', '拔除临时'], nature: '同名' },
  ],

  // 互斥用药组（工序3 线索、工序4 R5）
  exclusive: [
    { name: '口服抗凝药', drugs: ['华法林', '利伐沙班'], note: '维生素K拮抗剂与直接口服抗凝药通常不联用；重叠超过换药窗口才算矛盾' },
  ],

  // 相关但不同名、刻意不合并的诊断（记为候选同义，交工序4）
  candidateSynonyms: [
    { name: '慢性肾脏病终末期', members: ['尿毒症', '慢性肾脏病5期', '慢性肾衰竭', '慢性肾衰', '肾衰病'] },
  ],

  vocab: {
    TREAT: { extend: true, re: /规律血透|门诊规律透析|一周三次|一周3次|每周3次|每周三次|血透1周|干体重|超滤|米多君|华法|利伐沙班|泰嘉|氯吡格雷|阿司匹林|可达龙|胺碘酮|艾司唑仑|乳清蛋白/ },
    DRUG: { extend: true, re: /拜新同|硝苯地平|卡维地洛|万爽力|弥可保|盖三淳|西那卡塞|司维拉姆|孟鲁司特|爱倍|阿托伐他汀|稳心颗粒|曲美他嗪|己酮可可碱|甲钴胺|力蜚能|百令|肾衰宁|莫西沙星|拖拉塞米|非布司他|倍他米松|甲氧那明|枇杷露|鱼腥草|环磷腺苷|苏打片|阿魏酸哌嗪|酮酸|琥珀酸亚铁|甲强龙/ },
    PROC: { extend: true, re: /内瘘(?:成形|吻合|扩张)|血液透析治疗|开始血透|行血液透析|透析治疗1次/ },
    ADH: { extend: true, re: /规律血透|规律透析|规律血液透析/ },
    // 细分映射：透析方案
    DIALYSIS: /血透|透析|干体重|超滤/,
  },
}
