'use strict'

const { AuthController } = require('./auth.controller')
const { authenticate } = require('../../common/authenticate')
const {
  registerBodySchema,
  loginBodySchema,
  tokenResponseSchema,
  userResponseSchema,
} = require('./auth.schema')

/**
 * 认证路由模块
 * 使用 Fastify 插件系统注册，支持路由前缀和封装
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function authRoutes(fastify) {
  const ctrl = new AuthController(fastify.db, fastify.jwt)

  // POST /api/auth/register
  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: '用户注册',
      description: '创建新用户账号，返回 JWT Token',
      body: registerBodySchema,
      response: { 201: tokenResponseSchema },
    },
    handler: ctrl.register,
  })

  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: '用户登录',
      description: '使用邮箱和密码登录，返回 JWT Token',
      body: loginBodySchema,
      response: { 200: tokenResponseSchema },
    },
    handler: ctrl.login,
  })

  // GET /api/auth/me （受保护路由）
  fastify.get('/me', {
    schema: {
      tags: ['Users'],
      summary: '获取当前用户信息',
      description: '返回当前登录用户的详细信息（需要认证）',
      security: [{ bearerAuth: [] }],
      response: { 200: userResponseSchema },
    },
    preHandler: [authenticate],
    handler: ctrl.getMe,
  })
}

module.exports = authRoutes
