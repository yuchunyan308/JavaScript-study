'use strict'

const { AuthService } = require('./auth.service')
const { RegisterSchema, LoginSchema } = require('./auth.schema')
const { sendSuccess, sendCreated } = require('../../common/response')
const { ValidationError } = require('../../common/errors')

/**
 * 认证控制器（Controller）
 * 职责：处理 HTTP 请求/响应，调用 Service，不包含业务逻辑
 * - 使用 Zod 进行运行时输入验证（双重保险，Fastify JSON Schema 是第一道关卡）
 * - 转换 Service 返回值为标准 HTTP 响应
 */
class AuthController {
  constructor(db, jwt) {
    this.service = new AuthService(db, jwt)
  }

  register = async (request, reply) => {
    // Zod 运行时验证（提供更友好的错误信息）
    const result = RegisterSchema.safeParse(request.body)
    if (!result.success) {
      throw new ValidationError('注册信息格式错误', result.error.flatten().fieldErrors)
    }

    const { token, user } = await this.service.register(result.data)

    return sendCreated(reply, { token, user }, '注册成功')
  }

  login = async (request, reply) => {
    const result = LoginSchema.safeParse(request.body)
    if (!result.success) {
      throw new ValidationError('登录信息格式错误', result.error.flatten().fieldErrors)
    }

    const { token, user } = await this.service.login(result.data)

    return sendSuccess(reply, { token, user }, '登录成功')
  }

  getMe = async (request, reply) => {
    // request.user 由 @fastify/jwt 的 jwtVerify() 注入
    const userId = request.user.sub

    const user = this.service.getProfile(userId)

    return sendSuccess(reply, user)
  }
}

module.exports = { AuthController }
