# 病历事件还原 · dsh-medical-event

DeepSeek Harness 插件。把一位患者的病历变成**可计算的事件**：每处提及记一条、挂写成时间与发生时间、标事实／判断／决策类型、把同一件事归并成事件、登记记录之间的冲突。规则为主、可复跑，处处回得到原文；模型（可选）只处理规则判不了的项、只出建议。

```
医疗数据匿名化 → 【病历事件还原】 → 临床本体构建 → 长病程临床推理评测
                        └→ 病历质控、真实世界研究、训练数据、患者时间线……
```

## 用法

- 左侧栏「病历事件还原」：新批次、产线、患者、时间线、原文标注、复核、规则改进、模型调用、规则包、报告。
- 聊天框：`/event <病人导出目录> [--out 输出根目录] [--as-of "YYYY-MM-DD HH:mm"]`
- Agent 工具：`event_start`、`event_status`、`event_report`、`event_runs`、`event_cancel`。
- 命令行（开发）：`node scripts/run.mjs <病人导出目录> <输出目录> [--until S03] [--as-of …]`

输入是区域平台导出（`p_doc_*.json`，按月分文件），通常是匿名化插件的交付目录；一个目录可含多位病人。

## 产线

| 环节 | 做什么 | 验收门 |
|---|---|---|
| S01 读入·片段 | 片段、可见时间、作废记录、第二版入院记录、签名诊断段、计费周期“住院” | — |
| S02 提及抽取（工序1） | 栏目→句→分句→顿号与修饰继承；七级时间来源 | ① 逐字一致、区间不倒置、不晚于写成 |
| S03 类型切分（工序2） | 事实／判断／决策 → 细分 → 细项与属性，43 条有序规则 | ② 兜底命中率（供抽样核对） |
| S04 事件归并（工序3） | 七级归并规则、概念归一、用药片段、交 S05 线索 | ③ 每条提及恰属一个事件 |
| S05 矛盾判断（工序4） | R1–R10，七类判定，来源可信度给建议采信 | ④ 每条发现可回溯原始提及 |
| 模型补充（可选） | 待定时间、兜底类型、未归一概念、需确认的发现；引用原文核对；双模型一致→规则改进候选，分歧→人工复核 | — |

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
