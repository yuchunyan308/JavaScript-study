# GitHub CI/CD 部署前端 Vue 项目 — 详细指南

## 核心流程概览

```
开发者 push / PR
      │
      ▼
GitHub Actions 触发
      │
      ├── 代码检查（Lint / Type Check）
      ├── 单元测试（Vitest）
      ├── 构建（vite build）
      └── 部署
            ├── GitHub Pages（静态）
            ├── Vercel / Netlify
            └── 云服务器（SSH）
```

---

## 一、工作流文件结构

```yaml
# .github/workflows/deploy.yml
name: Deploy Vue App

on:
  push:
    branches: [main]          # 只有 main 分支 push 才触发
  pull_request:
    branches: [main]          # PR 到 main 时触发检查（不部署）

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest    # 运行环境
    steps:
      - ...
```

---

## 二、完整工作流示例

### 部署到 GitHub Pages

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

# 必须给 Pages 写入权限
permissions:
  contents: read
  pages: write
  id-token: write

# 防止并发部署冲突
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'            # 缓存 node_modules，加速构建

      - name: Install dependencies
        run: npm ci               # ⚠️ 用 ci 而不是 install（更严格、更快）

      - name: Type check
        run: npm run type-check   # vue-tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test -- --run  # Vitest 单次运行

      - name: Build
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}  # 注入环境变量

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    needs: build                  # 等 build job 成功才执行
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

### 部署到云服务器（SSH + rsync）

```yaml
name: Deploy to Server

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_APP_ENV: production

      # 将 dist 同步到服务器
      - name: Deploy via rsync
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avzr --delete   # --delete 删除服务器上多余文件
          path: dist/
          remote_path: /var/www/myapp/
          remote_host: ${{ secrets.SERVER_HOST }}
          remote_user: ${{ secrets.SERVER_USER }}
          remote_key: ${{ secrets.SSH_PRIVATE_KEY }}

      # 远程执行命令（如重启 nginx）
      - name: Reload Nginx
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            sudo nginx -t && sudo systemctl reload nginx
            echo "✅ 部署完成：$(date)"
```

---

## 三、环境变量 & Secrets 管理

### ⚠️ 最重要的注意事项之一

```bash
# ❌ 错误：直接写在代码或 yml 里
VITE_API_URL=https://api.example.com

# ✅ 正确：存在 GitHub Secrets
# Settings → Secrets and variables → Actions → New repository secret
```

```yaml
# yml 中使用 Secrets
- name: Build
  run: npm run build
  env:
    VITE_API_URL: ${{ secrets.VITE_API_URL }}
    VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
```

### Vite 环境变量规则

```bash
# .env.production（可以提交，存放非敏感默认值）
VITE_APP_TITLE=MyApp
VITE_APP_VERSION=1.0.0

# .env.production.local（❌ 不要提交，加入 .gitignore）
VITE_API_URL=https://real-api.com
VITE_SECRET_KEY=xxx

# ⚠️ 只有 VITE_ 前缀的变量才会暴露给客户端代码
# 没有 VITE_ 前缀的变量只在 Node 构建时可用
```

```ts
// 代码中使用
const apiUrl = import.meta.env.VITE_API_URL
const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD
```

### 多环境配置

```yaml
# 使用 GitHub Environments 区分环境
jobs:
  deploy-staging:
    environment: staging          # 对应 GitHub 中配置的 Environment
    steps:
      - run: npm run build
        env:
          VITE_API_URL: ${{ secrets.STAGING_API_URL }}

  deploy-production:
    environment: production       # 可以设置需要人工审批才能部署
    needs: deploy-staging
    steps:
      - run: npm run build
        env:
          VITE_API_URL: ${{ secrets.PROD_API_URL }}
```

---

## 四、缓存策略（加速构建的关键）

```yaml
# 方案一：通过 setup-node 的 cache 参数（推荐，简单）
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'          # 或 'pnpm' / 'yarn'

# 方案二：手动精细控制缓存
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

# Vite 构建缓存
- name: Cache Vite build
  uses: actions/cache@v4
  with:
    path: node_modules/.vite
    key: ${{ runner.os }}-vite-${{ hashFiles('src/**') }}
```

### 缓存效果对比
```
无缓存：  install(45s) + build(30s) = 75s
有缓存：  install(5s)  + build(15s) = 20s  ✅ 节省 73%
```

---

## 五、Vue 项目特有配置

### vite.config.ts 中的 base 路径

```ts
// ⚠️ 部署到 GitHub Pages 子路径时必须配置
// https://username.github.io/repo-name/

export default defineConfig({
  // 方案一：写死
  base: '/repo-name/',

  // 方案二：通过环境变量动态配置（推荐）
  base: process.env.VITE_BASE_URL || '/',
})
```

```yaml
# CI 中注入 base 路径
- name: Build
  run: npm run build
  env:
    VITE_BASE_URL: /my-vue-app/   # GitHub Pages 子路径
```

### Vue Router 的 History 模式问题

```ts
// ⚠️ History 模式在静态服务器上会 404
// 需要服务器配置重定向，或改用 Hash 模式

// Hash 模式（GitHub Pages 友好）
const router = createRouter({
  history: createWebHashHistory(),  // URL: /#/home
})

// History 模式（需服务器支持）
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
})
```

```nginx
# Nginx 配置支持 History 模式
server {
    location / {
        try_files $uri $uri/ /index.html;  # 关键：fallback 到 index.html
    }
}
```

---

## 六、PR 预览部署（Preview Deployments）

```yaml
# 每个 PR 自动生成独立预览环境
name: PR Preview

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci && npm run build

      # 部署到 Netlify Preview
      - name: Deploy Preview
        uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: './dist'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "PR #${{ github.event.number }} Preview"
          enable-pull-request-comment: true    # 在 PR 评论中贴出预览链接
          enable-commit-comment: false
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

效果：PR 下自动出现评论 👇
```
✅ Deploy Preview ready!
🔍 Preview URL: https://deploy-preview-42--myapp.netlify.app
```

---

## 七、质量门禁（Quality Gates）

```yaml
# 构建失败自动阻断部署
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci

      # 并行执行检查（节省时间）
      - name: Run all checks
        run: |
          npm run type-check &   # vue-tsc
          npm run lint &         # ESLint
          npm run test -- --run & # Vitest
          wait                   # 等待所有并行任务

      # 构建产物大小检测
      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          # 超出限制自动在 PR 评论警告
```

---

## 八、⚠️ 常见坑与注意事项

### 1. `npm install` vs `npm ci`
```bash
# ❌ npm install：可能更新 lock 文件，不稳定
# ✅ npm ci：严格按 lock 文件安装，速度更快，CI 专用
npm ci
```

### 2. Node 版本一致性
```yaml
# ⚠️ 本地 Node 18，CI 用 Node 16 → 可能出现兼容问题
# 通过 .nvmrc 或 package.json engines 锁定版本

# .nvmrc
20.11.0

# package.json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 3. 敏感信息泄露
```yaml
# ❌ 错误：打印包含敏感信息的环境变量
- run: env  # 会打印所有环境变量到日志！

# ✅ 正确：GitHub 会自动 mask Secrets 值，但避免主动打印
- run: echo "API URL is set"  # 只确认存在，不打印值
```

### 4. 构建产物未清理
```yaml
# 每次构建前清理旧产物
- run: rm -rf dist
- run: npm run build
```

### 5. 时区问题
```yaml
# GitHub Actions 默认 UTC，如果日志时间对不上
- run: |
    export TZ='Asia/Shanghai'
    echo "当前时间: $(date)"
```

### 6. 权限问题（SSH Key）
```bash
# 生成专用部署密钥（不要用个人 key）
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key

# 公钥 → 服务器 ~/.ssh/authorized_keys
# 私钥 → GitHub Secrets: SSH_PRIVATE_KEY
```

---

## 九、通知与监控

```yaml
# 部署成功/失败发送通知
- name: Notify on success
  if: success()
  uses: 8398a7/action-slack@v3
  with:
    status: success
    text: "✅ ${{ github.repository }} 部署成功！"
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: "❌ ${{ github.repository }} 部署失败，请检查！"
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 十、推荐工作流分支策略

```
feature/* ──► develop ──► staging ──► main
    │              │           │         │
    │           自动部署     自动部署   人工审批
    │           测试环境     预发环境   生产部署
    │
  仅运行
  lint + test
```

```yaml
on:
  push:
    branches:
      - main        # → 部署生产
      - staging     # → 部署预发
      - develop     # → 部署测试
  pull_request:
    branches: ['**'] # → 只跑 lint + test，不部署
```

---

## 小结：最佳实践清单

| 项目 | 建议 |
|------|------|
| 包安装命令 | 用 `npm ci` 替代 `npm install` |
| 敏感变量 | 全部放 GitHub Secrets，不硬编码 |
| Node 版本 | 用 `.nvmrc` 锁定，CI 与本地一致 |
| 缓存 | 配置 `node_modules` 缓存，节省时间 |
| 部署条件 | 质量检查全通过才允许部署 |
| 分支策略 | main 受保护，必须通过 PR + CI |
| 预览环境 | PR 自动生成 preview URL |
| 通知 | 配置 Slack/钉钉 部署结果通知 |
| 密钥 | SSH 使用专用 Deploy Key，定期轮换 |

