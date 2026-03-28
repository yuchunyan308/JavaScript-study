'use strict'

const fastify = require('fastify')
const config = require('./config')
const { AppError } = require('./common/errors')

/**
 * Fastify 应用工厂函数
 * 职责：组装所有插件和路由，返回可测试的 Fastify 实例
 *
 * @returns {import('fastify').FastifyInstance}
 */
function buildApp() {
  const app = fastify({
    // 内置 Pino 高性能日志
    logger: {
      level: config.IS_DEV ? 'info' : 'warn',
      transport: config.IS_DEV
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    },
    // 信任反向代理（Nginx 等）的 X-Forwarded-* 头
    trustProxy: true,
    // 更友好的错误提示（仅开发环境）
    ajv: {
      customOptions: { allErrors: config.IS_DEV },
    },
  })

  // ─── 注册插件 ─────────────────────────────────────────────────

  // Swagger 文档（必须在路由注册之前）
  app.register(require('./plugins/swagger'))

  // 数据库连接
  app.register(require('./plugins/db'))

  // JWT 认证（@fastify/jwt 将 jwt 挂载到 fastify 和 request 上）
  app.register(require('@fastify/jwt'), {
    secret: config.JWT_SECRET,
    sign: { algorithm: 'HS256' },
  })

  // CORS 跨域处理
  app.register(require('@fastify/cors'), {
    origin: config.IS_DEV ? true : process.env.CORS_ORIGIN?.split(',') || false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // @fastify/sensible：提供 httpErrors、reply.notFound() 等便利方法
  app.register(require('@fastify/sensible'))

  // ─── 注册路由 ─────────────────────────────────────────────────

  // 健康检查（无需认证）
  app.get('/health', {
    schema: {
      tags: ['System'],
      summary: '健康检查',
      response: {
        200: {
          type: 'object',
          properties: {
            status:    { type: 'string' },
            timestamp: { type: 'string' },
            uptime:    { type: 'number' },
          },
        },
      },
    },
  }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  }))

  // 业务路由（统一 /api 前缀）
  app.register(require('./modules/auth/auth.routes'),   { prefix: '/api/auth' })
  app.register(require('./modules/todos/todos.routes'),  { prefix: '/api/todos' })

  // ─── 全局错误处理器 ───────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const { method, url } = request

    // 自定义业务错误（AppError 子类）
    if (error instanceof AppError) {
      request.log.warn({ err: error, method, url }, `业务错误: ${error.message}`)
      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
        timestamp: new Date().toISOString(),
      })
    }

    // Fastify 验证错误（JSON Schema 层）
    if (error.validation) {
      return reply.code(400).send({
        success: false,
        code: 'SCHEMA_VALIDATION_ERROR',
        message: '请求数据格式不正确',
        details: error.validation,
        timestamp: new Date().toISOString(),
      })
    }

    // JWT 错误
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
        error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      return reply.code(401).send({
        success: false,
        code: 'UNAUTHORIZED',
        message: '请先登录或 Token 已过期',
        timestamp: new Date().toISOString(),
      })
    }

    // 未预期的服务器错误（不暴露内部细节）
    request.log.error({ err: error, method, url }, '未预期的服务器错误')
    return reply.code(500).send({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: config.IS_DEV ? error.message : '服务器内部错误，请稍后重试',
      timestamp: new Date().toISOString(),
    })
  })

  // 404 处理
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      code: 'ROUTE_NOT_FOUND',
      message: `路由 ${request.method} ${request.url} 不存在`,
      timestamp: new Date().toISOString(),
    })
  })

  return app
}

module.exports = buildApp()
