import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { FieldError, ProblemException } from '../exceptions/problem.exception';

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  const result: FieldError[] = [];
  for (const err of errors) {
    const field = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints) {
      for (const message of Object.values(err.constraints)) {
        result.push({ field, message });
      }
    }
    if (err.children && err.children.length > 0) {
      result.push(...flattenValidationErrors(err.children, field));
    }
  }
  return result;
}

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    exceptionFactory: (validationErrors: ValidationError[]) => {
      const fieldErrors = flattenValidationErrors(validationErrors);
      return new ProblemException({
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        title: 'Bad Request',
        detail: 'Uno o más campos de la solicitud no son válidos.',
        errors: fieldErrors,
      });
    },
  });
}
