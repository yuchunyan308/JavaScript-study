'use strict'

/**
 * 自定义业务错误类
 * 统一错误语义，与 HTTP 状态码解耦
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    Error.captureStackTrace(this, this.constructor)
  }
}

/** 400 - 请求参数错误 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR')
    this.details = details
  }
}

/** 401 - 未认证 */
class UnauthorizedError extends AppError {
  constructor(message = '请先登录') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

/** 403 - 无权限 */
class ForbiddenError extends AppError {
  constructor(message = '无权访问此资源') {
    super(message, 403, 'FORBIDDEN')
  }
}

/** 404 - 资源不存在 */
class NotFoundError extends AppError {
  constructor(resource = '资源') {
    super(`${resource}不存在`, 404, 'NOT_FOUND')
  }
}

/** 409 - 资源冲突 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT')
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
}
