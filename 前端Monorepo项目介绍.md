前端 **Monorepo（单体仓库）** 是一种把多个项目（应用 + 组件库 + 工具包等）放在**同一个代码仓库**中进行统一管理的开发模式。相比传统的“一个项目一个仓库（Multi-repo）”，它更适合中大型前端工程体系。

我给你从**概念 → 架构 → 工具 → 优缺点 → 实战结构 → 适用场景**一层层讲清楚。

---

# 一、Monorepo 是什么？

简单说：

👉 一个仓库里，放多个前端项目

例如：

```
my-monorepo/
├── apps/
│   ├── web-app        # 主站
│   ├── admin-app      # 管理后台
│
├── packages/
│   ├── ui-components  # 组件库
│   ├── utils          # 工具函数
│   ├── hooks          # 自定义 hooks
│
├── package.json
```

这些项目：

* 可以互相引用（本地依赖）
* 统一版本管理
* 统一构建、测试、发布

---

# 二、核心思想（重点）

Monorepo 的核心不是“放在一起”，而是：

### 1️⃣ 代码复用最大化

多个项目共享：

* UI组件
* 工具函数
* hooks
* 配置（eslint / tsconfig）

---

### 2️⃣ 原子化拆分

把大项目拆成多个“包（package）”

例如：

* `@company/ui`
* `@company/utils`
* `@company/api`

---

### 3️⃣ 本地依赖（最关键）

不同 package 之间：

👉 不需要发布 npm
👉 直接本地引用

例如：

```js
import { Button } from '@company/ui'
```

---

# 三、常见技术方案

Monorepo 本身不是技术，是“结构 + 工具组合”。

常见工具👇

---

## 1️⃣ 包管理工具

### 🔹 pnpm（当前主流推荐）

特点：

* workspace 支持
* 磁盘占用小
* 安装速度快

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

---

### 🔹 Yarn Workspaces

经典方案：

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

---

### 🔹 npm Workspaces

官方方案（稍弱一点）

---

## 2️⃣ Monorepo 管理工具（进阶）

---

### 🔥 Turborepo（强烈推荐）

特点：

* 增量构建（只构建改动部分）
* 缓存机制（极大加速 CI）
* pipeline 管理

示例：

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

### 🔥 Nx

特点：

* 更重、更企业级
* 强依赖图分析
* 适合大型团队

---

### 🔹 Lerna（老牌）

现在常配合 pnpm 使用

---

# 四、Monorepo 目录设计（实战）

一个比较标准的结构👇

```
my-monorepo/
├── apps/
│   ├── web/          # 主应用
│   ├── admin/
│
├── packages/
│   ├── ui/           # 组件库
│   ├── utils/        # 工具库
│   ├── config/       # eslint/ts配置
│
├── docs/             # 文档
├── scripts/          # 脚本
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
```

---

# 五、依赖关系（关键理解）

Monorepo 会形成一张依赖图：

```
web-app ──▶ ui ──▶ utils
admin   ──▶ ui
```

工具（如 Turborepo / Nx）会：

* 自动识别依赖
* 按顺序构建
* 避免重复构建

---

# 六、优点（为什么用）

### ✅ 1. 代码复用极高

组件库一次开发，多项目使用

---

### ✅ 2. 统一技术栈

* React版本统一
* ESLint统一
* TS配置统一

---

### ✅ 3. 原子化发布

可以只发布某个 package：

```bash
pnpm publish --filter @company/ui
```

---

### ✅ 4. 开发体验好

改组件 → 所有项目立即生效（本地联调）

---

### ✅ 5. CI/CD 更高效

结合 Turborepo：

👉 只构建变更部分

---

# 七、缺点（必须知道）

### ❌ 1. 学习成本高

新人需要理解：

* workspace
* 依赖关系
* 构建流程

---

### ❌ 2. 仓库体积大

所有项目都在一个仓库里

---

### ❌ 3. 权限 & 责任边界复杂

不同团队改同一仓库

---

### ❌ 4. 构建配置复杂

尤其：

* vite / webpack
* ts path
* alias

---

# 八、适合什么场景？

### 👍 非常适合

* 多前端项目（官网 + 后台 + H5）
* 有组件库
* 有设计系统
* 中大型团队

---

### 👎 不适合

* 单页面小项目
* 个人 demo
* 没有复用需求

---

# 九、一个真实案例（理解更直观）

假设你做一个公司系统：

```
apps/
  ├── user-web
  ├── admin-web

packages/
  ├── ui         # 按钮/表单/弹窗
  ├── api        # 请求封装
  ├── utils      # 工具函数
```

开发流程：

1️⃣ 在 ui 写 Button
2️⃣ admin-web 直接用
3️⃣ 修改 Button → admin 自动更新

👉 不需要发 npm 包！

---

# 十、一句话总结

👉 Monorepo = 多项目 + 单仓库 + 本地依赖 + 统一管理

---

