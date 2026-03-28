'use strict'

// 必须在所有 require 之前加载环境变量
require('dotenv').config()

const app = require('./app')
const config = require('./config')

const start = async () => {
  try {
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0', // 允许外部访问（Docker/云环境必须）
    })

    // Fastify 内置 Pino 日志，以下用 console 展示启动信息
    console.log('')
    console.log('┌─────────────────────────────────────────────┐')
    console.log('│         🚀 Fastify 企业级脚手架启动          │')
    console.log('├─────────────────────────────────────────────┤')
    console.log(`│  Server  : http://localhost:${config.PORT}           │`)
    console.log(`│  API Docs: http://localhost:${config.PORT}/docs       │`)
    console.log(`│  Health  : http://localhost:${config.PORT}/health     │`)
    console.log(`│  Env     : ${config.NODE_ENV.padEnd(34)} │`)
    console.log('└─────────────────────────────────────────────┘')
    console.log('')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// 优雅关闭（处理 SIGTERM/SIGINT 信号）
const gracefulShutdown = async (signal) => {
  console.log(`\n收到 ${signal} 信号，正在优雅关闭服务...`)
  try {
    await app.close()
    console.log('✅ 服务已安全关闭')
    process.exit(0)
  } catch (err) {
    console.error('关闭失败:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT',  () => gracefulShutdown('SIGINT'))

start()
