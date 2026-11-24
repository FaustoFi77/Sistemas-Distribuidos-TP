import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEventsModule } from '../common/events/domain-events.module';
import { Pet } from './entities/pet.entity';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pet]), DomainEventsModule],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService, TypeOrmModule],
})
export class PetsModule {}
