import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OvenbirdNotFoundError } from '@ovenbird/node';
import { OvenbirdService } from '@ovenbird/node/nest';
import { DomainEventsService } from '../common/events/domain-events.service';
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
    delete?: jest.Mock;
  };
  let petsServiceMock: {
    findOneEntityForUser: jest.Mock;
    toPetResponse: jest.Mock;
  };
  let domainEventsMock: { emit: jest.Mock };

  const now = new Date();

  beforeEach(async () => {
    domainEventsMock = { emit: jest.fn().mockResolvedValue(undefined) };
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
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
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
        { provide: DomainEventsService, useValue: domainEventsMock },
      ],
    }).compile();

    service = moduleRef.get(DevicesService);
  });

  it('genera código de emparejamiento, limpia sesiones vencidas y guarda sesión para filtrar dispositivos', async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    ovenbirdMock.pairing.createCode.mockResolvedValue({
      code: 'ABC123',
      expiresAt,
    });

    const res = await service.createPairingCode('user-1', {
      label: 'Collar 1',
    });

    expect(pairingSessionsRepo.delete).toHaveBeenCalledTimes(1);
    const deleteArg = pairingSessionsRepo.delete?.mock.calls[0][0];
    expect(deleteArg.expiresAt._type).toBe('lessThan');
    expect(deleteArg.expiresAt._value).toBeInstanceOf(Date);
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

  it('devuelve 409 DEVICE_ALREADY_LINKED si el collar pertenece a otra mascota o ante colisión UNIQUE concurrente', async () => {
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

    // Carrera TOCTOU: pasa el findOne inicial pero choca contra el índice UNIQUE al guardar
    petsRepo.findOne.mockResolvedValue(null);
    ovenbirdMock.devices.get.mockResolvedValue({ deviceId: 'dev-race' });
    petsRepo.save.mockRejectedValueOnce(
      Object.assign(new Error('UNIQUE constraint failed: pets.deviceId'), {
        code: 'SQLITE_CONSTRAINT_UNIQUE',
      }),
    );

    await expect(
      service.linkDeviceToPet('user-1', 'pet-1', 'dev-race'),
    ).rejects.toMatchObject({
      status: 409,
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

    // deviceIds vacío -> 400 VALIDATION_ERROR (no cae al else de todos los collares)
    await expect(
      service.createEmbedToken('user-1', { deviceIds: [] }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('valida combinación simultánea de petId + deviceIds en createEmbedToken', async () => {
    petsRepo.find.mockResolvedValue([
      { id: 'pet-1', userId: 'user-1', deviceId: 'dev-1' },
      { id: 'pet-2', userId: 'user-1', deviceId: 'dev-2' },
    ]);

    // 1. deviceIds vacío junto con petId -> 400 VALIDATION_ERROR
    await expect(
      service.createEmbedToken('user-1', { petId: 'pet-1', deviceIds: [] }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });

    // 2. deviceIds con dispositivo ajeno junto con petId -> 403 DEVICE_NOT_OWNED
    await expect(
      service.createEmbedToken('user-1', {
        petId: 'pet-1',
        deviceIds: ['dev-1', 'dev-ajeno'],
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'DEVICE_NOT_OWNED',
    });

    // 3. petId sin dispositivo vinculado junto con deviceIds propios -> 409 NO_LINKED_DEVICES
    petsServiceMock.findOneEntityForUser.mockResolvedValueOnce({
      id: 'pet-3',
      userId: 'user-1',
      deviceId: null,
    });
    await expect(
      service.createEmbedToken('user-1', {
        petId: 'pet-3',
        deviceIds: ['dev-1'],
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'NO_LINKED_DEVICES',
    });

    // 4. pet.deviceId no incluido en deviceIds propios -> 400 VALIDATION_ERROR
    petsServiceMock.findOneEntityForUser.mockResolvedValueOnce({
      id: 'pet-1',
      userId: 'user-1',
      deviceId: 'dev-1',
    });
    await expect(
      service.createEmbedToken('user-1', {
        petId: 'pet-1',
        deviceIds: ['dev-2'],
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });

    // 5. Combinación coherente -> 200 emitiendo token para el dispositivo de petId
    const exp = new Date(Date.now() + 900 * 1000);
    petsServiceMock.findOneEntityForUser.mockResolvedValueOnce({
      id: 'pet-1',
      userId: 'user-1',
      deviceId: 'dev-1',
    });
    ovenbirdMock.embed.createToken.mockResolvedValueOnce({
      token: 'combo-tok',
      expiresAt: exp,
    });

    const okRes = await service.createEmbedToken('user-1', {
      petId: 'pet-1',
      deviceIds: ['dev-1', 'dev-2'],
    });
    expect(ovenbirdMock.embed.createToken).toHaveBeenLastCalledWith({
      deviceIds: ['dev-1'],
    });
    expect(okRes.token).toBe('combo-tok');
  });

  it('desvincula el collar de una mascota y emite pet.device.unlinked', async () => {
    const pet = {
      id: 'pet-1',
      userId: 'user-1',
      name: 'Luna',
      species: 'dog',
      deviceId: 'dev-1',
    };
    petsServiceMock.findOneEntityForUser.mockResolvedValue(pet);

    await service.unlinkDeviceFromPet('user-1', 'pet-1');

    expect(pet.deviceId).toBeNull();
    expect(petsRepo.save).toHaveBeenCalledWith(pet);
    expect(domainEventsMock.emit).toHaveBeenCalledWith('pet.device.unlinked', {
      petId: 'pet-1',
      userId: 'user-1',
    });
  });
});
