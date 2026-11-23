import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  OvenbirdAuthError,
  OvenbirdError,
  OvenbirdNotFoundError,
  OvenbirdRateLimitError,
  OvenbirdValidationError,
} from '@ovenbird/node';
import { Response } from 'express';
import { ProblemDetails, ProblemException } from '../exceptions/problem.exception';

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

function makeProblem(
  status: number,
  code: string,
  detail: string,
  title?: string,
): ProblemDetails {
  const slug = code.toLowerCase().replace(/_/g, '-');
  return {
    type: `https://iotplatform.ovenbirdconsulting.com.ar/problems/${slug}`,
    title: title ?? STATUS_TITLES[status] ?? 'Error',
    status,
    detail,
    code,
  };
}

@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Errores de dominio ya construidos en formato RFC 9457
    if (exception instanceof ProblemException) {
      const body = exception.toProblemDetails();
      response
        .status(body.status)
        .type('application/problem+json')
        .json(body);
      return;
    }

    // 2. Traducción de errores del SDK @ovenbird/node
    if (exception instanceof OvenbirdNotFoundError) {
      const body = makeProblem(
        HttpStatus.NOT_FOUND,
        'OVENBIRD_NOT_FOUND',
        'El recurso solicitado no existe en Ovenbird IoT Cloud.',
      );
      response.status(body.status).type('application/problem+json').json(body);
      return;
    }

    if (exception instanceof OvenbirdValidationError) {
      const body = makeProblem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'OVENBIRD_VALIDATION_ERROR',
        exception.message || 'Datos rechazados por Ovenbird IoT Cloud.',
      );
      response.status(body.status).type('application/problem+json').json(body);
      return;
    }

    if (exception instanceof OvenbirdRateLimitError) {
      if (typeof exception.retryAfterMs === 'number' && exception.retryAfterMs > 0) {
        response.setHeader(
          'Retry-After',
          String(Math.ceil(exception.retryAfterMs / 1000)),
        );
      }
      const body = makeProblem(
        HttpStatus.TOO_MANY_REQUESTS,
        'OVENBIRD_RATE_LIMIT',
        'Ovenbird IoT Cloud alcanzó el límite de solicitudes. Intentá nuevamente en unos instantes.',
      );
      response.status(body.status).type('application/problem+json').json(body);
      return;
    }

    if (exception instanceof OvenbirdAuthError) {
      this.logger.error('Error de autenticación contra Ovenbird IoT Cloud (verificar OVENBIRD_CLIENT_ID / SECRET).');
      const body = makeProblem(
        HttpStatus.BAD_GATEWAY,
        'OVENBIRD_AUTH_ERROR',
        'No se pudo autenticar el servidor con Ovenbird IoT Cloud.',
      );
      response.status(body.status).type('application/problem+json').json(body);
      return;
    }

    if (exception instanceof OvenbirdError) {
      this.logger.error(`Error de Ovenbird IoT Cloud (status=${exception.status}, code=${exception.code})`);
      const status =
        exception.status >= 500 || exception.status === 0
          ? HttpStatus.SERVICE_UNAVAILABLE
          : HttpStatus.BAD_GATEWAY;
      const body = makeProblem(
        status,
        'OVENBIRD_UNAVAILABLE',
        'Ovenbird IoT Cloud no está disponible temporalmente.',
      );
      response.status(body.status).type('application/problem+json').json(body);
      return;
    }

    // 3. Excepciones estándar de NestJS (incluye 404 de rutas inexistentes, 401 de Guards, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      let detail = exception.message;
      if (typeof raw === 'object' && raw !== null && 'message' in raw) {
        const msg = (raw as { message?: string | string[] }).message;
        if (Array.isArray(msg)) {
          detail = msg.join('; ');
        } else if (typeof msg === 'string') {
          detail = msg;
        }
      }
      const code = STATUS_CODES[status] ?? 'HTTP_ERROR';
      const body = makeProblem(status, code, detail);
      response.status(body.status).type('application/problem+json').json(body);
      return;
    }

    // 4. Error inesperado (nunca exponer stack ni secretos al cliente)
    this.logger.error(
      'Error interno no controlado',
      exception instanceof Error ? exception.stack : String(exception),
    );
    const body = makeProblem(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL_SERVER_ERROR',
      'Ocurrió un error interno inesperado.',
    );
    response.status(body.status).type('application/problem+json').json(body);
  }
}
