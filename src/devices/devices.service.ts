import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Device as OvenbirdDevice } from '@ovenbird/node';
import { OvenbirdService } from '@ovenbird/node/nest';
import { IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { ProblemException } from '../common/exceptions/problem.exception';
import { PetResponse } from '../pets/dto/pet.dto';
import { Pet } from '../pets/entities/pet.entity';
import { PetsService } from '../pets/pets.service';
import {
  CreateEmbedTokenDto,
  CreatePairingCodeDto,
  DeviceResponse,
  EmbedTokenResponse,
  PairingCodeResponse,
} from './dto/device.dto';
import { PairingSession } from './entities/pairing-session.entity';

const CLOCK_SKEW_TOLERANCE_MS = 5000;
const MAX_EMBED_DEVICES = 50;

@Injectable()
export class DevicesService {
  constructor(
    private readonly ovenbird: OvenbirdService,
    private readonly petsService: PetsService,
    @InjectRepository(Pet)
    private readonly petsRepo: Repository<Pet>,
    @InjectRepository(PairingSession)
    private readonly pairingSessionsRepo: Repository<PairingSession>,
  ) {}

  async createPairingCode(
    userId: string,
    dto: CreatePairingCodeDto,
  ): Promise<PairingCodeResponse> {
    const now = new Date();
    const result = await this.ovenbird.pairing.createCode(
      dto.label ? { label: dto.label.trim() } : undefined,
    );

    const session = this.pairingSessionsRepo.create({
      userId,
      code: result.code,
      label: dto.label?.trim() ?? null,
      createdAt: now,
      expiresAt: result.expiresAt,
    });
    await this.pairingSessionsRepo.save(session);

    return {
      code: result.code,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  async listDevicesForUser(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<DeviceResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();

    const allTenantDevices = await this.fetchAllTenantDevices();

    const linkedPets = await this.petsRepo.find({
      where: { deviceId: Not(IsNull()) },
    });
    const linkByDeviceId = new Map<string, Pet>();
    for (const pet of linkedPets) {
      if (pet.deviceId) {
        linkByDeviceId.set(pet.deviceId, pet);
      }
    }

    const activePairingSessions = await this.pairingSessionsRepo.find({
      where: {
        userId,
        expiresAt: MoreThanOrEqual(now),
      },
    });

    const visibleDevices: DeviceResponse[] = [];
    for (const device of allTenantDevices) {
      const linkedPet = linkByDeviceId.get(device.deviceId);

      if (linkedPet) {
        if (linkedPet.userId === userId) {
          visibleDevices.push(this.toDeviceResponse(device, linkedPet.id));
        }
        continue;
      }

      // Dispositivo sin vincular: solo visible si apareció durante la vigencia de 10 min
      // de un código de emparejamiento generado por este usuario.
      const createdAtMs = device.createdAt.getTime();
      const matchedSession = activePairingSessions.some((session) => {
        const startMs = session.createdAt.getTime() - CLOCK_SKEW_TOLERANCE_MS;
        const endMs = session.expiresAt.getTime();
        return createdAtMs >= startMs && createdAtMs <= endMs;
      });

      if (matchedSession) {
        visibleDevices.push(this.toDeviceResponse(device, null));
      }
    }

    const total = visibleDevices.length;
    const start = (page - 1) * limit;
    const data = visibleDevices.slice(start, start + limit);

    return {
      data,
      meta: { page, limit, total },
    };
  }

  async linkDeviceToPet(
    userId: string,
    petId: string,
    deviceId: string,
  ): Promise<PetResponse> {
    const pet = await this.petsService.findOneEntityForUser(userId, petId);
    const trimmedDeviceId = deviceId.trim();

    // Idempotente si ya está vinculado al mismo collar
    if (pet.deviceId === trimmedDeviceId) {
      return this.petsService.toPetResponse(pet);
    }

    if (pet.deviceId !== null && pet.deviceId !== trimmedDeviceId) {
      throw new ProblemException({
        status: HttpStatus.CONFLICT,
        code: 'PET_ALREADY_HAS_DEVICE',
        title: 'Conflict',
        detail:
          'La mascota ya tiene otro dispositivo vinculado. Desvinculalo primero.',
      });
    }

    const existingOwnerPet = await this.petsRepo.findOne({
      where: { deviceId: trimmedDeviceId },
    });
    if (existingOwnerPet) {
      throw new ProblemException({
        status: HttpStatus.CONFLICT,
        code: 'DEVICE_ALREADY_LINKED',
        title: 'Conflict',
        detail: 'El dispositivo ya está vinculado a otra mascota.',
      });
    }

    // Verifica en Ovenbird IoT Cloud que el dispositivo existe en el tenant
    await this.ovenbird.devices.get(trimmedDeviceId);

    pet.deviceId = trimmedDeviceId;
    const saved = await this.petsRepo.save(pet);
    return this.petsService.toPetResponse(saved);
  }

  async unlinkDeviceFromPet(userId: string, petId: string): Promise<void> {
    const pet = await this.petsService.findOneEntityForUser(userId, petId);
    if (pet.deviceId !== null) {
      pet.deviceId = null;
      await this.petsRepo.save(pet);
    }
  }

  async createEmbedToken(
    userId: string,
    dto: CreateEmbedTokenDto,
  ): Promise<EmbedTokenResponse> {
    const userPetsWithDevice = await this.petsRepo.find({
      where: { userId, deviceId: Not(IsNull()) },
    });
    const ownedDeviceIds = new Set(
      userPetsWithDevice
        .map((p) => p.deviceId)
        .filter((id): id is string => Boolean(id)),
    );

    let targetDeviceIds: string[];

    if (dto.petId) {
      const pet = await this.petsService.findOneEntityForUser(userId, dto.petId);
      if (!pet.deviceId) {
        throw new ProblemException({
          status: HttpStatus.CONFLICT,
          code: 'NO_LINKED_DEVICES',
          title: 'Conflict',
          detail: 'La mascota seleccionada no tiene ningún dispositivo vinculado.',
        });
      }
      targetDeviceIds = [pet.deviceId];
    } else if (dto.deviceIds && dto.deviceIds.length > 0) {
      const uniqueRequested = Array.from(new Set(dto.deviceIds));
      const unauthorized = uniqueRequested.find((id) => !ownedDeviceIds.has(id));
      if (unauthorized) {
        throw new ProblemException({
          status: HttpStatus.FORBIDDEN,
          code: 'DEVICE_NOT_OWNED',
          title: 'Forbidden',
          detail: 'Uno o más dispositivos solicitados no pertenecen a tus mascotas.',
        });
      }
      targetDeviceIds = uniqueRequested.slice(0, MAX_EMBED_DEVICES);
    } else {
      targetDeviceIds = Array.from(ownedDeviceIds).slice(0, MAX_EMBED_DEVICES);
      if (targetDeviceIds.length === 0) {
        throw new ProblemException({
          status: HttpStatus.CONFLICT,
          code: 'NO_LINKED_DEVICES',
          title: 'Conflict',
          detail: 'No tenés ningún dispositivo vinculado a tus mascotas.',
        });
      }
    }

    const tokenResult = await this.ovenbird.embed.createToken({
      deviceIds: targetDeviceIds,
      ...(dto.ttlS !== undefined ? { ttlS: dto.ttlS } : {}),
    });

    return {
      token: tokenResult.token,
      expiresAt: tokenResult.expiresAt.toISOString(),
    };
  }

  private async fetchAllTenantDevices(): Promise<OvenbirdDevice[]> {
    const all: OvenbirdDevice[] = [];
    let cursor: string | undefined;
    let safetyPages = 0;

    do {
      const page = await this.ovenbird.devices.list({ limit: 100, cursor });
      all.push(...page.items);
      cursor = page.nextCursor;
      safetyPages += 1;
    } while (cursor && safetyPages < 50);

    return all;
  }

  private toDeviceResponse(
    device: OvenbirdDevice,
    petId: string | null,
  ): DeviceResponse {
    return {
      deviceId: device.deviceId,
      name: device.name,
      productId: device.productId,
      online: device.online,
      lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
      petId,
    };
  }
}
