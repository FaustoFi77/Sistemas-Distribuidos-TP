import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OvenbirdModule } from '@ovenbird/node/nest';

@Global()
@Module({
  imports: [
    OvenbirdModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('OvenbirdSDK');
        return {
          baseUrl: config.get<string>(
            'OVENBIRD_URL',
            'https://iotplatform.ovenbirdconsulting.com.ar',
          ),
          clientId: config.getOrThrow<string>('OVENBIRD_CLIENT_ID'),
          clientSecret: config.getOrThrow<string>('OVENBIRD_CLIENT_SECRET'),
          logger: {
            warn: (msg: string) => logger.warn(msg),
          },
        };
      },
    }),
  ],
  exports: [OvenbirdModule],
})
export class OvenbirdIntegrationModule {}
