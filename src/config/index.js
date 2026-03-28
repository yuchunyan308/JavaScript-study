'use strict'

/**
 * 全局配置模块
 * 统一从环境变量读取，提供类型安全的配置对象
 */
const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  IS_DEV: (process.env.NODE_ENV || 'development') === 'development',

  DB_PATH: process.env.DB_PATH || './data/app.db',

  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
}

if (config.NODE_ENV === 'production' && config.JWT_SECRET === 'change-this-secret') {
  throw new Error('❌ 生产环境必须设置强 JWT_SECRET 环境变量！')
}

module.exports = config
