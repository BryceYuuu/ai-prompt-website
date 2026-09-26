# 内容维护

本目录离线生成当前 66 条内容。编辑 text-specs.json（文字）或 build.py 的 image_specs（图片），执行 `python3 tools/curate/build.py`，再执行 `npm test`。

来源快照、SHA256、原始署名和授权位于 sources/。audit.json 记录对旧 108 条目录的退役/替换处理；previous-catalog.json 仅保留旧目录的 id、名称和分类，用于复现审查记录。GitHub stars 以 sources/repository-stars.json 的逐仓库日期为准；当前采用的两个来源已于 2026-09-26 重新核验，是仓库级快照，不代表单条模板热度。

本站中文内容经过整理而非逐字翻译，尚未逐条模型实测。图片来自明确标注 CC BY 4.0 的来源案例，没有使用授权说明不一致的候选图库。

完整开源范围与署名见根目录 THIRD_PARTY_NOTICES.md。所有内容更新目前需人工审核；此脚本不联网采集，也不自动发布。

keywords.json 维护每条模板的中英文搜索别名；添加后重新运行生成器。关键词须对应实际任务，不标注未验证的模型兼容性。
