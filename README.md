# 病历事件还原 · dsh-medical-event

DeepSeek Harness 插件。把一位患者的病历变成**可计算的事件**：每处提及记一条、挂写成时间与发生时间、标事实／判断／决策类型、把同一件事归并成事件、登记记录之间的冲突。规则为主、可复跑，处处回得到原文；模型（可选）只处理规则判不了的项、只出建议。

```
医疗数据匿名化 → 【病历事件还原】 → 临床本体构建 → 长病程临床推理评测
                        └→ 病历质控、真实世界研究、训练数据、患者时间线……
```

## 用法

- 左侧栏「病历事件还原」：新批次、产线、格式（自动识别时）、患者、时间线、原文标注、复核、规则改进、模型调用、规则包、报告。
- 聊天框：`/event <病人导出目录> [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]`
- Agent 工具：`event_start`、`event_status`、`event_report`、`event_runs`、`event_cancel`。
- 命令行（开发）：`node scripts/run.mjs <病人导出目录> <输出目录> [--until S03] [--as-of …]`

输入通常是匿名化插件的交付目录；一个目录可含多位病人。

- **区域平台导出**（`p_doc_*.json`，按月分文件）：内置格式，直接处理。
- **其他导出格式**（json、ndjson、csv、tsv、xlsx；字段名不限，包括数据元编码；字段里可以是 base64 编码的 XML／HTML 病历文书）：先过 **S00 格式识别**，见下。

## 产线

| 环节 | 做什么 | 验收门 |
|---|---|---|
| S00 格式识别（非内置格式） | 本地画像 → 本机格式库复用 → 规则草稿＋模型起草＋背靠背核验 → 插件校验 → 两方一致自动采用、分歧暂扣待确认 → 组装成数据源层 | 暂扣的表不参与 |
| S01 读入·片段 | 片段、可见时间、作废记录、第二版入院记录、签名诊断段、计费周期“住院” | — |
| S02 提及抽取（工序1） | 栏目→句→分句→顿号与修饰继承；七级时间来源 | ① 逐字一致、区间不倒置、不晚于写成 |
| S03 类型切分（工序2） | 事实／判断／决策 → 细分 → 细项与属性，43 条有序规则 | ② 兜底命中率（供抽样核对） |
| S04 事件归并（工序3） | 七级归并规则、概念归一、用药片段、交 S05 线索 | ③ 每条提及恰属一个事件 |
| S05 矛盾判断（工序4） | R1–R10，七类判定，来源可信度给建议采信 | ④ 每条发现可回溯原始提及 |
| 模型补充（可选） | 待定时间、兜底类型、未归一概念、需确认的发现；引用原文核对；双模型一致→规则改进候选，分歧→人工复核 | — |

## 格式识别（S00）

导出格式五花八门，插件不为每种格式手写配置，而是每张表识别一次、存进本机格式库，以后同样的表直接复用。

1. **画像（本机）**：按表汇总字段——填充率、取值类型（时间、数值、代码、短文、长文、嵌入文书、匿名化假名）、每个字段最多 3 个截到 20 字的样例；长文和嵌入文书只取行首的栏目标签，假名不取样例。
2. **起草**：规则草稿（表名关键词、唯一的时间字段、中文栏目名）；配置了模型时，建议模型按标准记录类别起草规格：类别、写成时间、发生时间、就诊号、结构化字段角色或文书栏目。
3. **核验**：配了核验模型时它背靠背再起草一份；只有一个模型时，规则草稿作第二票（规则拿不准的项弃权，只拦明显的错）。
4. **插件校验**：字段存在、时间字段能解析、栏目字段是文字、必填角色齐全；不过就让模型改一次。
5. **采用**：两方一致 → 自动采用；有分歧、校验未过、没配模型 → 暂扣，在「格式」页逐表确认、改规格或跳过，然后「按确认结果重新运行」。

标准记录类别（`lib/recognize/canon.js`）：基本信息、就诊登记、诊断记录、检验、生命体征、医嘱、处方、用药记录、治疗记录、申请单、手术记录、收费、其他结构化；入院记录、门诊病历、出院记录、检查报告、病程记录、会诊记录、手术麻醉记录、护理记录、转诊记录、其他文书；忽略。通用规则层按这些类别和栏目定类型。

发给模型的只有画像（字段名、统计、截短样例、栏目标签），不发整段病历；只发往插件设置里的模型端点。格式库在本机 `<profile>/plugin-data/medical-event/formats.json`，只存规格与统计。

## 输出

```
<outputRoot>/<输入名>/<病人>/        事件包（docs/event-package.md）
  manifest.json fragments.jsonl encounters.jsonl mentions.jsonl events.jsonl findings.jsonl clues.jsonl stage-changes.json
  exports/drug_exposure.csv labs_long.csv extraction_samples.jsonl
<outputRoot>/_records/
  records.sqlite   记录库，各批次共用，按 run_id 区分：
                   runs（批次）、decisions（人工裁定，按稳定编号，重跑沿用）、decision_log（裁定改动留痕）、
                   model_cache（模型回复缓存）、model_calls（模型调用流水）
  runs/<runId>/report.md report.json model/
```

- 记录库用运行时自带的 `node:sqlite`（DSH 内置 Node 24 可用），表结构版本记在 `PRAGMA user_version`，升级时自动迁移；库比插件新时拒绝打开。
- 旧布局（`index.json`、`decisions.json`、`runs/<runId>/run.json`、`calls.jsonl`、`model-cache.jsonl`）在第一次打开记录库时并入，原文件保留不动，此后不再写。
- 运行时没有 `node:sqlite` 时退回旧布局文件。
- 同一输出根目录下重跑，模型回复直接复用缓存；要重新问模型，换一个输出根目录。

## 文档

- [docs/family.md](https://github.com/wld007/dsh-medical-event/blob/main/docs/family.md)：插件家族、拆分理由、共同约定
- [docs/brief.md](https://github.com/wld007/dsh-medical-event/blob/main/docs/brief.md)：交接说明
- [docs/architecture.md](https://github.com/wld007/dsh-medical-event/blob/main/docs/architecture.md)：引擎架构、规则包格式、稳定编号
- [docs/event-package.md](https://github.com/wld007/dsh-medical-event/blob/main/docs/event-package.md)：交付格式
- [docs/validation.md](https://github.com/wld007/dsh-medical-event/blob/main/docs/validation.md)：HD-0001 真实数据验证与老结果对照
- [docs/reference/](https://github.com/wld007/dsh-medical-event/tree/main/docs/reference)：工序 1–4 设计文档

## 开发

```
npm test                                  # 虚构病人＋服务测试
node scripts/build.mjs 0.1.0-dev.N        # 生成 dist/<版本>，再从 profile 安装
REACT_UMD_DIR=… node scripts/preview-page.mjs <stateDir>   # 浏览器外预览页面
```
