### 案例 93：玻璃质感重塑 (by [@egeberkina](https://x.com/egeberkina))

[原文链接](https://x.com/egeberkina/status/1920448389960909085)

<img src="cases/93/glass_retexturing.png" width="300" alt="玻璃质感重塑"><br>
<sub>Image © 2025 <a href="https://github.com/jamez-bondos">@jamez-bondos</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> • Prompt by <a href="https://x.com/egeberkina">@egeberkina</a></sub>

**提示词**

```
对参考图片进行重新纹理化，基于下方的 JSON 美学定义
{
  "style": "photorealistic 3D render",
  "material": "glass with transparent and iridescent effects",
  "surface_texture": "smooth, polished with subtle reflections and refractive effects",
  "lighting": {
    "type": "studio HDRI",
    "intensity": "high",
    "direction": "angled top-left key light and ambient fill",
    "accent_colors": ["blue", "green", "purple"],
    "reflections": true,
    "refractions": true,
    "dispersion_effects": true,
    "bloom": true
  },
  "color_scheme": {
    "primary": "transparent with iridescent blue, green, and purple hues",
    "secondary": "crystal-clear with subtle chromatic shifts",
    "highlights": "soft, glowing accents reflecting rainbow-like effects",
    "rim_light": "soft reflective light around edges"
  },
  "background": {
    "color": "black",
    "vignette": true,
    "texture": "none"
  },
  "post_processing": {
    "chromatic_aberration": true,
    "glow": true,
    "high_contrast": true,
    "sharp_details": true
  }
}
```

*注意： 本提示词请使用 GPT-4o 生成图片；使用Sora可能无法生成正确的风格。*

**需上传参考图片：** 需要上传一张图像作为重新纹理化的基础。


---

[⬆️ 返回案例目录](#cases-toc)

