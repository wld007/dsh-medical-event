# 病历事件还原 · dsh-medical-event

DeepSeek Harness 插件（规划中，尚未实现）。把一位患者的病历变成**可计算的事件**：每处提及记一条、挂写成时间与发生时间、标事实／判断／决策类型、把同一件事归并成事件、登记记录之间的冲突。只照抄原文、不推断、不补全，处处回得到原文。

```
医疗数据匿名化 → 【病历事件还原】 → 临床本体构建 → 长病程临床推理评测
                        └→ 病历质控、真实世界研究、训练数据、患者时间线……
```

## 文档

- [docs/family.md](docs/family.md)：插件家族、拆分理由、共同约定（四个仓库内容相同）
- [docs/brief.md](docs/brief.md)：本插件交接说明（产线、验收门、模型用法、界面、复用要求）
- [docs/event-package.md](docs/event-package.md)：交付格式草案
- [docs/reference/](docs/reference/)：工序 1–4 设计文档、八道工序总结
- [design/](design/)：效果图（产线、时间线、复核、原文标注）
