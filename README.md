# 书桐 SHUTONG · 中文 AI 提示词库 / AI Prompt Library

一个简洁、无需登录的中文提示词网站。首页专注图片转换，文字任务通过独立分类入口浏览。纯静态 HTML / CSS / JavaScript，无后端、无运行时依赖、无需构建。

## 当前内容

- **18 个图片转换模板**：动漫手办、针织玩偶、摇头娃娃、玻璃雕塑、线稿、Q版钥匙扣、矢量海报、像素图标、微缩建筑、折纸、体素、赛博微缩，以及表情包、毛绒图标、簇绒地毯、蒸汽机械、双重曝光与磨砂剪影。
- **48 个文字任务**：写作、编程、分析、学习、商业、生活各 8 条。提供输入项、处理步骤、交付格式和信息不足时的处理方式。
- 实时填写与预览、当前浏览器收藏、来源图全屏预览、搜索与分类、自动/手动轮播、复制与 Markdown / JSON 导出、移动端布局、键盘导航和减少动态效果支持。
- 每条保留来源、整理方式、许可和核验状态。

图片模板使用方式：在支持图片编辑的 AI 工具中上传原图，再粘贴模板。本站提供提示词，不直接调用模型生成图片。文字模板需要填写输入材料后再提交给 AI 工具。

**效果说明：** 本站做了编辑筛选和功能测试，但尚未逐条运行验证模型输出。风格卡图片为上游公开案例，不是本站中文改编版的实测结果。首页材质专题使用原创 AI 展示图并明确标注为视觉示意。GitHub 星数是仓库级历史快照，不是单条模板热度或质量评分。

## 从发现到使用

1. 首页看图片风格，或进入「场景提示词」选具体任务。
2. 打开模板，在「填入你的需求」中填写材料，提示词实时组装。
3. 复制或下载填写后的提示词，到你的 AI 工具中运行；图片任务还要上传原图。
4. 点击书签保存在「我的收藏」。仅收藏 ID 存入本地浏览器；材料只在页面内存中，刷新即清空，不发送到服务器。禁用存储时收藏降级为当前会话。

视觉规范见 [DESIGN.md](DESIGN.md)，本次变化见 [CHANGELOG.md](CHANGELOG.md)。

## 按任务查找提示词

搜索日常说法或英文任务名，都可以定位模板：

| 场景 | 常用搜索词 |
|---|---|
| 图片风格转换 / Image-to-image | 照片转手办、毛绒玩具、像素画、线稿、微缩模型、style transfer、pixel art、amigurumi |
| 写作与翻译 / Writing & translation | 文案润色、商务邮件、中英翻译、语法纠错、长文总结、proofreading、email reply |
| 编程开发 / Coding | 代码审查、找 bug、日志分析、命令行、Git 提交说明、code review、debugging、system design |
| 分析与决策 / Analysis | 事实核查、论文精读、方案对比、数据提取、fact checking、decision matrix、text to CSV |
| 学习教育 / Learning | 闪卡、Anki 卡片、练习题、课堂笔记、学习计划、flashcards、quiz generator |
| 商业职场 / Business | PRD、产品需求文档、用户反馈、销售复盘、会议纪要、meeting minutes、action items |
| 生活日常 / Everyday tasks | 菜谱整理、服务条款、年度总结、购物对比、recipe extraction、buying guide |

### English overview

Shutong is an open-source **Chinese AI prompt library** with 66 curated **prompt templates**: 18 **image-to-image style transfer** prompts and 48 practical **LLM task prompts** for writing, coding, research, learning, business and everyday productivity. Browse by category, search Chinese or English aliases, fill template variables with a live preview, save favorites locally, and copy or export prompts. The static website requires no account, API key, backend or build step. It distributes prompts; it does not call AI models or provide a hosted image generator.

## 本地预览

下载仓库后直接打开 `index.html`。也可以运行：

```bash
python3 -m http.server 8000
```

然后访问 <http://localhost:8000>。可将静态文件部署到支持静态站点的托管服务。

## 开发与检查

需要 Node.js 22.22.2+（22.x）、24.15.0+（24.x）或 26+；重新生成内容时还需要 Python 3。Node 依赖仅用于开发测试，不影响直接打开页面。

```bash
npm ci
npm test
npm run test:mutations
```

浏览器走查为可选检查，需要本机 Chrome：

```bash
# macOS 使用标准 Chrome 安装路径；Linux 默认 google-chrome。
# 自定义安装位置时设置 CHROME_BIN。
npm run test:browser
```

`./tools/accept.sh` 执行基础检查；`./tools/accept.sh full` 增加变异与浏览器检查。浏览器量具依赖 Chrome 的 headless 实现，首次在不同系统使用时应检查输出。

## 内容维护

```text
index.html                     页面入口
assets/js/app.js               路由、交互和渲染
assets/js/data.js              分类与数据组装
assets/js/data-curated.js      生成的 66 条内容
assets/css/                   页面样式
assets/img/curated/            来源案例图
schema/                       数据规范与校验
tools/curate/text-specs.json  文字任务编辑清单
tools/curate/keywords.json    每条模板的中英文搜索别名
tools/curate/build.py         图片模板与离线生成器
tools/curate/sources/         来源快照、署名与许可证
```

修改 `text-specs.json` 或 `build.py` 中的图片清单，然后执行：

```bash
npm run build:catalog
npm test
```

请勿直接修改生成的 `data-curated.js`。提交新内容时请给出明确的输入、可验收的产物、出处与许可；未经验证的效果不得标为实测。当前没有 GitHub 自动采集发布、人工审核后台或账户系统。

## 开源协议与致谢

项目原创代码使用 [MIT License](LICENSE)。**该许可证不覆盖第三方内容**：

- 文字任务改编自 [danielmiessler/fabric](https://github.com/danielmiessler/fabric)，遵守上游 MIT，保留完整版权声明。
- 图片与图片模板的来源是 [jamez-bondos/awesome-gpt4o-images](https://github.com/jamez-bondos/awesome-gpt4o-images)。所选案例按各自署名文件标注为 CC BY 4.0；中文模板经过改编，案例图片保持原文件。

逐项作者、来源、许可及使用范围见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。转载或修改内容时请保留对应署名、许可链接和改动说明。
