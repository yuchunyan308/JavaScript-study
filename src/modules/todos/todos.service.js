'use strict'

const { TodoRepository } = require('./todos.repository')
const { NotFoundError, ForbiddenError } = require('../../common/errors')

/**
 * 待办事项服务层（Service）
 * 职责：业务规则执行、权限校验、数据协调
 */
class TodoService {
  constructor(db) {
    this.todoRepo = new TodoRepository(db)
  }

  /**
   * 获取用户的待办列表（分页）
   */
  list(userId, query) {
    const { page, limit, completed, priority, keyword } = query
    const { items, total } = this.todoRepo.findByUser(userId, {
      page,
      limit,
      completed,
      priority,
      keyword,
    })
    return { items, pagination: { page, limit, total } }
  }

  /**
   * 获取单个待办详情
   */
  getById(id, userId) {
    const todo = this.todoRepo.findByIdAndUser(id, userId)
    if (!todo) throw new NotFoundError('待办事项')
    return todo
  }

  /**
   * 创建新待办
   */
  create(userId, data) {
    return this.todoRepo.create({
      user_id:     userId,
      title:       data.title,
      description: data.description ?? null,
      priority:    data.priority ?? 'medium',
      due_date:    data.due_date ?? null,
    })
  }

  /**
   * 更新待办（局部更新 PATCH 语义）
   */
  update(id, userId, data) {
    // findByIdAndUser 确保权限（只能操作自己的数据）
    const existing = this.todoRepo.findByIdAndUser(id, userId)
    if (!existing) throw new NotFoundError('待办事项')

    return this.todoRepo.update(id, userId, data)
  }

  /**
   * 删除待办
   */
  delete(id, userId) {
    const existing = this.todoRepo.findByIdAndUser(id, userId)
    if (!existing) throw new NotFoundError('待办事项')

    this.todoRepo.delete(id, userId)
    return { deleted: true }
  }
}

module.exports = { TodoService }
