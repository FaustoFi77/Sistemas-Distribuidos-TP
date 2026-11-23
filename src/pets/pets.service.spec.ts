import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { PetsService } from './pets.service';

describe('PetsService', () => {
  let service: PetsService;
  let petsRepo: {
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  const now = new Date('2026-11-22T20:00:00.000Z');

  beforeEach(async () => {
    petsRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => ({
        id: 'pet-1',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: jest.fn(async (entity) => entity),
      remove: jest.fn(async (entity) => entity),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: getRepositoryToken(Pet), useValue: petsRepo },
      ],
    }).compile();

    service = moduleRef.get(PetsService);
  });

  it('lista mascotas paginadas solo del usuario autenticado', async () => {
    petsRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 'pet-1',
          userId: 'user-1',
          name: 'Luna',
          species: 'dog',
          breed: 'Mestiza',
          birthDate: '2022-01-01',
          photoUrl: null,
          deviceId: 'dev-1',
          createdAt: now,
          updatedAt: now,
        },
      ],
      1,
    ]);

    const res = await service.findAllForUser('user-1', { page: 1, limit: 20 });

    expect(petsRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        skip: 0,
        take: 20,
      }),
    );
    expect(res.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(res.data[0]).toMatchObject({
      id: 'pet-1',
      name: 'Luna',
      deviceId: 'dev-1',
      createdAt: '2026-11-22T20:00:00.000Z',
    });
  });

  it('devuelve 404 PET_NOT_FOUND cuando la mascota no pertenece al usuario', async () => {
    petsRepo.findOne.mockResolvedValue(null);

    await expect(
      service.findOneForUser('otro-user', 'pet-1'),
    ).rejects.toMatchObject({
      code: 'PET_NOT_FOUND',
    });
  });

<<<<<<< HEAD
  it('actualiza parcialmente una mascota sin pisar los campos omitidos', async () => {
    const pet = {
      id: 'pet-1',
      userId: 'user-1',
      name: 'Luna',
      species: 'dog',
      breed: 'Golden Retriever',
      birthDate: '2022-05-14',
      photoUrl: 'https://ejemplo.com/luna.jpg',
      deviceId: 'dev-99',
      createdAt: now,
      updatedAt: now,
    };
    petsRepo.findOne.mockResolvedValue(pet);

    const updated = await service.update('user-1', 'pet-1', {
      name: 'Luna Editada',
    });

    expect(updated.name).toBe('Luna Editada');
    expect(updated.species).toBe('dog');
    expect(updated.breed).toBe('Golden Retriever');
    expect(updated.birthDate).toBe('2022-05-14');
    expect(updated.photoUrl).toBe('https://ejemplo.com/luna.jpg');
    expect(updated.deviceId).toBe('dev-99');
  });

=======
>>>>>>> e1320ea31da6df2bf4fa7967b6c9490a272bd2a9
  it('desvincula el collar antes de eliminar una mascota', async () => {
    const pet = {
      id: 'pet-1',
      userId: 'user-1',
      name: 'Luna',
      species: 'dog',
      deviceId: 'dev-99',
      createdAt: now,
      updatedAt: now,
    };
    petsRepo.findOne.mockResolvedValue(pet);

    await service.remove('user-1', 'pet-1');

    expect(pet.deviceId).toBeNull();
    expect(petsRepo.save).toHaveBeenCalledWith(pet);
    expect(petsRepo.remove).toHaveBeenCalledWith(pet);
  });
});
