# Butterfly 主题架构文档

> 基于 Butterfly 5.x 源码分析，帮助理解主题内部结构和定制点。

## 目录结构

```
themes/butterfly/
├── _config.yml              # 主题配置文件（1384 行，最重要的配置入口）
├── source/
│   ├── css/                 # 主题样式（stylus 编译）
│   └── js/
│       ├── main.js          # 核心交互逻辑（1023 行）
│       └── utils.js         # 工具函数库（368 行）
├── layout/
│   ├── archive.pug          # 归档页模板
│   ├── category.pug         # 分类页模板
│   ├── index.pug            # 首页模板
│   ├── layout.pug           # 全局布局模板（主骨架）
│   ├── page.pug             # 独立页模板
│   ├── post.pug             # 文章页模板
│   ├── tag.pug              # 标签页模板
│   └── includes/
│       ├── head.pug         # <head> 区域（CSS 注入、meta 标签）
│       ├── header/          # 页头组件（导航栏、菜单）
│       ├── footer.pug       # 页脚
│       ├── sidebar/         # 侧边栏组件
│       ├── post/            # 文章相关组件（目录、版权、打赏）
│       ├── page/            # 独立页组件
│       ├── mixins/          # Pug mixins（可复用模板片段）
│       └── third-party/     # 第三方服务集成（评论、统计、数学公式等）
├── scripts/
│   ├── events.js            # Hexo 事件钩子
│   ├── filters.js           # Hexo 过滤器
│   ├── helpers.js           # Hexo 辅助函数
│   └── tags/                # 自定义标签（{% note %}、{% tabs %} 等）
└── languages/               # 多语言配置
```

## 核心配置（_config.yml）

### 导航与菜单
```yaml
nav:
  logo:                      # 导航栏 logo
  display_title: true        # 是否显示站点标题
  fixed: false               # 是否固定导航栏

menu:                        # 导航菜单项
  Home: / || fas fa-home
  标签: /tags/ || fas fa-tags
```

### 代码块
```yaml
code_blocks:
  theme: light               # 主题：darker / pale night / light / ocean
  macStyle: false            # Mac 风格按钮
  height_limit: false        # 高度限制（px）
  copy: true                 # 复制按钮
  shrink: false              # 折叠代码块
```

### 图片配置
```yaml
favicon: /img/favicon.png
avatar:
  img: /img/avatar.png
  effect: false              # 头像动画效果

disable_top_img: false       # 禁用所有顶部图片
default_top_img: /img/covers/enterprise_2.jpg
index_img: /img/covers/enterprise_2.jpg
```

### 首页布局
```yaml
index_layout: 3              # 文章卡片布局
                             # 1: 左图右文 2: 右图左文 3: 左右交替
                             # 4: 上图下文 5: 文字覆盖在图上
                             # 6/7: 瀑布流布局

index_post_content:
  method: 3                  # 1: description 2: both 3: auto_excerpt
  length: 150                # 自动摘要长度
```

### 文章页
```yaml
toc:
  post: true                 # 文章目录
  number: true               # 显示章节编号
  style_simple: false        # 简洁模式

reward:
  enable: false              # 打赏功能
  QR_code:                   # 二维码图片
```

### 侧边栏
```yaml
aside:
  enable: true
  hide: false                # 默认隐藏
  button: true               # 显示切换按钮
  mobile: true               # 移动端显示
  position: right            # left / right
  display:                   # 各页面显示配置
    archive: true
    tag: true
    category: true
```

### 第三方服务
```yaml
comments:
  use:                       # disqus / disqusjs / livere / gitalk / valine / giscus / waline / utterances / facebook / twikoo / artalk
  text: true
  lazyload: false

analytics:
  use:                       # baidu / google / cloudflare / umami
  baidu_analytics:
  google_analytics:

math:
  use:                       # katex / mathjax
  per_page: false            # 是否每页都加载
```

## 核心 JavaScript 模块

### utils.js - 工具函数库

#### 节流与防抖
```javascript
btf.debounce(func, wait, immediate)  // 防抖
btf.throttle(func, wait, options)    // 节流
btf.rafThrottle(fn)                  // requestAnimationFrame 节流
```

#### 滚动与定位
```javascript
btf.scrollToDest(pos, time)          // 平滑滚动到目标位置
btf.getEleTop(ele)                   // 获取元素相对于文档顶部的距离
btf.getScrollPercent(currentTop, ele) // 计算滚动百分比
```

#### 动画与显示
```javascript
btf.animateIn(ele, animation)        // 显示动画
btf.animateOut(ele, animation)       // 隐藏动画
btf.isVisible(ele)                   // 判断元素是否可见
```

#### 通知与提示
```javascript
btf.snackbarShow(text, showAction, duration)  // Snackbar 提示
```

#### 时间与日期
```javascript
btf.diffDate(inputDate, more)        // 计算时间差（返回"刚刚"、"3 天前"等）
```

#### DOM 操作
```javascript
btf.wrap(ele, tag, options)          // 用指定标签包裹元素
btf.unwrap(ele)                      // 移除元素的父级包裹
btf.loadLightbox(images)             // 初始化图片灯箱
btf.overflowPaddingR.add()           // 添加滚动条占位（防止布局抖动）
btf.overflowPaddingR.remove()        // 移除滚动条占位
```

#### 资源加载
```javascript
btf.getScript(url)                   // 动态加载 JS 脚本
btf.getCSS(url)                      // 动态加载 CSS 样式
```

### main.js - 核心交互逻辑

#### 初始化流程
```javascript
document.addEventListener('DOMContentLoaded', () => {
  initAdjust()           // 初始化导航栏自适应
  unRefreshFn()          // 只需初始化一次的功能
  refreshFn()            // 每次页面刷新都要执行的功能
})
```

#### 导航栏自适应（adjustMenu）
```javascript
const adjustMenu = init => {
  // 计算导航栏内容宽度（logo + 菜单项）
  // 如果窗口宽度不足，添加 hide-menu 类隐藏菜单
  // 移动端自动隐藏菜单
}
```

#### 侧边栏控制（sidebarFn）
```javascript
const sidebarFn = {
  open: () => {
    // 添加滚动条占位
    // 显示遮罩层
    // 打开侧边栏菜单
  },
  close: () => {
    // 移除滚动条占位
    // 隐藏遮罩层
    // 关闭侧边栏菜单
  }
}
```

#### 代码高亮工具（addHighlightTool）
```javascript
const addHighlightTool = $article => {
  // 为代码块添加工具栏：
  // - 语言标签
  // - 复制按钮
  // - 折叠/展开按钮
  // - 全屏按钮
  // - Mac 风格按钮
  // 支持 highlight.js 和 prismjs
}
```

#### 图片灯箱（runLightbox）
```javascript
const runLightbox = $article => {
  // 为文章中的图片添加灯箱功能
  // 排除 .no-lightbox 类的图片
  // 支持 mediumZoom / fancybox
}
```

#### 图库排版（addJustifiedGallery）
```javascript
const addJustifiedGallery = async (elements, tabs = false) => {
  // 使用 InfiniteGrid.JustifiedInfiniteGrid 实现瀑布流布局
  // 支持分页加载（每页 limit 张，首页 firstLimit 张）
  // 支持"加载更多"按钮
  // 支持标签切换
}
```

#### 目录滚动同步（scrollFnToDo）
```javascript
const scrollFnToDo = $article => {
  // 使用 IntersectionObserver 监听标题元素
  // 滚动时高亮当前章节在目录中的位置
  // 自动滚动目录到当前章节
  // 显示滚动百分比
}
```

#### 导航栏显隐（scrollFn）
```javascript
const scrollFn = () => {
  // 向下滚动时隐藏导航栏（nav-visible）
  // 向上滚动时显示导航栏
  // 滚动超过 56px 时固定导航栏（nav-fixed）
  // 显示返回顶部按钮（rightside-show）
}
```

#### 右侧工具栏（rightSideFn）
```javascript
const rightSideFn = {
  'readmode': () => {},           // 阅读模式
  'translateLink': () => {},      // 简繁切换
  'darkmode': () => {},           // 暗黑模式
  'hide-aside-btn': () => {},     // 隐藏侧边栏
  'mobile-toc-button': () => {},  // 移动端目录
  'go-up': () => {},              // 返回顶部
}
```

#### 标签页切换（tabsFn）
```javascript
const tabsFn = $article => {
  // 处理 {% tabs %} 标签
  // 点击标签头切换内容
  // 同步标签状态
}
```

#### 懒加载（lazyloadImg）
```javascript
const lazyloadImg = () => {
  // 使用 IntersectionObserver 实现图片懒加载
  // data-lazy-src 属性存储真实图片地址
  // 进入视口时加载图片
}
```

#### 相对时间（relativeDate）
```javascript
const relativeDate = selector => {
  // 将时间标签转换为相对时间（"3 天前"）
  // 支持首页和文章页
}
```

#### 瀑布流首页（justifiedIndexPostUI）
```javascript
const justifiedIndexPostUI = () => {
  // 如果 index_layout 是 6 或 7（瀑布流）
  // 使用 InfiniteGrid 实现文章卡片瀑布流
  // 响应式布局，自动调整列数
}
```

## 布局结构（layout.pug）

### 全局骨架
```pug
html(lang=config.language, data-theme=theme.display_mode)
  head
    include ./head.pug
  body
    #web_bg                    // 背景层（支持图片/颜色/随机数组）
    !=partial('includes/sidebar')  // 侧边栏菜单
    
    #body-wrap(class=pageType)
      include ./header/index.pug   // 页头（导航栏 + 顶部图片）
      
      main#content-inner.layout
        if body
          div!= body               // 独立页内容
        else
          block content            // 文章/首页内容
          include widget/index.pug // 侧边栏组件
      
      footer#footer
        !=partial('includes/footer')
    
    include ./rightside.pug        // 右侧工具栏
    include ./additional-js.pug    // 额外脚本
```

### 关键 DOM 节点
- `#web_bg` - 全屏背景层
- `#body-wrap` - 主体容器（被 PJAX 替换）
- `#page-header` - 页头（导航栏 + 顶部图片）
- `#content-inner` - 内容区域
- `#aside-content` - 侧边栏内容
- `#footer` - 页脚
- `#rightside` - 右侧工具栏

## 第三方服务集成

### 评论系统（includes/third-party/comments/）
- Disqus / DisqusJS
- Livere
- Gitalk
- Valine
- Giscus
- Waline
- Utterances
- Facebook Comments
- Twikoo
- Artalk

### 统计分析（includes/third-party/analytics/）
- 百度统计
- Google Analytics
- Cloudflare Analytics
- Umami

### 数学公式（includes/third-party/math/）
- KaTeX
- MathJax

### 其他服务
- Algolia 搜索
- Local Search
- Mermaid 图表
- Chart.js
- APlayer 音乐播放器
- 各种分享插件

## 自定义标签（scripts/tags/）

### {% note %} - 提示框
```markdown
{% note 'color' 'icon' %}
内容
{% endnote %}
```

### {% tabs %} - 标签页
```markdown
{% tabs Unique name %}
<!-- tab 标签1 -->
内容1
<!-- endtab -->
<!-- tab 标签2 -->
内容2
<!-- endtab -->
{% endtabs %}
```

### {% gallery %} - 图库
```markdown
{% gallery '描述' %}
![描述](图片地址)
{% endgallery %}
```

### {% mermaid %} - 流程图
```markdown
{% mermaid %}
graph TD
  A-->B
{% endmermaid %}
```

## 定制点总结

### 已定制的组件

1. **文章卡片（indexPostUI.pug）**
   - 位置：`layout/includes/mixins/indexPostUI.pug`
   - 定制：改为竖版 2 列网格布局
   - 样式：`source/css/post-list.css`

2. **欢迎动画**
   - 位置：`source/js/welcome_animation.js` + `source/css/welcome_animation.css`
   - 功能：首页加载时显示灰色幽灵动画 + 打字机台词

3. **活跃度热力图**
   - 位置：`source/js/activity.js` + `source/css/activity.css`
   - 数据：`scripts/activity.js` 生成 `/data/activity.json`
   - 功能：首页显示 Git 提交热力图

4. **画廊瀑布流**
   - 位置：`source/js/gallery.js` + `source/css/gallery.css`
   - 数据：`scripts/gallery-list.js` 扫描 `source/carousel/` 生成 `/gallery.json`
   - 功能：画廊页随机排列 + 灯箱

5. **BGM 播放器**
   - 位置：`source/js/music.js`
   - 音频：`source/music/bgm.mp3`
   - 功能：首页背景音乐，支持播放/暂停

6. **视频封面**
   - 位置：`source/js/video-cover.js`
   - 视频：`source/videos/cover.mp4`
   - 功能：首页顶部视频封面（手机端降级为图片）

7. **齿轮设置菜单**
   - 位置：内联在 `_config.yml` 的 inject 中（226 行）
   - 功能：暗色模式切换、BGM 开关

8. **PJAX 滚动处理**
   - 位置：`layout/includes/third-party/pjax.pug`
   - 定制：`scrollTo: false` + `pjax:complete` 手动滚动到 `#content-inner`

9. **分页链接**
   - 位置：`layout/includes/pagination.pug`
   - 定制：去掉 `#content-inner` 锚点（修复 PJAX 强制刷新）

10. **随机排序**
    - 位置：`source/js/random_posts.js`
    - 功能：首页文章随机排列，置顶文章固定在前

### 配置项定制

- `nav.fixed: false` - 导航栏不固定
- `index_layout: 3` - 文章卡片左右交替布局
- `index_site_info_top:` - 首页信息位置（空 = 居中）
- `subtitle.enable: false` - 禁用副标题打字机效果（由自定义欢迎动画替代）
- `toc.post: true` - 文章目录
- `aside.enable: true` - 启用侧边栏
- `aside.position: right` - 侧边栏在右侧

## 升级注意事项

1. **备份定制文件**：升级前备份 `layout/includes/mixins/indexPostUI.pug` 和 `_config.yml`
2. **检查 inject 配置**：确保自定义 CSS/JS 路径正确
3. **测试 PJAX**：验证页面切换后所有功能正常
4. **验证画廊**：确保 `gallery.json` 正确生成
5. **检查依赖**：确认 `sharp` 等依赖版本兼容

## 性能优化建议

1. **图片压缩**：定期运行 `node compress-images.js`
2. **懒加载**：已启用图片和评论懒加载
3. **代码分割**：第三方服务按需加载
4. **CSS 优化**：使用 Stylus 变量减少重复
5. **缓存策略**：静态资源使用版本号缓存
