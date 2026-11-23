import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PetsModule } from '../pets/pets.module';
import { AlertsController } from './alerts.controller';
import { Alert } from './entities/alert.entity';
import { SafeZone } from './entities/safe-zone.entity';
import { MonitoringService } from './monitoring.service';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [TypeOrmModule.forFeature([SafeZone, Alert]), PetsModule],
  controllers: [ZonesController, AlertsController],
  providers: [ZonesService, MonitoringService],
  exports: [ZonesService, MonitoringService],
})
export class ZonesModule {}
