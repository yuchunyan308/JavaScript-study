# 电商后台API系统 — 核心架构方案

---

## 一、技术选型决策

**框架：NestJS + TypeScript**
NestJS 的模块化设计天然契合电商系统的领域边界，依赖注入让单元测试更清晰，装饰器驱动的 Guard/Interceptor 机制与 RBAC 权限模型高度吻合。

**数据库：PostgreSQL + Prisma**
SKU 矩阵、订单、优惠券存在强关联关系，关系型数据库的事务保障和外键约束在订单创建、库存扣减等场景下优于 MongoDB。Prisma 提供类型安全的查询和优秀的迁移管理。

**缓存：Redis (ioredis)**
购物车、商品热点数据、限流计数器、分布式锁全部依赖 Redis。

---

## 二、项目目录结构

```
src/
├── common/                    # 全局公共层
│   ├── decorators/            # 自定义装饰器 (@CurrentUser, @Roles)
│   ├── filters/               # 全局异常过滤器
│   ├── guards/                # JWT Guard, RBAC Guard
│   ├── interceptors/          # 日志、响应格式化、缓存拦截器
│   └── pipes/                 # Zod 验证管道
│
├── modules/
│   ├── auth/                  # 认证模块
│   ├── user/                  # 用户模块
│   ├── product/               # 商品模块
│   ├── category/              # 分类模块
│   ├── sku/                   # SKU模块
│   ├── cart/                  # 购物车模块
│   ├── order/                 # 订单模块
│   └── payment/               # 支付模块
│
├── infrastructure/            # 基础设施层
│   ├── database/              # Prisma 客户端、事务封装
│   ├── redis/                 # Redis 连接、封装服务
│   ├── logger/                # Winston 配置
│   └── queue/                 # 任务队列（订单超时取消）
│
└── config/                    # 环境配置
```

---

## 三、数据库模型设计

### 3.1 用户与权限

```
User
├── id (UUID)
├── email (唯一索引)
├── passwordHash
├── role: ENUM('USER', 'ADMIN')
├── refreshTokenHash          # 存 hash 而非明文
├── isActive
└── timestamps

# 设计说明：
# RBAC 采用"扁平角色"方案（USER/ADMIN），
# 无需独立的 Role 表，扩展时可升级为 User-Role-Permission 三表模型。
```

### 3.2 商品与 SKU（核心难点）

```
Category（无限级分类 —— 闭包表方案）
├── id
├── name
├── parentId (自引用)
├── path (物化路径: "1/3/7")   # 用于快速查询整棵子树
└── level

Product（商品基础信息）
├── id
├── name, description
├── categoryId
├── basePrice                  # 展示用基准价
├── status: ENUM('DRAFT','ON_SALE','OFF_SALE')
├── images: String[]
└── timestamps

SpecKey（规格键，属于商品）
├── id
├── productId
└── name                       # 例："颜色"、"尺码"

SpecValue（规格值）
├── id
├── specKeyId
└── value                      # 例："红色"、"XL"

SKU（规格组合单元）
├── id
├── productId
├── skuCode (唯一)             # 例："PROD001-RED-XL"
├── price
├── stock
├── version (乐观锁)
└── specValues: SpecValue[]    # M2M 关联表 SKUSpecValue

# SKU矩阵示例：
# 颜色(红/蓝) × 尺码(S/M/L) = 6个SKU记录
```

**为什么不用 JSON 存规格？**
独立的 SpecKey/SpecValue/SKU 三表结构支持按规格筛选（"查所有红色商品"）、价格区间搜索，且库存字段可以加行锁，JSON 字段无法实现这些。

### 3.3 订单系统

```
Order
├── id
├── orderNo (唯一，雪花算法生成)
├── userId
├── status: ENUM(见状态机)
├── totalAmount
├── discountAmount
├── payableAmount
├── couponId (nullable)
├── shippingAddress: JSON
├── expiredAt                  # 支付超时时间（15分钟）
└── timestamps

OrderItem
├── id
├── orderId
├── skuId
├── productSnapshot: JSON      # 下单时商品快照（价格/名称）
├── quantity
└── unitPrice

Payment
├── id
├── orderId
├── amount
├── provider: ENUM('MOCK_PAY','ALIPAY',...)
├── status: ENUM('PENDING','SUCCESS','FAILED','REFUNDED')
├── thirdPartyTradeNo
└── callbackPayload: JSON      # 原始回调报文存档
```

---

## 四、核心业务逻辑设计

### 4.1 JWT 双令牌机制

```
登录流程：
  ① 校验账密 → 生成 Access Token (15min) + Refresh Token (7d)
  ② Refresh Token 做 bcrypt hash 后存入 User 表
  ③ 两个 Token 均返回客户端

刷新流程：
  ① 客户端携带 Refresh Token 请求 /auth/refresh
  ② 服务端验签 → 取出 userId → 查库比对 hash
  ③ 比对成功 → 旋转令牌（旧 RT 作废，签发新 AT + RT）
  ④ 旋转机制可检测令牌被盗：若旧 RT 再次使用，清空所有令牌强制重登

登出：
  清空数据库中的 refreshTokenHash
```

### 4.2 RBAC 守卫链

```
请求 → JwtAuthGuard（验签，注入 req.user）
     → RolesGuard（读取 @Roles() 装饰器，对比 req.user.role）
     → Controller Handler

使用示例（伪代码）：
  @Roles('ADMIN')
  @Post('/products')
  createProduct() { ... }        # 仅管理员可访问

  @Roles('USER', 'ADMIN')
  @Get('/products')
  listProducts() { ... }         # 所有登录用户可访问
```

### 4.3 购物车设计（Redis Hash 结构）

```
Key 结构：  cart:{userId}
Value 结构：Hash
  field = skuId
  value = JSON{ skuId, quantity, addedAt, priceSnapshot }

操作设计：
  添加商品   → HSET cart:{userId} {skuId} {payload}  + EXPIRE 7d
  修改数量   → HSET（覆盖写）或 HINCRBY（增量写）
  删除商品   → HDEL cart:{userId} {skuId}
  查购物车   → HGETALL cart:{userId} → 批量查 SKU 实时价格/库存
  结算清空   → DEL cart:{userId}（订单创建成功后）

关键决策：
  购物车中只存 priceSnapshot 用于展示，
  结算时必须重新查询数据库实时价格，防止价格篡改。
```

### 4.4 库存扣减（高并发核心）

**两阶段扣减策略：**

```
阶段一：加购/提交订单时（库存预占）
  使用 Lua 脚本在 Redis 中对 stock:{skuId} 做原子预扣减：
    IF redis.stock >= quantity THEN
      redis.stock -= quantity   # 预占库存
      RETURN 1
    ELSE
      RETURN 0 (库存不足)
    END

阶段二：订单支付成功后
  → 将 Redis 预占量同步写入 PostgreSQL（异步队列）
  → 同时释放 Redis 预占

订单超时取消时：
  → 归还 Redis 预占库存
  → 不需要操作 PG（因为 PG 库存未被真正扣减）

数据库兜底（每日对账）：
  Redis 库存 = PG 库存 - 所有"已支付且未发货"订单的占用量
  定时任务校验并修正偏差
```

**为何不直接用数据库乐观锁？**
PG 行锁在高并发下会造成大量等待和锁竞争，Redis 单线程 + Lua 脚本是原子操作，吞吐量高 2 个数量级，两者结合是电商标准方案。

### 4.5 订单状态机

```
                    ┌─────────────────────────────┐
                    │         订单状态流转          │
                    └─────────────────────────────┘

  [创建订单] ──→ PENDING_PAYMENT（待支付，15min 超时）
                     │
          支付成功回调 │         超时/主动取消
                     ↓               ↓
              PAID（已支付）    CANCELLED（已取消）
                     │
          管理员操作发货 │
                     ↓
              SHIPPED（已发货）
                     │
       用户确认 or 超时自动确认 │
                     ↓
              COMPLETED（已完成）
                     │
          申请退款（7天内）│
                     ↓
              REFUNDING（退款中）──→ REFUNDED（已退款）

状态流转规则（防止非法跳转）：
  合法转换表：
  PENDING_PAYMENT → [PAID, CANCELLED]
  PAID            → [SHIPPED, REFUNDING]
  SHIPPED         → [COMPLETED]
  COMPLETED       → [REFUNDING]
  REFUNDING       → [REFUNDED]
  CANCELLED/COMPLETED/REFUNDED → 终态，不可流转

实现：OrderStateMachine 服务，接收 (currentStatus, targetStatus)，
      查合法转换表，非法则抛 BusinessException。
```

### 4.6 支付回调安全验证

```
回调处理流程：
  ① 接收第三方 POST 回调
  ② 验证签名（HMAC-SHA256，密钥存配置中心）
  ③ 幂等校验：查 Payment 表，已处理则直接返回 SUCCESS
  ④ 数据库事务：
       - 更新 Payment 状态为 SUCCESS
       - 驱动订单状态机 PENDING_PAYMENT → PAID
       - 真正扣减 PG 库存（异步消息队列削峰）
  ⑤ 清除购物车对应商品
  ⑥ 返回 SUCCESS 给第三方（超时重试机制：第三方会多次回调）

关键：回调接口必须幂等，签名验证失败直接 400 不记录日志
     防止恶意探测系统行为。
```

---

## 五、API 接口规划

| 模块 | 方法 | 路径 | 权限 |
|------|------|------|------|
| 认证 | POST | /auth/register | 公开 |
| 认证 | POST | /auth/login | 公开 |
| 认证 | POST | /auth/refresh | 公开（RT） |
| 认证 | POST | /auth/logout | USER |
| 商品 | GET | /products | 公开 |
| 商品 | GET | /products/:id | 公开 |
| 商品 | POST | /products | ADMIN |
| 商品 | PATCH | /products/:id | ADMIN |
| 商品 | DELETE | /products/:id | ADMIN |
| 分类 | GET | /categories/tree | 公开 |
| 分类 | POST | /categories | ADMIN |
| 购物车 | GET | /cart | USER |
| 购物车 | POST | /cart/items | USER |
| 购物车 | PATCH | /cart/items/:skuId | USER |
| 购物车 | DELETE | /cart/items/:skuId | USER |
| 订单 | POST | /orders | USER |
| 订单 | GET | /orders | USER |
| 订单 | GET | /orders/:id | USER |
| 订单 | POST | /orders/:id/cancel | USER |
| 订单 | PATCH | /orders/:id/ship | ADMIN |
| 支付 | POST | /payments/mock/notify | 公开（签名验证） |
| 支付 | GET | /payments/:orderId | USER |

---

## 六、横切关注点设计

### 统一响应格式
```
成功：{ code: 0, data: {...}, message: "success", timestamp }
失败：{ code: 4001, data: null, message: "商品库存不足", timestamp }
```

### 全局异常分层
```
BusinessException  → HTTP 400 系（业务逻辑错误，有明确提示）
AuthException      → HTTP 401/403
NotFoundException  → HTTP 404
SystemException    → HTTP 500（触发告警，屏蔽内部细节）
```

### 限流策略
```
登录接口：同一 IP，5次/分钟（防暴力破解）
支付回调：白名单 IP 校验（第三方固定回调 IP）
普通接口：100次/分钟/用户
```

### 日志规范（Winston）
```
访问日志：method、path、statusCode、responseTime、userId
业务日志：orderId、操作类型、前状态、后状态（订单状态变更）
错误日志：完整堆栈 + 请求上下文（生产环境脱敏）
```

---

## 七、关键风险与应对方案

| 风险点 | 方案 |
|--------|------|
| 订单超时未取消导致库存永久占用 | Bull 队列延迟任务，创建订单时投递 15min 延迟消息 |
| 支付回调重复触发 | Payment 表幂等键 + 数据库唯一索引 |
| Redis 宕机购物车丢失 | Redis AOF 持久化 + 主从复制 |
| 超卖 | Redis Lua 脚本预扣减，PG 库存加 CHECK 约束（stock >= 0）双重兜底 |
| 价格篡改 | 结算时服务端重新计算价格，不信任客户端传入金额 |
| 商品快照失效 | OrderItem 存储下单时的完整商品快照 JSON |

---

## 八、开发阶段规划

```
Week 1：基础脚手架 + Auth 模块（注册/登录/JWT/RBAC）
Week 2：商品 + 分类 + SKU 模块（含 Swagger 文档）
Week 3：购物车（Redis）+ 库存预扣减（Lua 脚本）
Week 4：订单状态机 + 订单创建完整流程
Week 5：支付模拟回调 + 超时取消队列任务
Week 6：日志、限流、统一异常、集成测试
```

---

