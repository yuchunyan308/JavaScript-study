'use strict'

/**
 * 统一 API 响应格式工具函数
 * 确保所有接口返回一致的 JSON 结构
 */

/**
 * 成功响应
 * @param {object} reply - Fastify reply 对象
 * @param {any} data - 响应数据
 * @param {string} [message] - 可选消息
 * @param {number} [statusCode=200] - HTTP 状态码
 */
const sendSuccess = (reply, data, message = 'success', statusCode = 200) => {
  return reply.code(statusCode).send({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 分页列表响应
 * @param {object} reply - Fastify reply 对象
 * @param {Array} items - 数据列表
 * @param {object} pagination - 分页元数据
 */
const sendPaginated = (reply, items, pagination) => {
  return reply.code(200).send({
    success: true,
    message: 'success',
    data: items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * 创建成功响应 (201)
 */
const sendCreated = (reply, data, message = '创建成功') => {
  return sendSuccess(reply, data, message, 201)
}

module.exports = { sendSuccess, sendPaginated, sendCreated }
