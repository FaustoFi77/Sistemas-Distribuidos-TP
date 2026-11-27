import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../common/dto/pagination.dto';
import { DomainEventsService } from '../common/events/domain-events.service';
import { ProblemException } from '../common/exceptions/problem.exception';
import { PetsService } from '../pets/pets.service';
import {
  CreateZoneDto,
  SafeZoneResponse,
  UpdateZoneDto,
  ZoneQueryDto,
} from './dto/zone.dto';
import { SafeZone } from './entities/safe-zone.entity';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(SafeZone)
    private readonly zonesRepo: Repository<SafeZone>,
    private readonly petsService: PetsService,
    @Optional()
    private readonly domainEvents?: DomainEventsService,
  ) {}

  async findAllForUser(
    userId: string,
    query: ZoneQueryDto,
  ): Promise<PaginatedResponse<SafeZoneResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: FindOptionsWhere<SafeZone> = { userId };
    if (query.petId) {
      await this.petsService.findOneEntityForUser(userId, query.petId);
      where.petId = query.petId;
    }

    const [items, total] = await this.zonesRepo.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((z) => this.toZoneResponse(z)),
      meta: { page, limit, total },
    };
  }

  async findAllForPet(
    userId: string,
    petId: string,
  ): Promise<SafeZoneResponse[]> {
    await this.petsService.findOneEntityForUser(userId, petId);
    const items = await this.zonesRepo.find({
      where: { userId, petId },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return items.map((z) => this.toZoneResponse(z));
  }

  async createForPet(
    userId: string,
    petId: string,
    dto: CreateZoneDto,
  ): Promise<SafeZoneResponse> {
    await this.petsService.findOneEntityForUser(userId, petId);

    const zone = this.zonesRepo.create({
      userId,
      petId,
      name: dto.name.trim(),
      centerLat: dto.centerLat,
      centerLon: dto.centerLon,
      radiusMeters: dto.radiusMeters,
      active: dto.active ?? true,
    });

    const saved = await this.zonesRepo.save(zone);
    await this.domainEvents?.emit('pet.zones.changed', { petId: saved.petId });
    return this.toZoneResponse(saved);
  }

  async update(
    userId: string,
    zoneId: string,
    dto: UpdateZoneDto,
  ): Promise<SafeZoneResponse> {
    const zone = await this.findOneEntityForUser(userId, zoneId);

    if (dto.name !== undefined) zone.name = dto.name.trim();
    if (dto.centerLat !== undefined) zone.centerLat = dto.centerLat;
    if (dto.centerLon !== undefined) zone.centerLon = dto.centerLon;
    if (dto.radiusMeters !== undefined) zone.radiusMeters = dto.radiusMeters;
    if (dto.active !== undefined) zone.active = dto.active;

    const saved = await this.zonesRepo.save(zone);
    await this.domainEvents?.emit('pet.zones.changed', { petId: saved.petId });
    return this.toZoneResponse(saved);
  }

  async remove(userId: string, zoneId: string): Promise<void> {
    const zone = await this.findOneEntityForUser(userId, zoneId);
    const petId = zone.petId;
    await this.zonesRepo.remove(zone);
    await this.domainEvents?.emit('pet.zones.changed', { petId });
  }

  async findActiveEntitiesForPet(petId: string): Promise<SafeZone[]> {
    return this.zonesRepo.find({
      where: { petId, active: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  private async findOneEntityForUser(
    userId: string,
    zoneId: string,
  ): Promise<SafeZone> {
    const zone = await this.zonesRepo.findOne({
      where: { id: zoneId, userId },
    });
    if (!zone) {
      throw new ProblemException({
        status: HttpStatus.NOT_FOUND,
        code: 'ZONE_NOT_FOUND',
        title: 'Not Found',
        detail: 'La zona segura solicitada no existe.',
      });
    }
    return zone;
  }

  toZoneResponse(zone: SafeZone): SafeZoneResponse {
    return {
      id: zone.id,
      petId: zone.petId,
      name: zone.name,
      shape: 'circle',
      centerLat: zone.centerLat,
      centerLon: zone.centerLon,
      radiusMeters: zone.radiusMeters,
      active: zone.active,
      createdAt: zone.createdAt.toISOString(),
      updatedAt: zone.updatedAt.toISOString(),
    };
  }
}
