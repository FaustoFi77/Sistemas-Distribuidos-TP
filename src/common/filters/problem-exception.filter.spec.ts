import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import {
  OvenbirdAuthError,
  OvenbirdNotFoundError,
  OvenbirdRateLimitError,
  OvenbirdValidationError,
} from '@ovenbird/node';
import { ProblemExceptionFilter } from './problem-exception.filter';

describe('ProblemExceptionFilter (RFC 9457 + Traducción de Ovenbird)', () => {
  let filter: ProblemExceptionFilter;
  let statusMock: jest.Mock;
  let typeMock: jest.Mock;
  let jsonMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new ProblemExceptionFilter();
    jsonMock = jest.fn();
    typeMock = jest.fn().mockReturnValue({ json: jsonMock });
    statusMock = jest.fn().mockReturnValue({ type: typeMock });
    setHeaderMock = jest.fn();

    host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: statusMock,
          setHeader: setHeaderMock,
        }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('traduce OvenbirdNotFoundError a 404 RFC 9457', () => {
    filter.catch(new OvenbirdNotFoundError(404, 'not_found', 'Not found'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(typeMock).toHaveBeenCalledWith('application/problem+json');
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, code: 'OVENBIRD_NOT_FOUND' }),
    );
  });

  it('traduce OvenbirdValidationError a 422', () => {
    filter.catch(new OvenbirdValidationError(422, 'invalid', 'Invalid DP'), host);

    expect(statusMock).toHaveBeenCalledWith(422);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 422, code: 'OVENBIRD_VALIDATION_ERROR' }),
    );
  });

  it('traduce OvenbirdRateLimitError a 429 incluyendo Retry-After', () => {
    filter.catch(
      new OvenbirdRateLimitError(429, 'rate_limit', 'Too many', 4500),
      host,
    );

    expect(setHeaderMock).toHaveBeenCalledWith('Retry-After', '5');
    expect(statusMock).toHaveBeenCalledWith(429);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 429, code: 'OVENBIRD_RATE_LIMIT' }),
    );
  });

  it('traduce OvenbirdAuthError a 502 sin exponer secretos', () => {
    filter.catch(
      new OvenbirdAuthError(401, 'auth', 'Bad secret XYZ123'),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(502);
    const body = jsonMock.mock.calls[0][0];
    expect(body.code).toBe('OVENBIRD_AUTH_ERROR');
    expect(JSON.stringify(body)).not.toContain('XYZ123');
  });

  it('convierte NotFoundException (rutas inexistentes de otras variantes) a 404 RFC 9457', () => {
    filter.catch(new NotFoundException('Cannot POST /api/v1/pets/1/lost'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(typeMock).toHaveBeenCalledWith('application/problem+json');
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    );
  });
});
