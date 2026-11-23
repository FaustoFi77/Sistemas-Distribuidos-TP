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
<<<<<<< HEAD
          clientId: config.getOrThrow<string>('OVENBIRD_CLIENT_ID'),
          clientSecret: config.getOrThrow<string>('OVENBIRD_CLIENT_SECRET'),
=======
          clientId: config.get<string>('OVENBIRD_CLIENT_ID', ''),
          clientSecret: config.get<string>('OVENBIRD_CLIENT_SECRET', ''),
>>>>>>> e1320ea31da6df2bf4fa7967b6c9490a272bd2a9
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
