'use strict'

const { TodoController } = require('./todos.controller')
const { authenticate } = require('../../common/authenticate')
const {
  createTodoBodySchema,
  updateTodoBodySchema,
  todoListResponseSchema,
  todoResponseSchema,
  paramsSchema,
  querySchema,
} = require('./todos.schema')

// 所有 Todo 接口都需要 JWT 认证
const AUTH = { preHandler: [authenticate], schema: { security: [{ bearerAuth: [] }] } }

/**
 * 待办事项路由模块
 * RESTful 风格，所有路由均需认证
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function todosRoutes(fastify) {
  const ctrl = new TodoController(fastify.db)

  // GET /api/todos - 获取列表（支持分页和过滤）
  fastify.get('/', {
    ...AUTH,
    schema: {
      ...AUTH.schema,
      tags: ['Todos'],
      summary: '获取待办事项列表',
      description: '支持分页、状态过滤、优先级过滤和关键词搜索',
      querystring: querySchema,
      response: { 200: todoListResponseSchema },
    },
    handler: ctrl.list,
  })

  // GET /api/todos/:id - 获取单条
  fastify.get('/:id', {
    ...AUTH,
    schema: {
      ...AUTH.schema,
      tags: ['Todos'],
      summary: '获取待办事项详情',
      params: paramsSchema,
      response: { 200: todoResponseSchema },
    },
    handler: ctrl.getById,
  })

  // POST /api/todos - 创建
  fastify.post('/', {
    ...AUTH,
    schema: {
      ...AUTH.schema,
      tags: ['Todos'],
      summary: '创建待办事项',
      body: createTodoBodySchema,
      response: { 201: todoResponseSchema },
    },
    handler: ctrl.create,
  })

  // PATCH /api/todos/:id - 局部更新
  fastify.patch('/:id', {
    ...AUTH,
    schema: {
      ...AUTH.schema,
      tags: ['Todos'],
      summary: '更新待办事项',
      description: '支持局部更新（PATCH），只需传入需要修改的字段',
      params: paramsSchema,
      body: updateTodoBodySchema,
      response: { 200: todoResponseSchema },
    },
    handler: ctrl.update,
  })

  // DELETE /api/todos/:id - 删除
  fastify.delete('/:id', {
    ...AUTH,
    schema: {
      ...AUTH.schema,
      tags: ['Todos'],
      summary: '删除待办事项',
      params: paramsSchema,
    },
    handler: ctrl.delete,
  })
}

module.exports = todosRoutes
