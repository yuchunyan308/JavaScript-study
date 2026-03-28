'use strict'

const fp = require('fastify-plugin')

/**
 * Swagger / OpenAPI 3.0 文档插件
 * 访问地址：http://localhost:3000/docs
 */
async function swaggerPlugin(fastify) {
  await fastify.register(require('@fastify/swagger'), {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Fastify 企业级脚手架 API',
        description: `
## 接口文档

本文档由 @fastify/swagger 自动生成。

### 认证方式
受保护的接口需要在请求头中携带 JWT Token：
\`\`\`
Authorization: Bearer <your_token>
\`\`\`

### 获取 Token
1. 调用 \`POST /api/auth/register\` 注册账号
2. 调用 \`POST /api/auth/login\` 登录，获取 token
3. 将 token 填入右上角 **Authorize** 按钮
        `,
        version: '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@example.com',
        },
      },
      servers: [
        { url: 'http://localhost:3000', description: '本地开发环境' },
      ],
      tags: [
        { name: 'Auth',  description: '用户认证相关接口（注册/登录）' },
        { name: 'Users', description: '当前用户信息接口' },
        { name: 'Todos', description: '待办事项 CRUD 接口（需认证）' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: '请填入登录接口返回的 token',
          },
        },
      },
    },
  })

  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true, // 刷新页面后保持认证状态
    },
    staticCSP: true,
  })
}

module.exports = fp(swaggerPlugin, { name: 'swagger-plugin' })
