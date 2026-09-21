/* Current taxonomy and reviewed catalog assembly. See tools/curate/README.md. */
const TAXONOMY = {
  /* 顶层分类 —— 首页与库页的分类条就按这个顺序排 */
  categories: [
    { key: 'image',    name: '图片转换', latin: 'Image',    desc: '上传原图，转换画风并保留主体' },
    { key: 'write',    name: '写作文案', latin: 'Writing',  desc: '改写、纠错、翻译、邮件与摘要' },
    { key: 'code',     name: '编程开发', latin: 'Code',     desc: '代码审查、Diff、日志诊断与技术方案' },
    { key: 'analyze',  name: '分析推理', latin: 'Analysis', desc: '证据核查、论文分析、风险与方案对照' },
    { key: 'learn',    name: '学习教育', latin: 'Learning', desc: '知识测验、记忆卡片、数学与课程笔记' },
    { key: 'business', name: '商业职场', latin: 'Business', desc: '需求、反馈、销售复盘与会议行动项' },
    { key: 'life',     name: '生活日常', latin: 'Life',     desc: '菜谱、条款解读、计划复盘与购买决策' }
  ],
  uses: [
    { key: '社交封面', desc: '小红书 / 公众号头图' },
    { key: '电商主图', desc: '商品与场景渲染' },
    { key: 'PPT 配图', desc: '汇报与提案' },
    { key: '头像', desc: '个人与账号形象' },
    { key: '海报', desc: '活动与宣传物料' },
    { key: '壁纸', desc: '桌面与手机' },
    { key: '文章插图', desc: '长文与专栏' },
    { key: '长文写作', desc: '小说、剧本、论说文' },
    { key: '邮件与通知', desc: '对外沟通与内部同步' },
    { key: '代码评审', desc: '读代码、找问题、提改动' },
    { key: '数据分析', desc: '口径、统计与可视化' },
    { key: '学习辅导', desc: '讲解、陪练与出题' },
    { key: '面试与招聘', desc: '模拟面试与筛人' },
    { key: '营销文案', desc: '投放、话术与内容运营' },
    { key: '产品规划', desc: '需求拆解与方案设计' },
    { key: '日常决策', desc: '帮你把选项摊开来看' },
    { key: '旅行规划', desc: '路线、预算与交通' },
    { key: '健康管理', desc: '训练、饮食与作息' }
  ],
  moods: [
    { key: '清冷', desc: '低饱和、克制、距离感' },
    { key: '治愈', desc: '柔和、暖调、安全感' },
    { key: '赛博', desc: '霓虹、机械、未来感' },
    { key: '复古', desc: '年代感、印刷、旧物' },
    { key: '胶片', desc: '颗粒、宽容度、自然光' },
    { key: '极简', desc: '留白、少元素、高秩序' },
    { key: '荒诞', desc: '超现实、错位、幽默' },
    { key: '秩序', desc: '网格、几何、结构感' },
    { key: '严谨', desc: '先讲前提，再给结论' },
    { key: '亲和', desc: '像同事在跟你说话' },
    { key: '犀利', desc: '直接指出问题，不绕弯' },
    { key: '结构化', desc: '分点、分层、可执行' },
    { key: '幽默', desc: '轻松，但不轻浮' },
    { key: '沉稳', desc: '慢一点，先把问题想清楚' }
  ],
  tracks: [
    { key: 'both', label: '双轨' },
    { key: 'local', label: '仅本地' },
    { key: 'cloud', label: '仅云端' },
    { key: 'text', label: '纯提示词' }
  ],
  sorts: [
    { key: 'hot', label: '推荐顺序' },
    { key: 'new', label: '最近更新' }
  ]
};

const STYLES = Object.values(HF_CURATED);
const HF_COVERS = {}, HF_NOTES = {}, HF_SAMPLES = {};
STYLES.forEach(function(s) {
  if (s.cover) HF_COVERS[s.id] = s.cover;
  HF_NOTES[s.id] = s.guide;
  if (HF_CURATED_SAMPLES[s.id]) HF_SAMPLES[s.id] = HF_CURATED_SAMPLES[s.id];
});
