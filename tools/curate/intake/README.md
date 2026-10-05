# Threads 素材待审区

此目录与 `sources/threads-*.json` 分离；`build.py` 不读取这里，待审内容不会进入网站。公开可读、搜索引擎可见或有人转发，不等于拥有完整提示词和图片的转载许可。

## 本次审核原则

1. 先按原帖/作者提示词回复 URL 去重，再按原始核心提示词归一化去重；跨账号、Threads `.net` / `.com` 域名和 URL 跟踪参数不新增一条
2. 对照现有全部 80 条模板及同批候选，人工比较输入、核心操作、材质/画风、输出布局及用途。改标题、换文案、翻译、换案例图或换账号不算新提示词；只有实质差异才可保留
3. 完整图片文件做 SHA256；相同图片只提示检查，因为不同变换可以共用输入照片。压缩/裁切的近似图仍需接触表或感知哈希检查，SHA256 不能证明视觉不同
4. 一条提示词配多张案例图仍为一张卡。核心近似的版本记录保留 ID 和排除原因，不为增加数量而重复入库
5. 搜索摘要、无法打开的帖子、未见作者回复或图片原文件时，明确记为未完整核验；不补写/猜测作者原文
6. 每个账号、每组第三方内容独立确认转载范围。必须覆盖完整提示词、图片、公开网站和公开 GitHub 仓库；既有两个账号的确认不延伸到别的账号
7. 审核通过后才人工转到来源清单、提示词快照、图片目录和关键词表，并补第三方说明。当前审核器不执行导入、联网、下载、push 或部署

## 输入

`review_threads.py` 读取 JSON 数组，或带 `candidates` 数组的 JSON 对象。每条至少提供：

- `id`、`title`、`authorHandle`、`summary`（自行概述）
- `sourceUrl`、`promptSourceUrl`（只填实际核验的链接）
- `observedAt`、`accessStatus`、`promptStatus`、`images`
- 来源仅有搜索摘要时用 `accessStatus: "search-index-only"`；原帖和作者回复直接核验后才能用 `publicly-verified`
- 没有完整原文用 `promptStatus: "partial"` 或 `"missing"`，省略 `promptText`
- `images` 可以先仅含观测的 `url`；可下载公开文件核验，未经转载授权不公开重发，不填虚构 `sha256`

只有完整来源、授权和素材核验完毕后才补：

- `promptText` 与 `promptStatus: "full"`
- `sourceVerification: {status: "verified", authorConfirmed: true}`，并附核验链接/说明
- `rights: {status: "authorized" | "open-license", license, evidence, scope: ["prompt", "images", "public-site", "public-repository"]}`。这是已完成核验的记录，不是以填字段代替取得权利
- 每张图片的 `localPath`（相对仓库路径）与真实 `sha256`
- `dedupeReview: {decision: "distinct" | "duplicate" | "near-duplicate", comparedCatalogSha256, comparedBatchSha256, comparedTo: [最近似的现有卡片ID], rationale, reviewer, reviewedAt}`。有重复图片时还需 `imageOverlapRationale`

`comparedCatalogSha256` 在初次运行报告中给出，来源为完整 `assets/js/data-curated.js` 文件。内容库更新后必须重新检查；不要沿用旧审核结论。每次审核（包括只有一条候选）都必须把报告的 `candidateBatchSha256` 写入 `comparedBatchSha256`，单条素材被修改后旧结论也会失效。多条候选必须人工交叉比较，防止仅与旧库对比却漏掉本批互相换皮的重复。`closestCandidates` 的三元字符相似度仅作定位参考，低分不能证明不重复，尤其不能证明跨语言或改写的差异。

## 命令

```bash
python3 tools/curate/review_threads.py /path/to/candidates.json \
  --output tools/curate/intake/review.json
python3 -m unittest discover -s tools/curate -p 'test_review_threads.py' -v
```

报告只会给 `exclude-duplicate`、`needs-review` 或 `eligible-for-manual-import`。最后一项仍需人工完成元数据、授权说明和源码审核，不会自动写入活动内容库。测试只使用清楚标记的虚构测试夹具，不把它们作为采集记录。

## 人工入库后的验证

1. 保留已有 ID，不覆盖已有卡片；近似版本只能按审核结论保留实质不同者
2. 为每组新素材写来源/授权清单、原文 SHA256、图片 SHA256；同步 `keywords.json`、第三方说明和总数量
3. 运行 `python3 tools/curate/build.py`、`npm test`、`npm run test:mutations`、浏览器测试；生成器现会拒绝重复 ID、Threads 帖子和归一化后完全重复的核心提示词
4. 检查新的图片分组和来源过滤、分页、收藏、详情图库、复制/下载及手机布局
5. GitHub Pages 从 `main` 自动部署；仅在得到网站维护者发布授权后提交。待审记录不随发布包上传，缺少匹配原图的条目不得进入活动内容库

### 来源清单的二次门禁

两份历史 Threads 清单的既有授权按原始文件 SHA256 固定，仅完全不变时可沿用。新增账号、向旧账号加入新案例或修改历史清单，必须在清单顶层记录 `rights` 的状态、许可、证据和四项转载范围，并在 `review` 记录：

- `sourceVerified: true`
- `rightsVerified: true`
- `coreDedupeApproved: true`
- `reviewer`、`reviewedAt`

这些字段表示编辑者已经完成来源、授权和去重审查，不是填入字段即自动获得授权，也不是发布网站的用户批准。Threads 卡片继续采用 CUSTOM 权利说明，并把具体许可写入 `licenseNote`/`rights.license`；未知状态不能渲染为“经授权收录”。校验使用显式异常，不会因 `python -O` 或 `PYTHONOPTIMIZE` 被禁用。

完成上述核验后，用 `python3 tools/curate/review_threads.py path/to/manifest.json --manifest-fingerprint` 计算清单内容指纹，写入 `review.contentSha256`。指纹覆盖除 `review` 外的全部清单内容（包括账号、帖子、提示词校验和、图片清单与权利范围），任何变化都需要重新审核。该命令只计算指纹，不会批准内容。
