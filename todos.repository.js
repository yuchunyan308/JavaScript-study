'use strict'

/**
 * 待办事项数据访问层（Repository）
 * 封装所有 SQL 操作，支持分页、过滤、关键词搜索
 */
class TodoRepository {
  constructor(db) {
    this.db = db

    // 预编译固定查询
    this._stmts = {
      findById: db.prepare(
        'SELECT * FROM todos WHERE id = ? AND user_id = ?'
      ),
      create: db.prepare(`
        INSERT INTO todos (user_id, title, description, priority, due_date)
        VALUES (@user_id, @title, @description, @priority, @due_date)
      `),
      update: db.prepare(`
        UPDATE todos
        SET title = @title,
            description = @description,
            completed = @completed,
            priority = @priority,
            due_date = @due_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id AND user_id = @user_id
      `),
      delete: db.prepare(
        'DELETE FROM todos WHERE id = ? AND user_id = ?'
      ),
      countByUser: db.prepare(
        'SELECT COUNT(*) as total FROM todos WHERE user_id = ?'
      ),
    }
  }

  /**
   * 根据 ID 和用户 ID 查询（确保只能访问自己的数据）
   */
  findByIdAndUser(id, userId) {
    const row = this._stmts.findById.get(id, userId)
    return row ? this._normalize(row) : null
  }

  /**
   * 分页查询用户的待办事项，支持多维过滤
   * @param {number} userId
   * @param {{ page, limit, completed, priority, keyword }} options
   * @returns {{ items: Array, total: number }}
   */
  findByUser(userId, { page = 1, limit = 10, completed = 'all', priority, keyword } = {}) {
    // 动态构建 WHERE 子句（避免 SQL 注入：使用参数化查询）
    const conditions = ['user_id = ?']
    const params = [userId]

    if (completed !== 'all') {
      conditions.push('completed = ?')
      params.push(completed === 'true' ? 1 : 0)
    }

    if (priority) {
      conditions.push('priority = ?')
      params.push(priority)
    }

    if (keyword) {
      conditions.push('(title LIKE ? OR description LIKE ?)')
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    const whereClause = conditions.join(' AND ')
    const offset = (page - 1) * limit

    // 查询总数
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM todos WHERE ${whereClause}`)
    const { total } = countStmt.get(...params)

    // 查询数据
    const listStmt = this.db.prepare(`
      SELECT * FROM todos
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    const items = listStmt.all(...params, limit, offset).map(this._normalize)

    return { items, total }
  }

  /**
   * 创建待办事项
   */
  create(data) {
    const result = this._stmts.create.run(data)
    return this.findByIdAndUser(result.lastInsertRowid, data.user_id)
  }

  /**
   * 更新待办事项
   * @returns {object|null} 更新后的记录
   */
  update(id, userId, data) {
    const existing = this.findByIdAndUser(id, userId)
    if (!existing) return null

    // 合并现有数据（局部更新）
    const merged = {
      id,
      user_id: userId,
      title:       data.title       ?? existing.title,
      description: data.description ?? existing.description,
      completed:   data.completed !== undefined ? (data.completed ? 1 : 0) : (existing.completed ? 1 : 0),
      priority:    data.priority    ?? existing.priority,
      due_date:    data.due_date    ?? existing.due_date,
    }

    this._stmts.update.run(merged)
    return this.findByIdAndUser(id, userId)
  }

  /**
   * 删除待办事项
   * @returns {boolean} 是否删除成功
   */
  delete(id, userId) {
    const result = this._stmts.delete.run(id, userId)
    return result.changes > 0
  }

  /** SQLite 布尔值归一化（0/1 → false/true） */
  _normalize(row) {
    return { ...row, completed: row.completed === 1 }
  }
}

module.exports = { TodoRepository }
