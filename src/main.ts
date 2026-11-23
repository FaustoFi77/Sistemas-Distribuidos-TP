import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemExceptionFilter } from './common/filters/problem-exception.filter';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
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

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`API corriendo en http://localhost:${port}/api/v1`);
  logger.log(`Swagger disponible en http://localhost:${port}/api/docs`);
}

bootstrap();
