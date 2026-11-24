import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { DomainEventsModule } from './common/events/domain-events.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { parseFiniteEnvNumber, validateEnv } from './config/env.validation';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { OvenbirdIntegrationModule } from './ovenbird/ovenbird.integration.module';
import { PetsModule } from './pets/pets.module';
import { ZonesModule } from './zones/zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: parseFiniteEnvNumber(
            config.get<string>('THROTTLE_TTL_MS', '60000'),
            60000,
            { min: 1 },
          ),
          limit: parseFiniteEnvNumber(
            config.get<string>('THROTTLE_LIMIT', '120'),
            120,
            { min: 1 },
          ),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbPath = config.get<string>(
          'DATABASE_PATH',
          './data/iot-pets.db',
        );
        const dir = path.dirname(dbPath);
        if (dir && dir !== '.' && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        return {
          type: 'better-sqlite3',
          database: dbPath,
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
    DomainEventsModule,
    OvenbirdIntegrationModule,
    HealthModule,
    AuthModule,
    PetsModule,
    DevicesModule,
    CapabilitiesModule,
    ZonesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
