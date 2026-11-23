import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { ProblemException } from '../common/exceptions/problem.exception';
import { CreatePetDto, PetResponse, UpdatePetDto } from './dto/pet.dto';
import { Pet } from './entities/pet.entity';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petsRepo: Repository<Pet>,
  ) {}

  async findAllForUser(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<PetResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.petsRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((pet) => this.toPetResponse(pet)),
      meta: { page, limit, total },
    };
  }

  async create(userId: string, dto: CreatePetDto): Promise<PetResponse> {
    const pet = this.petsRepo.create({
      userId,
      name: dto.name.trim(),
      species: dto.species.trim(),
      breed: dto.breed?.trim() ?? null,
      birthDate: dto.birthDate?.trim() ?? null,
      photoUrl: dto.photoUrl?.trim() ?? null,
      deviceId: null,
    });

    const saved = await this.petsRepo.save(pet);
    return this.toPetResponse(saved);
  }

  async findOneEntityForUser(userId: string, petId: string): Promise<Pet> {
    const pet = await this.petsRepo.findOne({
      where: { id: petId, userId },
    });
    if (!pet) {
      throw new ProblemException({
        status: HttpStatus.NOT_FOUND,
        code: 'PET_NOT_FOUND',
        title: 'Not Found',
        detail: 'La mascota solicitada no existe.',
      });
    }
    return pet;
  }

  async findOneForUser(userId: string, petId: string): Promise<PetResponse> {
    const pet = await this.findOneEntityForUser(userId, petId);
    return this.toPetResponse(pet);
  }

  async update(
    userId: string,
    petId: string,
    dto: UpdatePetDto,
  ): Promise<PetResponse> {
    const pet = await this.findOneEntityForUser(userId, petId);

    if (dto.name !== undefined) pet.name = dto.name.trim();
    if (dto.species !== undefined) pet.species = dto.species.trim();
    if (dto.breed !== undefined) pet.breed = dto.breed ? dto.breed.trim() : null;
    if (dto.birthDate !== undefined) {
      pet.birthDate = dto.birthDate ? dto.birthDate.trim() : null;
    }
    if (dto.photoUrl !== undefined) {
      pet.photoUrl = dto.photoUrl ? dto.photoUrl.trim() : null;
    }

    const saved = await this.petsRepo.save(pet);
    return this.toPetResponse(saved);
  }

  async remove(userId: string, petId: string): Promise<void> {
    const pet = await this.findOneEntityForUser(userId, petId);
    // Regla de interoperabilidad: desvincular el collar antes de eliminar la mascota
    if (pet.deviceId !== null) {
      pet.deviceId = null;
      await this.petsRepo.save(pet);
    }
    await this.petsRepo.remove(pet);
  }

  toPetResponse(pet: Pet): PetResponse {
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? null,
      birthDate: pet.birthDate ?? null,
      photoUrl: pet.photoUrl ?? null,
      deviceId: pet.deviceId ?? null,
      createdAt: pet.createdAt.toISOString(),
      updatedAt: pet.updatedAt.toISOString(),
    };
  }
}
