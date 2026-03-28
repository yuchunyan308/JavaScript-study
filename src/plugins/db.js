'use strict'

const fp = require('fastify-plugin')
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const config = require('../config')

/**
 * 数据库插件
 * 使用 fastify-plugin 包装，使装饰器在所有作用域可用（不受 Fastify 封装限制）
 * 通过 fastify.db 访问 SQLite 实例
 */
async function dbPlugin(fastify) {
  // 确保数据目录存在
  const dbDir = path.resolve(path.dirname(config.DB_PATH))
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const db = new Database(path.resolve(config.DB_PATH))

  // 性能优化：WAL 模式允许读写并发，大幅提升性能
  db.pragma('journal_mode = WAL')
  // 启用外键约束
  db.pragma('foreign_keys = ON')

  // ─── 数据库迁移 / 初始化表结构 ────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL UNIQUE,
      email        TEXT    NOT NULL UNIQUE,
      password_hash TEXT   NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS todos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      description TEXT,
      completed   INTEGER NOT NULL DEFAULT 0,
      priority    TEXT    NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      due_date    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
  `)

  // 将 db 实例挂载到 fastify 实例上，全局可用
  fastify.decorate('db', db)

  // 服务关闭时优雅关闭数据库连接
  fastify.addHook('onClose', (instance, done) => {
    fastify.log.info('关闭数据库连接...')
    db.close()
    done()
  })

  fastify.log.info(`✅ 数据库连接成功: ${config.DB_PATH}`)
}

module.exports = fp(dbPlugin, {
  name: 'db-plugin',
  fastify: '4.x',
})
