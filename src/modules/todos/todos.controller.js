'use strict'

const { TodoService } = require('./todos.service')
const { CreateTodoSchema, UpdateTodoSchema, QueryTodoSchema } = require('./todos.schema')
const { sendSuccess, sendPaginated, sendCreated } = require('../../common/response')
const { ValidationError } = require('../../common/errors')

/**
 * 待办事项控制器
 * 所有路由都需要认证，从 request.user.sub 获取当前用户 ID
 */
class TodoController {
  constructor(db) {
    this.service = new TodoService(db)
  }

  list = async (request, reply) => {
    const queryResult = QueryTodoSchema.safeParse(request.query)
    if (!queryResult.success) {
      throw new ValidationError('查询参数错误', queryResult.error.flatten().fieldErrors)
    }

    const userId = request.user.sub
    const { items, pagination } = this.service.list(userId, queryResult.data)

    return sendPaginated(reply, items, pagination)
  }

  getById = async (request, reply) => {
    const userId = request.user.sub
    const id = parseInt(request.params.id, 10)

    const todo = this.service.getById(id, userId)

    return sendSuccess(reply, todo)
  }

  create = async (request, reply) => {
    const result = CreateTodoSchema.safeParse(request.body)
    if (!result.success) {
      throw new ValidationError('待办事项数据格式错误', result.error.flatten().fieldErrors)
    }

    const userId = request.user.sub
    const todo = this.service.create(userId, result.data)

    return sendCreated(reply, todo, '待办事项创建成功')
  }

  update = async (request, reply) => {
    const result = UpdateTodoSchema.safeParse(request.body)
    if (!result.success) {
      throw new ValidationError('更新数据格式错误', result.error.flatten().fieldErrors)
    }

    const userId = request.user.sub
    const id = parseInt(request.params.id, 10)

    const todo = this.service.update(id, userId, result.data)

    return sendSuccess(reply, todo, '更新成功')
  }

  delete = async (request, reply) => {
    const userId = request.user.sub
    const id = parseInt(request.params.id, 10)

    const result = this.service.delete(id, userId)

    return sendSuccess(reply, result, '删除成功')
  }
}

module.exports = { TodoController }
