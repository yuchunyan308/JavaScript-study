'use strict'

/**
 * 数据库重置脚本（仅开发环境使用）
 * 运行：node scripts/reset-db.js
 */
require('dotenv').config()

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const DB_PATH = process.env.DB_PATH || './data/app.db'

console.log('🗑️  正在重置数据库...')

// 删除旧数据库文件
const dbFile = path.resolve(DB_PATH)
const dbDir  = path.dirname(dbFile)

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)

const db = new Database(dbFile)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
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

  CREATE INDEX IF NOT EXISTS idx_todos_user_id  ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
`)

// 插入种子数据
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10)
const passwordHash = bcrypt.hashSync('Password123', BCRYPT_ROUNDS)

const insertUser = db.prepare(`
  INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)
`)

const insertTodo = db.prepare(`
  INSERT INTO todos (user_id, title, description, priority, due_date, completed)
  VALUES (?, ?, ?, ?, ?, ?)
`)

// 使用事务批量插入（大幅提升性能）
const seed = db.transaction(() => {
  const { lastInsertRowid: userId } = insertUser.run('demo_user', 'demo@example.com', passwordHash)
  console.log(`✅ 创建测试用户 (ID: ${userId})`)
  console.log('   邮箱: demo@example.com')
  console.log('   密码: Password123')

  const todos = [
    [userId, '完成项目需求文档',   '梳理所有功能点并与产品确认',   'high',   '2026-04-01', 0],
    [userId, '搭建 CI/CD 流水线', 'GitHub Actions + Docker',     'high',   '2026-04-05', 0],
    [userId, '编写单元测试',       '覆盖率目标 80%',              'medium', '2026-04-10', 0],
    [userId, '代码 Review',       null,                           'medium', null,         1],
    [userId, '更新 README',       '添加部署说明和 API 文档链接',  'low',    '2026-04-15', 0],
    [userId, '性能压测',          '使用 autocannon 进行基准测试', 'low',    null,         0],
  ]

  todos.forEach(t => insertTodo.run(...t))
  console.log(`✅ 插入 ${todos.length} 条待办事项`)
})

seed()

db.close()
console.log('\n🎉 数据库重置完成！')
console.log(`   数据库位置: ${dbFile}\n`)
