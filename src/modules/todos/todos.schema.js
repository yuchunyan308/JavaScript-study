'use strict'

const { z } = require('zod')
const { zodToJsonSchema } = require('zod-to-json-schema')

// ─── Zod 验证 Schema ──────────────────────────────────────────────

const PriorityEnum = z.enum(['low', 'medium', 'high'])

const CreateTodoSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(200, '标题最多 200 个字符')
    .trim(),
  description: z
    .string()
    .max(2000, '描述最多 2000 个字符')
    .optional()
    .nullable(),
  priority: PriorityEnum.default('medium'),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
    .optional()
    .nullable(),
})

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional().nullable(),
  priority: PriorityEnum.optional(),
  completed: z.boolean().optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
})

const QueryTodoSchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(10),
  completed: z.enum(['true', 'false', 'all']).default('all'),
  priority:  PriorityEnum.optional(),
  keyword:   z.string().max(100).optional(),
})

// ─── JSON Schema（供 Fastify 路由 + Swagger 使用）────────────────

const createTodoBodySchema = zodToJsonSchema(CreateTodoSchema, { target: 'openApi3' })
const updateTodoBodySchema = zodToJsonSchema(UpdateTodoSchema, { target: 'openApi3' })

const todoItemSchema = {
  type: 'object',
  properties: {
    id:          { type: 'integer' },
    user_id:     { type: 'integer' },
    title:       { type: 'string' },
    description: { type: 'string', nullable: true },
    completed:   { type: 'boolean' },
    priority:    { type: 'string', enum: ['low', 'medium', 'high'] },
    due_date:    { type: 'string', nullable: true },
    created_at:  { type: 'string' },
    updated_at:  { type: 'string' },
  },
}

const todoListResponseSchema = {
  type: 'object',
  properties: {
    success:    { type: 'boolean' },
    data:       { type: 'array', items: todoItemSchema },
    pagination: {
      type: 'object',
      properties: {
        page:       { type: 'integer' },
        limit:      { type: 'integer' },
        total:      { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  },
}

const todoResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data:    todoItemSchema,
  },
}

const paramsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', description: 'Todo ID' } },
}

const querySchema = {
  type: 'object',
  properties: {
    page:      { type: 'integer', minimum: 1, default: 1 },
    limit:     { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    completed: { type: 'string', enum: ['true', 'false', 'all'], default: 'all' },
    priority:  { type: 'string', enum: ['low', 'medium', 'high'] },
    keyword:   { type: 'string' },
  },
}

module.exports = {
  // Zod schemas
  CreateTodoSchema,
  UpdateTodoSchema,
  QueryTodoSchema,
  // JSON Schema
  createTodoBodySchema,
  updateTodoBodySchema,
  todoListResponseSchema,
  todoResponseSchema,
  paramsSchema,
  querySchema,
}
