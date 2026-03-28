'use strict'

const bcrypt = require('bcryptjs')
const { UserRepository } = require('./auth.repository')
const { ConflictError, UnauthorizedError, NotFoundError } = require('../../common/errors')
const config = require('../../config')

/**
 * 用户认证服务层（Service）
 * 职责：封装业务逻辑，协调 Repository 和外部依赖（bcrypt、jwt）
 * 不直接操作 HTTP 请求/响应，保持与框架解耦
 */
class AuthService {
  /**
   * @param {import('better-sqlite3').Database} db
   * @param {object} jwtInstance - Fastify JWT 实例
   */
  constructor(db, jwtInstance) {
    this.userRepo = new UserRepository(db)
    this.jwt = jwtInstance
  }

  /**
   * 用户注册
   * @param {{ username: string, email: string, password: string }} data
   * @returns {{ token: string, user: object }}
   */
  async register(data) {
    const { username, email, password } = data

    // 检查邮箱唯一性
    if (this.userRepo.findByEmail(email)) {
      throw new ConflictError(`邮箱 ${email} 已被注册`)
    }

    // 检查用户名唯一性
    if (this.userRepo.findByUsername(username)) {
      throw new ConflictError(`用户名 ${username} 已被占用`)
    }

    // 密码哈希（bcrypt 自动生成 salt）
    const password_hash = await bcrypt.hash(password, config.BCRYPT_ROUNDS)

    // 持久化用户
    const user = this.userRepo.create({ username, email, password_hash })

    // 生成 JWT
    const token = this._signToken(user)

    return { token, user: this._sanitizeUser(user) }
  }

  /**
   * 用户登录
   * @param {{ email: string, password: string }} data
   * @returns {{ token: string, user: object }}
   */
  async login(data) {
    const { email, password } = data

    const user = this.userRepo.findByEmail(email)

    // 统一错误信息，防止用户枚举攻击
    const AUTH_ERR = '邮箱或密码错误'

    if (!user) throw new UnauthorizedError(AUTH_ERR)

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) throw new UnauthorizedError(AUTH_ERR)

    const token = this._signToken(user)

    return { token, user: this._sanitizeUser(user) }
  }

  /**
   * 获取当前用户信息
   * @param {number} userId
   * @returns {object}
   */
  getProfile(userId) {
    const user = this.userRepo.findById(userId)
    if (!user) throw new NotFoundError('用户')
    return this._sanitizeUser(user)
  }

  // ─── 私有方法 ─────────────────────────────────────────────────

  /** 生成 JWT，payload 中只存放最小必要信息 */
  _signToken(user) {
    return this.jwt.sign(
      { sub: user.id, username: user.username },
      { expiresIn: config.JWT_EXPIRES_IN }
    )
  }

  /** 移除敏感字段后返回用户对象 */
  _sanitizeUser(user) {
    const { password_hash, ...safeUser } = user
    return safeUser
  }
}

module.exports = { AuthService }
