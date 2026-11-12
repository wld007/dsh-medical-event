# 事件包格式（草案 v0）

> `dsh-medical-event` 的交付物，`dsh-medical-ontology`、`dsh-medical-eval` 及其他下游读取。
> 状态：**v0 已实现**（`lib/package/write.js`）。字段来自工序 1–4 设计文档的“输出字段”，补上了稳定编号、版本与复核状态。实现与本文有出入时以实现为准，并回写本文。
> 定稿后遵守：字段只增不改；改动升 `format` 版本；消费者声明支持的版本。

## 目录结构（每位病人一个）

```
<outputRoot>/<输入名>/<patient>/
  manifest.json
  fragments.jsonl
  encounters.jsonl
  mentions.jsonl
  events.jsonl
  findings.jsonl
  clues.jsonl            # S04 交 S05 的线索
  links.jsonl            # 印证关系（跨类型，只连不并）
  stage-changes.json     # 病情变化（分期分级）
  exports/               # 便于复用的视图，可再生
    结果-工序1..4.xlsx
    drug_exposure.csv
    labs_long.csv
    extraction_samples.jsonl
```

## manifest.json

| 字段 | 含义 |
|---|---|
| `format` | 事件包格式版本，如 `event-package/0` |
| `producer` | 插件名与版本 |
| `rulepacks` | 各层规则包及版本：数据源层、通用医学层、专科层；以及工序 1–4 设计版本 |
| `runId` | 产生它的批次 |
| `upstream` | 上游来源：是否匿名化插件输出、其 runId（不含映射库） |
| `patient` | 病人编号（匿名化后） |
| `anchor` | D+0 锚点及其定义 |
| `counts` | 片段、提及、事件、发现数 |
| `gates` | 四道验收门结果 |
| `review` | 复核进度：各类待复核/已裁定数 |

## fragments.jsonl（片段）

| 字段 | 含义 |
|---|---|
| `id` | 稳定编号，由来源记录主键（＋段落序号）派生 |
| `recordType` | 入院记录、出院记录、门诊病历、检查报告、检验、诊断、就诊、收费、手术…… |
| `source` | 来源文件相对路径与记录主键 |
| `visibleAt` | 可见时间（写成时间），及依据字段 |
| `encounterId` | 所属就诊 |
| `text` | 片段全文（结构化行为规范化后的一行文本） |

## encounters.jsonl（就诊容器）

`id`、`kind`（住院／门诊／急诊留观／计费周期伪住院）、`start`、`end`、`dept`、来源。

## mentions.jsonl（提及，工序1＋工序2 字段）

| 字段 | 含义 |
|---|---|
| `id` | 稳定编号：`fragmentId + s + e` 派生 |
| `fragmentId`、`s`、`e`、`text` | 位置与原文（`text` 必须等于 `fragment.text[s:e]`） |
| `kind` | 文书／结构化 |
| `section`、`sentence` | 栏目、句序号 |
| `scope` | 修饰继承：否认／无／予／有／口服 |
| `writtenAt` | 写成时间（＝片段可见时间） |
| `anchor` | 叙述锚点 |
| `timePhrase`、`timeSource` | 时间短语原文；时间来源（本句自带／时间副词／同句继承／前句继承待复核／栏目默认／结构化字段／无时间） |
| `occurFrom`、`occurTo`、`precision` | 所说发生时间区间与精度 |
| `type`、`subdivision`、`item`、`subclass` | 事实／判断／决策 → 细分 → 细项；子类 |
| `origin` | 来源：结构化记录／检测报告／医生查体／患者陈述／病史采集／外院转述／医生记录 |
| `negative` | 阴性 |
| `templated` | 模板化类别（模板化否认／查体模板／宣教模板／表单占位／逐字复用）或空 |
| `temporality` | 同期／同次补记／回顾转述／无时间 |
| `future` | 指向未来 |
| `alsoContains` | 兼含的另一类 |
| `action`、`execStatus` | 决策的动作（启动、维持、调整、停止、计划；是否同句沿用）与执行状态 |
| `certainty` | 判断的确定程度 |
| `adherence` | 依从描述 |
| `rules` | 命中规则：`{extract, classify}`，如 `{"classify":"P1"}` |
| `review` | 复核状态（见 family.md §4.5） |

## events.jsonl（事件，工序3）

| 字段 | 含义 |
|---|---|
| `id` | 稳定编号：成员提及集合派生 |
| `form` | 点／片段／状态／一次性 |
| `type`、`subdivision` | 沿用工序2 |
| `conceptGroup`、`concept` | 概念组、归一概念（未归一时标记） |
| `aliases` | 别名→归一名，及映射性质（写法变体／商品名→通用名需药师复核／…） |
| `polarity` | 阳性／阴性 |
| `value` | 检验、体征的数值与单位 |
| `consensus` | 所有提及发生区间的交集；无交集时 `{consistent:false, union:[…]}` |
| `encounterId` | 所属就诊 |
| `mentions` | 成员提及编号 |
| `mentionCount`、`docCount` | |
| `firstWritten`、`lastWritten`、`firstMention` | 首次、末次写成；首见提及 |
| `mergeRule` | 结构化对齐／逐字复制／一次性概念／同概念时间相容同就诊／同句修饰并入／状态连续／单提及 |
| `segment` | 用药片段：起止、断段原因（停止点／间隔 >180 天） |

## links.jsonl（印证关系）

跨类型的“前后印证”。验收门③不允许把不同类型并成一个事件，所以这类关系单独记，只连不并。

| 字段 | 含义 |
|---|---|
| `id` | 稳定编号：from＋to＋relation 派生 |
| `from`、`to` | 事件编号；`to` 为 null 表示提到了、但记录里找不到它本身（无法印证） |
| `relation` | 影像印证／转述印证（L1）、执行佐证（L2 收费）、检查原件（L3）、术后状态（L4） |
| `rule` | L1–L4 |
| `mentions` | 依据提及（最多 20 条） |
| `note` | 命中的别名、时间等说明 |

规则：
- L1 提及印证：事实、判断、转述的原文里说到一次手术或一次性事件，而它自己属于别的事件（例：出院记录转述的 CTA“桡动脉与桡侧头静脉吻合术后”印证 2017 年那次动静脉内瘘成形术）。只连到不晚于提及所说时间的最近一次。换药、拆线、清创这类可重复操作，收费、计划、宣教不参与。
- L2 执行佐证：收费项目与手术同名、30 天内。
- L3 检查原件：文书转述的检查 ↔ 同类、±2 天、不晚于该文书的检查报告。
- L4 术后状态：“××术后”状态 ↔ 更早的那次手术。

## findings.jsonl（发现，工序4）

| 字段 | 含义 |
|---|---|
| `id` | 稳定编号：涉及事件＋子类派生 |
| `verdict`、`subclass` | 七类判定及子类 |
| `rule` | R1–R10 |
| `events` | 涉及事件 |
| `sides` | 各方：提及编号、写成时间、来源等级（1–6） |
| `timeRelation` | 重叠／先后／无时间 |
| `adopt`、`adoptReason` | 建议采信及理由，或“无法判定” |
| `certainty` | 规则确定／需人工确认 |
| `impact` | 影响：时间线、用药片段、诊断…… |
| `evalClass` | 给评测 T09 的三分类映射：真冲突／不冲突／可以裁决 |
| `model` | 模型意见（建议/核验，含引用与核对结果），可空 |
| `review` | 复核状态 |

“病情变化”不进矛盾表，单独记在 `findings` 里 `verdict = 病情变化`。

## 已定

- 交付位置：`<outputRoot>/<输入名>/<病人相对路径>/`；单个病人输入时直接是 `<outputRoot>/<输入名>/`。
- 片段全文放进包里（下游不回读病历）。
- 人工裁定不写进事件包，放 `_records/decisions.json`（按稳定编号）；读取时合并到 `findings[].review`。
- as-of：以批次参数 `asOf` 产出整包（manifest.asOf 记录），引擎内 `runStages(raw, pack, { asOf })` 可按需重算。

## 待定

- 未匿名化输入时，事件包是否禁止离开本机。
