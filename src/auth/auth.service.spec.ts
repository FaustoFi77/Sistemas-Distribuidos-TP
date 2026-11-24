import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { ProblemException } from '../common/exceptions/problem.exception';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: 'user-uuid-1', ...data })),
      save: jest.fn(async (entity) => entity),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, def: string) => def },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('registra un usuario nuevo normalizando el email, hasheando la contraseña y emitiendo JWT', async () => {
    usersRepo.findOne.mockResolvedValue(null);

    const res = await service.register({
      email: '  Juan@Ejemplo.COM ',
      password: 'Password123!',
      name: 'Juan Pérez',
      phone: '+54 11 1234-5678',
    });

    expect(usersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'juan@ejemplo.com',
        name: 'Juan Pérez',
      }),
    );
    const savedArg = usersRepo.save.mock.calls[0][0] as User;
    expect(savedArg.passwordHash).not.toBe('Password123!');
    expect(await bcrypt.compare('Password123!', savedArg.passwordHash)).toBe(
      true,
    );

    expect(res).toEqual({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      expiresIn: 86400,
      user: {
        id: 'user-uuid-1',
        email: 'juan@ejemplo.com',
        name: 'Juan Pérez',
        phone: '+54 11 1234-5678',
      },
    });
  });

  it('rechaza registro con email duplicado con 409 EMAIL_ALREADY_EXISTS', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'existing',
      email: 'juan@ejemplo.com',
    });

    await expect(
      service.register({
        email: 'juan@ejemplo.com',
        password: 'Password123!',
        name: 'Juan',
      }),
    ).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
    });
  });

  it('permite login con credenciales válidas', async () => {
    const hash = await bcrypt.hash('MiClaveSegura!', 4);
    usersRepo.findOne.mockResolvedValue({
      id: 'user-uuid-1',
      email: 'ana@ejemplo.com',
      passwordHash: hash,
      name: 'Ana',
      phone: null,
    });

    const res = await service.login({
      email: 'ANA@ejemplo.com',
      password: 'MiClaveSegura!',
    });

    expect(res.accessToken).toBe('signed.jwt.token');
    expect(res.tokenType).toBe('Bearer');
    expect(res.user.email).toBe('ana@ejemplo.com');
  });

  it('rechaza login con contraseña incorrecta con 401 INVALID_CREDENTIALS', async () => {
    const hash = await bcrypt.hash('ClaveReal123', 4);
    usersRepo.findOne.mockResolvedValue({
      id: 'user-uuid-1',
      email: 'ana@ejemplo.com',
      passwordHash: hash,
      name: 'Ana',
      phone: null,
    });

    await expect(
      service.login({
        email: 'ana@ejemplo.com',
        password: 'ClaveIncorrecta',
      }),
    ).rejects.toBeInstanceOf(ProblemException);
  });
});
