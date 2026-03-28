'use strict'

const { UnauthorizedError } = require('../errors')

/**
 * 路由级认证钩子
 * 在需要保护的路由上通过 preHandler 调用
 *
 * 用法：
 *   fastify.get('/protected', { preHandler: [authenticate] }, handler)
 */
async function authenticate(request, reply) {
  try {
    // @fastify/jwt 提供的验证方法，会自动从 Authorization: Bearer <token> 中提取
    await request.jwtVerify()
  } catch (err) {
    throw new UnauthorizedError('Token 无效或已过期，请重新登录')
  }
}

module.exports = { authenticate }
