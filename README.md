# 🚀 Fastify 企业级后端脚手架

> 基于 Fastify 构建的高性能、模块化 Node.js 后端项目，展示企业级最佳实践。

## 技术栈

| 分层 | 技术 | 用途 |
|------|------|------|
| 框架 | **Fastify v4** | 高性能 HTTP 框架 |
| 验证 | **Zod + zod-to-json-schema** | 运行时类型安全 + Swagger 生成 |
| 数据库 | **better-sqlite3** | 嵌入式 SQLite，WAL 模式 |
| 认证 | **@fastify/jwt + bcryptjs** | JWT Token + 密码哈希 |
| 文档 | **@fastify/swagger-ui** | 自动生成 OpenAPI 3.0 文档 |
| 跨域 | **@fastify/cors** | 灵活的 CORS 配置 |

---

## 项目结构

```
fastify-scaffold/
├── scripts/
│   └── reset-db.js           # 数据库重置 & 种子数据脚本
├── src/
│   ├── config/
│   │   └── index.js          # 统一配置（从环境变量读取）
│   ├── common/               # 跨模块共享工具
│   │   ├── errors.js         # 自定义业务错误类
│   │   ├── response.js       # 统一响应格式工具
│   │   └── authenticate.js   # JWT 认证钩子
│   ├── plugins/              # Fastify 插件（使用 fastify-plugin 包装）
│   │   ├── db.js             # SQLite 数据库连接插件
│   │   └── swagger.js        # Swagger/OpenAPI 文档插件
│   ├── modules/              # 业务模块（按功能聚合）
│   │   ├── auth/
│   │   │   ├── auth.schema.js      # Zod Schema + JSON Schema
│   │   │   ├── auth.repository.js  # 数据访问层（SQL）
│   │   │   ├── auth.service.js     # 业务逻辑层
│   │   │   ├── auth.controller.js  # 控制器（HTTP 处理）
│   │   │   └── auth.routes.js      # 路由定义 + Swagger 注解
│   │   └── todos/
│   │       ├── todos.schema.js
│   │       ├── todos.repository.js
│   │       ├── todos.service.js
│   │       ├── todos.controller.js
│   │       └── todos.routes.js
│   ├── app.js                # 应用工厂（组装插件和路由）
│   └── server.js             # 服务入口（启动 + 优雅关闭）
├── data/                     # SQLite 数据库文件（自动创建，git 忽略）
├── .env.example              # 环境变量模板
├── .gitignore
└── package.json
```

---

## 架构分层说明

```
HTTP Request
     │
     ▼
┌─────────────┐
│   Routes    │  ← 路由定义、JSON Schema 注解、preHandler 钩子
└──────┬──────┘
       │ 调用
       ▼
┌─────────────┐
│ Controller  │  ← Zod 验证、解包 request、调用 Service、格式化 response
└──────┬──────┘
       │ 调用
       ▼
┌─────────────┐
│   Service   │  ← 业务规则、权限判断、事务协调（与框架完全解耦）
└──────┬──────┘
       │ 调用
       ▼
┌─────────────┐
│ Repository  │  ← 封装 SQL、预编译语句、数据归一化
└──────┬──────┘
       │
       ▼
  SQLite (WAL)
```

**双重验证策略：**
- **第一层：** Fastify JSON Schema — 在路由层快速拦截格式错误（自动生成 Swagger 文档）
- **第二层：** Zod safeParse — 在 Controller 层提供更丰富的业务语义错误信息

---

## 快速开始

### 1. 安装依赖

```bash
cd fastify-scaffold
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 根据需要修改 .env 中的配置，生产环境务必替换 JWT_SECRET
```

### 3. 初始化数据库（含测试数据）

```bash
npm run db:reset
```

输出示例：
```
✅ 创建测试用户 (ID: 1)
   邮箱: demo@example.com
   密码: Password123
✅ 插入 6 条待办事项
🎉 数据库重置完成！
```

### 4. 启动服务

```bash
# 开发模式（Node.js --watch 热重载，无需 nodemon）
npm run dev

# 生产模式
npm start
```

启动成功后：

| 地址 | 说明 |
|------|------|
| `http://localhost:3000/health` | 健康检查接口 |
| `http://localhost:3000/docs`   | Swagger UI 交互文档 |
| `http://localhost:3000/api/auth/login` | 登录接口 |

---

## API 接口一览

### 认证模块 `/api/auth`

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | `/register` | ❌ | 用户注册 |
| POST | `/login`    | ❌ | 用户登录，返回 JWT Token |
| GET  | `/me`       | ✅ | 获取当前用户信息 |

### 待办事项 `/api/todos`

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET    | `/`     | ✅ | 获取列表（分页 + 过滤） |
| GET    | `/:id`  | ✅ | 获取单条详情 |
| POST   | `/`     | ✅ | 创建待办事项 |
| PATCH  | `/:id`  | ✅ | 局部更新 |
| DELETE | `/:id`  | ✅ | 删除 |

#### 列表查询参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | integer | 1 | 页码 |
| `limit` | integer | 10 | 每页条数（最大 100） |
| `completed` | string | `all` | 过滤状态：`true` / `false` / `all` |
| `priority` | string | - | 过滤优先级：`low` / `medium` / `high` |
| `keyword` | string | - | 标题/描述关键词搜索 |

---

## 示例请求

### 注册

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### 登录并保存 Token

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Password123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Token: $TOKEN"
```

### 创建待办事项

```bash
curl -X POST http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "学习 Fastify 插件系统",
    "description": "深入理解 fastify-plugin 的封装机制",
    "priority": "high",
    "due_date": "2026-04-01"
  }'
```

### 分页查询（只看未完成 + 高优先级）

```bash
curl "http://localhost:3000/api/todos?completed=false&priority=high&page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Fastify 核心特性展示

### 1. 插件系统（Plugin System）

```js
// src/plugins/db.js
// fastify-plugin 使装饰器穿透封装作用域，全局可用
const fp = require('fastify-plugin')

async function dbPlugin(fastify) {
  const db = new Database(config.DB_PATH)
  fastify.decorate('db', db)          // 通过 fastify.db 全局访问
  fastify.addHook('onClose', () => db.close())  // 生命周期钩子
}

module.exports = fp(dbPlugin)
```

### 2. 路由 Schema（自动生成文档 + 性能序列化）

```js
fastify.post('/register', {
  schema: {
    tags: ['Auth'],
    body: registerBodySchema,       // 请求验证
    response: { 201: tokenResponseSchema }, // 响应序列化（比 JSON.stringify 快 2-3x）
  },
  handler: ctrl.register,
})
```

### 3. preHandler 钩子（路由级中间件）

```js
fastify.get('/me', {
  preHandler: [authenticate],   // 路由级 JWT 验证
  handler: ctrl.getMe,
})
```

### 4. 优雅关闭

```js
// server.js - 捕获系统信号，等待正在处理的请求完成
process.on('SIGTERM', async () => {
  await app.close()  // 触发所有 onClose 钩子
})
```

---

## 统一响应格式

**成功响应：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": { "token": "eyJ...", "user": { "id": 1, "username": "john" } },
  "timestamp": "2026-04-01T12:00:00.000Z"
}
```

**分页响应：**
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 },
  "timestamp": "..."
}
```

**错误响应：**
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "注册信息格式错误",
  "details": { "password": ["密码必须包含至少一个大写字母"] },
  "timestamp": "..."
}
```

---

## 扩展新业务模块

以"评论模块"为例，只需在 `src/modules/` 下创建：

```
comments/
├── comments.schema.js      # Zod + JSON Schema
├── comments.repository.js  # SQL 操作
├── comments.service.js     # 业务逻辑
├── comments.controller.js  # 请求处理
└── comments.routes.js      # 路由定义
```

然后在 `src/app.js` 中注册一行：

```js
app.register(require('./modules/comments/comments.routes'), { prefix: '/api/comments' })
```

完全遵循"开闭原则"，新增功能无需修改已有代码。
