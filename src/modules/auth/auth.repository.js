'use strict'

/**
 * 用户数据访问层（Repository）
 * 职责：封装所有 SQL 操作，不包含任何业务逻辑
 * 依赖：通过参数传入 db 实例（便于测试时 mock）
 */
class UserRepository {
  constructor(db) {
    this.db = db

    // 预编译 SQL 语句，提升性能（better-sqlite3 特性）
    this._stmts = {
      findById:       db.prepare('SELECT * FROM users WHERE id = ?'),
      findByEmail:    db.prepare('SELECT * FROM users WHERE email = ?'),
      findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
      create:         db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (@username, @email, @password_hash)
      `),
    }
  }

  /**
   * 根据 ID 查找用户
   * @returns {object|undefined}
   */
  findById(id) {
    return this._stmts.findById.get(id)
  }

  /**
   * 根据邮箱查找用户
   * @returns {object|undefined}
   */
  findByEmail(email) {
    return this._stmts.findByEmail.get(email)
  }

  /**
   * 根据用户名查找用户
   * @returns {object|undefined}
   */
  findByUsername(username) {
    return this._stmts.findByUsername.get(username)
  }

  /**
   * 创建新用户
   * @param {{ username: string, email: string, password_hash: string }} data
   * @returns {object} 新创建的用户
   */
  create(data) {
    const result = this._stmts.create.run(data)
    return this.findById(result.lastInsertRowid)
  }
}

module.exports = { UserRepository }
