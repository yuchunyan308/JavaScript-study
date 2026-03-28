'use strict'

const { z } = require('zod')
const { zodToJsonSchema } = require('zod-to-json-schema')

// ─── Zod 验证 Schema（业务逻辑层使用）─────────────────────────────
const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, '用户名至少 3 个字符')
    .max(30, '用户名最多 30 个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z
    .string()
    .min(8, '密码至少 8 个字符')
    .max(100, '密码过长')
    .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
    .regex(/[0-9]/, '密码必须包含至少一个数字'),
})

const LoginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '密码不能为空'),
})

// ─── 转换为 JSON Schema（Fastify 路由 + Swagger 文档使用）─────────
const registerBodySchema = {
  ...zodToJsonSchema(RegisterSchema, { target: 'openApi3' }),
  examples: [
    {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'Password123',
    },
  ],
}

const loginBodySchema = {
  ...zodToJsonSchema(LoginSchema, { target: 'openApi3' }),
  examples: [
    {
      email: 'john@example.com',
      password: 'Password123',
    },
  ],
}

// ─── 公共响应 Schema ──────────────────────────────────────────────
const tokenResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT Bearer Token' },
        user: {
          type: 'object',
          properties: {
            id:       { type: 'integer' },
            username: { type: 'string' },
            email:    { type: 'string' },
          },
        },
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
}

const userResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id:         { type: 'integer' },
        username:   { type: 'string' },
        email:      { type: 'string' },
        created_at: { type: 'string' },
      },
    },
  },
}

module.exports = {
  // Zod schemas（用于运行时验证）
  RegisterSchema,
  LoginSchema,
  // JSON Schema（用于 Fastify 路由定义 + Swagger）
  registerBodySchema,
  loginBodySchema,
  tokenResponseSchema,
  userResponseSchema,
}
