import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEventsModule } from '../common/events/domain-events.module';
import { PetsModule } from '../pets/pets.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { PairingSession } from './entities/pairing-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PairingSession]),
    PetsModule,
    DomainEventsModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
