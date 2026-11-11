# 给开发代理的约定

## 开始前

1. 读 `docs/family.md`（插件家族与共同约定），再读 `docs/brief.md`，再读 `docs/event-package.md`。
2. 规则细节查 `docs/reference/工序N_*/设计.txt`；**不要复用旧 Python 脚本**，设计文档只说明“想做什么”。
3. 实现方式参照匿名化插件 `/Users/wanglidong/VibeCoding/dsh-medical-anonymizer`（Node、`index.js`、`lib/`、`client.js`、`cordis.patch.yml`、`scripts/build.mjs`、测试写法）。

## 必须遵守

- 绝不修改输入；输出写到输出根目录，记录放 `_records/`。
- 病历内容只发往用户设置里的模型端点；Agent 工具不能选端点、模型、Key。
- 编号稳定（family.md §4.3）；每条结果写明命中的规则；验收门不通过不往下游交。
- 不写死血透：专科内容放专科层规则包。
- 不把病历派生内容（结果.xlsx、题目、模型结果、真实病历）复制进仓库；测试用虚构数据。
- 改了 `docs/family.md` 要同步到 `dsh-medical-ontology`、`dsh-medical-eval`。
- 交付格式改动要升版本，并通知下游两个仓库（在它们的 docs 里记一笔）。

## 读 iCloud 资料

`/Users/wanglidong/Library/Mobile Documents/com~apple~CloudDocs/未命名文件夹/` 不能列目录（macOS 隐私保护），但可以直接读已知路径的文件；列文件用 `mdfind -onlyin "<目录>" "kMDItemFSName == '*'"`。

## 更新本机安装的插件

- 有批次在运行时，不要更新、重装、启用或停用插件；操作前用 `event_runs` 确认没有 `running`。
- `node scripts/build.mjs <版本>` 生成 `dist/<版本>`，再从 profile 安装；版本号 `0.x.y-dev.N` 递增。
