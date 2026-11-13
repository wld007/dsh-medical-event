# 引擎架构与规则包格式（阶段 0 决定）

## 目录

```
lib/
  engine/
    ids.js            稳定编号
    time.js           日期解析、区间、精度、时间短语换算
    text.js           切句、分句、顿号、规范化
    source.js         读导出 → 记录（按数据源层规则包映射；识别出的格式按表名匹配，嵌入文书在此解码）
    s01-fragments.js  记录 → 片段（可见时间、就诊）
    s02-mentions.js   片段 → 提及（工序1）
    s03-classify.js   提及 → 类型（工序2）
    s04-merge.js      提及 → 事件（工序3）
    s05-judge.js      事件 → 发现（工序4）
    gates.js          验收门
    asof.js           截至时刻 T 的重算
    pipeline.js       串联：runPatient(dir, rulepack, {until, asOf})
  recognize/          S00 格式识别（非内置格式）
    canon.js          标准记录类别、栏目、角色（识别层与规则层的契约）
    read.js           通用读入：json/ndjson/csv/tsv/xlsx；表名；base64 XML/HTML 文书解码
    profile.js        画像（字段统计、截短样例、栏目标签）；病人分组
    draft.js          规则草稿、模型提示词、规格规范化／校验／比较
    library.js        本机格式库（按表签名复用）
    build.js          已采用的规格 → 数据源层规则包
    index.js          编排：画像 → 复用 → 起草 → 核验 → 采用／暂扣
  rulepack/
    load.js           合并三层、校验（只允许纯数据）、编译正则
  package/
    write.js          写事件包
rules/
  source/<平台>/       数据源层
  general/             通用医学层
  specialty/<专科>/    专科层（可选）
scripts/
  run.mjs             命令行：跑一位或多位病人
  compare.mjs         与老结果对照（输出放仓库外）
test/
  fixtures/           虚构病人（平台导出格式）
  *.test.mjs          node --test
```

阶段 2 再加 `index.js`、`lib/service.js`（批次、取消、继续、_records、报告）、`client.js`。

## 原则

- 每个环节是纯函数：输入上一环节结果＋规则包，输出本环节结果；不读写文件、不读时钟。文件读写只在 `source.js` 与 `package/write.js`。
- 每条结果记命中的规则编号。
- 规则包与引擎分开：引擎只写“怎么做”（时间来源的优先级级联、并查集归并等过程），规则包写“认什么”（正则、词表、规则顺序、条件、参数）。
- 零运行时依赖（与匿名化插件一致）。测试用 `node --test`。

## 规则包格式

内置规则包是 `.mjs` 模块，`export default` 一个**纯数据**对象（正则字面量、字符串、数字、数组、对象；不允许函数），加载时校验。选 `.mjs` 而不是 JSON，是为了正则可读、能写注释。设计页由规则包生成（`scripts/design-page.mjs`，后做），保持“改规则即改设计”。

```js
export default {
  id: 'general',            // 层内唯一
  layer: 'general',         // source | general | specialty
  version: '0.1.0',
  basedOn: { '工序1': 'v1.2', '工序2': 'v2.2', '工序3': 'v1.5', '工序4': 'v1.0' },
  vocab:   { NEG: /…/, LAB: /…/, … },       // 命名词表/正则，条件里用 '@NEG' 引用
  params:  { drugGapDays: 180, switchWindowDays: 14, … },
  sections:   [...],   // 工序1 栏目与时间策略（source 层）
  classify:   [...],   // 工序2 规则表（有序，命中即停）
  concepts:   [...],   // 工序3 概念归一词表
  exclusive:  [...],   // 工序3/4 互斥组
  hypernyms:  [...],   // 工序4 否认上位概念
  revisions:  [...],   // 修订记录
}
```

三层合并：`source` → `general` → `specialty`，后者可追加词表条目、在指定规则前后插入规则、覆盖参数；不可删除前层规则（只能用 `disable: ['规则编号']` 显式停用并记录原因）。

### 工序2 规则的条件写法

```js
{ id: 'K3', name: '停用/调整/改用', type: '决策', subclass: '方案调整',
  when: { text: '@ADJUST' } }
{ id: 'N1', name: '阴性查体', type: '事实', subclass: '查体所见',
  when: { negative: true, any: [{ section: ['体格检查', '专科情况'] }, { text: '@EXAM' }] } }
```

条件字段：`recordType`、`kind`（文书/结构化）、`section`、`text`、`notText`、`negative`、`scope`、`any`、`all`。值是数组（任一）或正则/`@词表`。

## 稳定编号

`<前缀>-<sha256 前 12 位 base32>`：

| 对象 | 前缀 | 散列内容 |
|---|---|---|
| 片段 | `G` | 表名＋记录主键（数据源层定义主键字段）＋字段＋段落序号 |
| 提及 | `M` | 片段编号＋s＋e |
| 事件 | `E` | 排序后的成员提及编号 |
| 发现 | `F` | 子类＋排序后的涉及事件编号 |

## 时间

- 内部一律本地时间字符串：时刻 `YYYY-MM-DD HH:mm`，日期 `YYYY-MM-DD`；区间 `[a, b]` 闭区间，带精度（时刻/日/周/月/年/区间/无）。
- 写成时间（可见时间）决定截断；发生时间只用于叙事与归并。
- D+n 只在导出视图里算，事件包内保留绝对时间。

## 验证

- 单元与回归测试：`test/fixtures/` 的虚构病人，覆盖设计文档里的写法与陷阱。
- 真实数据验证：匿名化后的 HD-0001（`/Users/wanglidong/VibeCoding/_medical-event-data/`，仓库外），与老结果对照；**老结果不一定对**，差异逐类判定后记入 `docs/validation.md`（只记类别与数量、规则编号，不记病历原文）。
