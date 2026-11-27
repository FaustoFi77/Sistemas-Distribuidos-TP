import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { parseFiniteEnvNumber } from './config/env.validation';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const port = parseFiniteEnvNumber(process.env.PORT, 3001, {
    min: 1,
    max: 65535,
  });
  await app.listen(port);
  logger.log(`API corriendo en http://localhost:${port}/api/v1`);
  logger.log(`Swagger disponible en http://localhost:${port}/api/docs`);
}

void bootstrap();
