# 提示词网站 · AI Prompt Website

书桐 SHUTONG 是一个免登录的开源中文 AI 提示词网站，收录 90 条可填写、复制与导出的提示词模板：42 种图片风格转换，以及 48 个写作、编程、分析、学习、商业与生活任务。支持中英文搜索和本机收藏，可直接使用，也可自行部署。纯静态 HTML / CSS / JavaScript，无需后端或构建。

## 在线预览

[打开提示词网站 · 书桐 SHUTONG](https://bryceyuuu.github.io/ai-prompt-website/)

[![提示词网站首页：图片风格轮播、搜索与风格卡片](docs/images/homepage.png)](https://bryceyuuu.github.io/ai-prompt-website/)

点击首页截图即可在线体验。截图中的案例图署名与许可见 [第三方内容说明](THIRD_PARTY_NOTICES.md)。

通过 GitHub Pages 从 `main` 分支发布，仓库更新后会自动部署。

## Threads 公开图片提示词

收录 [@lch1776244](https://www.threads.com/@lch1776244) 的 4 组公开帖子、作者回复中的提示词和 18 张示例图。每组一张风格卡，详情页可逐张放大。搜索 `Chloe_Lai`、`Threads` 或 `lch1776244` 即可找到。原帖与作者回复分开链接，未收录登录后才能访问的历史内容；本次不是全量账号归档。

经网站维护者确认转载授权收录，原作者保留权利；不将这些素材重新许可为 MIT / CC。具体范围见 [第三方内容说明](THIRD_PARTY_NOTICES.md#threads--chloe_lai)。

新增 [@inkacalinka](https://www.threads.com/@inkacalinka) 的 **10 组提示词与 61 张原始示例图**：极简纸感、黑白炭笔、抽象记忆、粉彩蜡笔、羊毛毡绘本、第二世界拼贴、珐琅旅行磁贴、彩色扁平插画、厚涂油画、手帐剪纸。搜索 `inkacalinka` 或 `michelle` 可找到。排除一组与“第二世界”用途近似的旧版黑线小人叙事；图片和原文校验去重，授权按账号分别记录。来源及筛选记录见 [素材清单](tools/curate/sources/threads-inkacalinka.json)。仅覆盖本次公开可读内容，不代表账号完整历史。

## 当前内容

新增 [@blissful_nala](https://www.threads.com/@blissful_nala) 的 **10 组提示词与 27 张原始示例图**：角色三视图、马克笔生活涂鸦、复古邮票、印象派场景、色带厚涂微景、贝壳像素、梦核、层叠纸雕、超现实撞色和黏土贴纸。搜索 `blissful_nala`、`Lykke` 或对应中文风格即可找到。作者的长文附件和纸雕两段评论均已保存；毛毡帖子配错厚涂提示词的一组暂不收录。纸雕末句在原帖中未写完，页面已说明；梦核等关键词以参考照片的用法整理；透明贴纸的 JPEG 示例不代表具备透明通道。详见 [本次素材及筛选记录](tools/curate/sources/threads-blissful_nala.json)。首页轮播仍是 8 种精选效果，全量图片风格在分页列表中浏览。

- **42 个图片转换模板**：动漫手办、针织玩偶、摇头娃娃、玻璃雕塑、线稿、Q版钥匙扣、矢量海报、像素图标、微缩建筑、折纸、体素、赛博微缩，以及表情包、毛绒图标、簇绒地毯、蒸汽机械、双重曝光与磨砂剪影；新增复古图解、宠物涂鸦、等距纸上微缩、水彩方格拼贴四种上下对照海报，以及 michelle 的十种图像编辑海报。
- **48 个文字任务**：写作、编程、分析、学习、商业、生活各 8 条。提供输入项、处理步骤、交付格式和信息不足时的处理方式。
- 多图案例支持左右箭头、手势滑动、横向缩略图及大图连续浏览，图片序号与署名同步更新。
- 首页、分类及收藏支持每页 12 条的页码导航；翻页保留筛选与排序，详情返回保留页码。
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

Shutong is an open-source **AI prompt website** and **Chinese AI prompt library** with 90 curated **prompt templates**: 42 **image-to-image style transfer** prompts and 48 practical **LLM task prompts** for writing, coding, research, learning, business and everyday productivity. Browse by category, search Chinese or English aliases, fill template variables with a live preview, save favorites locally, and copy or export prompts. The static website requires no account, API key, backend or build step. It distributes prompts; it does not call AI models or provide a hosted image generator.

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
assets/js/data-curated.js      生成的 90 条内容
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
- Threads 图片与提示词按维护者确认的转载授权收录，保留作者与原帖链接；不授予第三方自由转载权。
- 原有图片与图片模板的来源是 [jamez-bondos/awesome-gpt4o-images](https://github.com/jamez-bondos/awesome-gpt4o-images)。所选案例按各自署名文件标注为 CC BY 4.0；中文模板经过改编，案例图片保持原文件。

逐项作者、来源、许可及使用范围见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。转载或修改内容时请保留对应署名、许可链接和改动说明。
