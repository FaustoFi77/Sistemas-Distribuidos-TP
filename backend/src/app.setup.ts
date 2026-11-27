import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ProblemExceptionFilter } from './common/filters/problem-exception.filter';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';

/**
 * Configuración global compartida por main.ts y las pruebas E2E,
 * garantizando que los tests validen exactamente el mismo pipeline HTTP que producción.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(
    helmet({
      // Permite que Swagger UI cargue sus scripts/estilos y que otros frontends
      // consuman la API por CORS sin bloqueos en pruebas cruzadas entre grupos.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors();
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new ProblemExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sistema IoT de Seguimiento de Mascotas — API REST')
    .setDescription(
      'Backend NestJS compatible con la Especificación de Interoperabilidad v1 (Grupo 3: Pérdida de enlace y zonas — link-loss-zones).',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
}
