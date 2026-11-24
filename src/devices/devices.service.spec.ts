import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OvenbirdNotFoundError } from '@ovenbird/node';
import { OvenbirdService } from '@ovenbird/node/nest';
import { Pet } from '../pets/entities/pet.entity';
import { PetsService } from '../pets/pets.service';
import { DevicesService } from './devices.service';
import { PairingSession } from './entities/pairing-session.entity';

describe('DevicesService (con SDK @ovenbird/node simulado)', () => {
  let service: DevicesService;
  let ovenbirdMock: {
    pairing: { createCode: jest.Mock };
    devices: { list: jest.Mock; get: jest.Mock };
    embed: { createToken: jest.Mock };
  };
  let petsRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let pairingSessionsRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let petsServiceMock: {
    findOneEntityForUser: jest.Mock;
    toPetResponse: jest.Mock;
  };

  const now = new Date();

  beforeEach(async () => {
    ovenbirdMock = {
      pairing: { createCode: jest.fn() },
      devices: { list: jest.fn(), get: jest.fn() },
      embed: { createToken: jest.fn() },
    };
    petsRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (p) => p),
    };
    pairingSessionsRepo = {
      create: jest.fn((data) => ({ id: 'ps-1', ...data })),
      save: jest.fn(async (s) => s),
      find: jest.fn(),
    };
    petsServiceMock = {
      findOneEntityForUser: jest.fn(),
      toPetResponse: jest.fn((pet) => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: null,
        birthDate: null,
        photoUrl: null,
        deviceId: pet.deviceId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: OvenbirdService, useValue: ovenbirdMock },
        { provide: PetsService, useValue: petsServiceMock },
        { provide: getRepositoryToken(Pet), useValue: petsRepo },
        {
          provide: getRepositoryToken(PairingSession),
          useValue: pairingSessionsRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(DevicesService);
  });

  it('genera código de emparejamiento y guarda sesión para filtrar dispositivos', async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    ovenbirdMock.pairing.createCode.mockResolvedValue({
      code: 'ABC123',
      expiresAt,
    });

    const res = await service.createPairingCode('user-1', {
      label: 'Collar 1',
    });

    expect(ovenbirdMock.pairing.createCode).toHaveBeenCalledWith({
      label: 'Collar 1',
    });
    expect(pairingSessionsRepo.save).toHaveBeenCalled();
    expect(res).toEqual({
      code: 'ABC123',
      expiresAt: expiresAt.toISOString(),
    });
  });

  it('filtra GET /devices mostrando solo collares propios + recién emparejados en la ventana de 10 min', async () => {
    const sessionStart = new Date(Date.now() - 2 * 60 * 1000);
    const sessionEnd = new Date(Date.now() + 8 * 60 * 1000);

    ovenbirdMock.devices.list.mockResolvedValue({
      items: [
        {
          deviceId: 'dev-mine',
          name: 'Collar Luna',
          productId: 'ob.lora.unit',
          online: true,
          lastSeenAt: now,
          createdAt: new Date(Date.now() - 3600 * 1000),
        },
        {
          deviceId: 'dev-other-user',
          name: 'Collar Ajeno',
          productId: 'ob.lora.unit',
          online: true,
          lastSeenAt: now,
          createdAt: new Date(Date.now() - 3600 * 1000),
        },
        {
          deviceId: 'dev-fresh-unlinked',
          name: 'Collar Nuevo',
          productId: 'ob.lora.unit',
          online: true,
          lastSeenAt: now,
          createdAt: new Date(Date.now() - 60 * 1000), // dentro de la ventana del user-1
        },
        {
          deviceId: 'dev-old-unlinked',
          name: 'Collar Viejo Libre',
          productId: 'ob.lora.unit',
          online: false,
          lastSeenAt: null,
          createdAt: new Date(Date.now() - 2 * 3600 * 1000), // fuera de la ventana
        },
      ],
    });

    petsRepo.find.mockResolvedValue([
      { id: 'pet-1', userId: 'user-1', deviceId: 'dev-mine' },
      { id: 'pet-2', userId: 'user-2', deviceId: 'dev-other-user' },
    ]);
    pairingSessionsRepo.find.mockResolvedValue([
      { userId: 'user-1', createdAt: sessionStart, expiresAt: sessionEnd },
    ]);

    const res = await service.listDevicesForUser('user-1', {
      page: 1,
      limit: 20,
    });

    expect(res.meta.total).toBe(2);
    expect(res.data.map((d) => d.deviceId)).toEqual([
      'dev-fresh-unlinked',
      'dev-mine',
    ]);
    expect(res.data[0].petId).toBeNull();
    expect(res.data[1].petId).toBe('pet-1');
  });

  it('vincula un collar a una mascota y es idempotente si se repite el mismo deviceId', async () => {
    const pet = {
      id: 'pet-1',
      userId: 'user-1',
      name: 'Luna',
      species: 'dog',
      deviceId: null,
    };
    petsServiceMock.findOneEntityForUser.mockResolvedValue(pet);
    petsRepo.findOne.mockResolvedValue(null);
    ovenbirdMock.devices.get.mockResolvedValue({ deviceId: 'dev-1' });

    const first = await service.linkDeviceToPet('user-1', 'pet-1', 'dev-1');
    expect(first.deviceId).toBe('dev-1');

    // Repetición idempotente
    const second = await service.linkDeviceToPet('user-1', 'pet-1', 'dev-1');
    expect(second.deviceId).toBe('dev-1');
    expect(ovenbirdMock.devices.get).toHaveBeenCalledTimes(1);
  });

  it('devuelve 409 PET_ALREADY_HAS_DEVICE si la mascota ya tiene otro collar', async () => {
    petsServiceMock.findOneEntityForUser.mockResolvedValue({
      id: 'pet-1',
      userId: 'user-1',
      deviceId: 'dev-1',
    });

    await expect(
      service.linkDeviceToPet('user-1', 'pet-1', 'dev-2'),
    ).rejects.toMatchObject({
      code: 'PET_ALREADY_HAS_DEVICE',
    });
  });

  it('devuelve 409 DEVICE_ALREADY_LINKED si el collar pertenece a otra mascota', async () => {
    petsServiceMock.findOneEntityForUser.mockResolvedValue({
      id: 'pet-1',
      userId: 'user-1',
      deviceId: null,
    });
    petsRepo.findOne.mockResolvedValue({ id: 'pet-otro', deviceId: 'dev-1' });

    await expect(
      service.linkDeviceToPet('user-1', 'pet-1', 'dev-1'),
    ).rejects.toMatchObject({
      code: 'DEVICE_ALREADY_LINKED',
    });
  });

  it('propaga OvenbirdNotFoundError si el deviceId no existe en Ovenbird Cloud', async () => {
    petsServiceMock.findOneEntityForUser.mockResolvedValue({
      id: 'pet-1',
      userId: 'user-1',
      deviceId: null,
    });
    petsRepo.findOne.mockResolvedValue(null);
    ovenbirdMock.devices.get.mockRejectedValue(
      new OvenbirdNotFoundError(404, 'not_found', 'Device not found'),
    );

    await expect(
      service.linkDeviceToPet('user-1', 'pet-1', 'dev-inexistente'),
    ).rejects.toBeInstanceOf(OvenbirdNotFoundError);
  });

  it('emite embed-token solo para dispositivos del usuario y rechaza 409 / 403', async () => {
    // Sin dispositivos -> 409 NO_LINKED_DEVICES
    petsRepo.find.mockResolvedValue([]);
    await expect(service.createEmbedToken('user-1', {})).rejects.toMatchObject({
      code: 'NO_LINKED_DEVICES',
    });

    // Con dispositivo propio -> emite token
    petsRepo.find.mockResolvedValue([
      { id: 'pet-1', userId: 'user-1', deviceId: 'dev-1' },
    ]);
    const exp = new Date(Date.now() + 900 * 1000);
    ovenbirdMock.embed.createToken.mockResolvedValue({
      token: 'embed-tok',
      expiresAt: exp,
    });

    const tokenRes = await service.createEmbedToken('user-1', { ttlS: 600 });
    expect(ovenbirdMock.embed.createToken).toHaveBeenCalledWith({
      deviceIds: ['dev-1'],
      ttlS: 600,
    });
    expect(tokenRes).toEqual({
      token: 'embed-tok',
      expiresAt: exp.toISOString(),
    });

    // Solicitando un dispositivo ajeno -> 403 DEVICE_NOT_OWNED
    await expect(
      service.createEmbedToken('user-1', { deviceIds: ['dev-ajeno'] }),
    ).rejects.toMatchObject({
      code: 'DEVICE_NOT_OWNED',
    });
  });
});
