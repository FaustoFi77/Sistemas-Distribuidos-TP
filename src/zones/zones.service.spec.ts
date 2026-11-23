import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PetsService } from '../pets/pets.service';
import { SafeZone } from './entities/safe-zone.entity';
import { ZonesService } from './zones.service';

describe('ZonesService (unitarios con dobles)', () => {
  let service: ZonesService;
  let zonesRepo: {
    findAndCount: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let petsServiceMock: { findOneEntityForUser: jest.Mock };

  const now = new Date('2026-11-23T15:00:00.000Z');

  beforeEach(async () => {
    zonesRepo = {
      findAndCount: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => ({
        id: 'zone-1',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: jest.fn(async (entity) => entity),
      remove: jest.fn(async (entity) => entity),
    };
    petsServiceMock = {
      findOneEntityForUser: jest.fn().mockResolvedValue({
        id: 'pet-1',
        userId: 'user-1',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ZonesService,
        { provide: getRepositoryToken(SafeZone), useValue: zonesRepo },
        { provide: PetsService, useValue: petsServiceMock },
      ],
    }).compile();

    service = moduleRef.get(ZonesService);
  });

  it('crea una zona circular con active=true por defecto si no se especifica', async () => {
    const res = await service.createForPet('user-1', 'pet-1', {
      name: 'Casa',
      centerLat: -34.603722,
      centerLon: -58.381592,
      radiusMeters: 100,
    });

    expect(res).toMatchObject({
      id: 'zone-1',
      petId: 'pet-1',
      name: 'Casa',
      shape: 'circle',
      radiusMeters: 100,
      active: true,
    });
  });

  it('actualiza parcialmente una zona sin pisar los campos omitidos (incluido active=false)', async () => {
    const existing: SafeZone = {
      id: 'zone-1',
      userId: 'user-1',
      petId: 'pet-1',
      pet: undefined as never,
      name: 'Casa',
      centerLat: -34.603722,
      centerLon: -58.381592,
      radiusMeters: 120,
      active: false,
      createdAt: now,
      updatedAt: now,
    };
    zonesRepo.findOne.mockResolvedValue(existing);

    const updated = await service.update('user-1', 'zone-1', {
      name: 'Casa Editada',
    });

    expect(updated.name).toBe('Casa Editada');
    expect(updated.centerLat).toBe(-34.603722);
    expect(updated.centerLon).toBe(-58.381592);
    expect(updated.radiusMeters).toBe(120);
    expect(updated.active).toBe(false);
  });

  it('elimina una zona existente del usuario', async () => {
    const existing = {
      id: 'zone-1',
      userId: 'user-1',
      petId: 'pet-1',
      name: 'Casa',
    };
    zonesRepo.findOne.mockResolvedValue(existing);

    await service.remove('user-1', 'zone-1');

    expect(zonesRepo.remove).toHaveBeenCalledWith(existing);
  });

  it('devuelve 404 ZONE_NOT_FOUND si la zona no existe o pertenece a otro usuario', async () => {
    zonesRepo.findOne.mockResolvedValue(null);

    await expect(
      service.update('otro-user', 'zone-1', { name: 'Hack' }),
    ).rejects.toMatchObject({
      code: 'ZONE_NOT_FOUND',
    });
  });
});
