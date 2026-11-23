import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AuthModule } from './auth/auth.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
<<<<<<< HEAD
import { validateEnv } from './config/env.validation';
=======
>>>>>>> e1320ea31da6df2bf4fa7967b6c9490a272bd2a9
import { DevicesModule } from './devices/devices.module';
import { OvenbirdIntegrationModule } from './ovenbird/ovenbird.integration.module';
import { PetsModule } from './pets/pets.module';
import { ZonesModule } from './zones/zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
<<<<<<< HEAD
      validate: validateEnv,
=======
>>>>>>> e1320ea31da6df2bf4fa7967b6c9490a272bd2a9
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbPath = config.get<string>('DATABASE_PATH', './data/iot-pets.db');
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
    OvenbirdIntegrationModule,
    AuthModule,
    PetsModule,
    DevicesModule,
    CapabilitiesModule,
    ZonesModule,
  ],
})
export class AppModule {}
