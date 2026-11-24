import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvenbirdService } from '@ovenbird/node/nest';
import * as request from 'supertest';
import { configureApp } from '../src/app.setup';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { CapabilitiesModule } from '../src/capabilities/capabilities.module';
import { validateEnv } from '../src/config/env.validation';
import { DevicesModule } from '../src/devices/devices.module';
import { HealthModule } from '../src/health/health.module';
import { OvenbirdIntegrationModule } from '../src/ovenbird/ovenbird.integration.module';
import { PetsModule } from '../src/pets/pets.module';
import { ZonesModule } from '../src/zones/zones.module';

describe('API REST Interoperabilidad + Variante Grupo 3 (E2E)', () => {
  let app: INestApplication;

  const ovenbirdMock = {
    pairing: {
      createCode: jest.fn().mockResolvedValue({
        code: 'PAIR99',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    },
    devices: {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            deviceId: 'dev-sim-1',
            name: 'Collar Simulado',
            productId: 'ob.lora.unit',
            online: true,
            lastSeenAt: new Date(),
            createdAt: new Date(),
          },
        ],
      }),
      get: jest.fn().mockResolvedValue({
        deviceId: 'dev-sim-1',
        name: 'Collar Simulado',
        productId: 'ob.lora.unit',
        online: true,
      }),
    },
    embed: {
      createToken: jest.fn().mockResolvedValue({
        token: 'mock-embed-token',
        expiresAt: new Date(Date.now() + 900 * 1000),
      }),
    },
    events: {
      subscribe: jest.fn().mockReturnValue({ close: jest.fn() }),
    },
  };

  const prevEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    const testEnv: Record<string, string> = {
      JWT_SECRET: 'test-secret-key-with-at-least-32-bytes!',
      JWT_EXPIRES_IN_SECONDS: '86400',
      JWT_ISSUER: 'iot-pets-backend',
      JWT_AUDIENCE: 'iot-pets-web',
      OVENBIRD_CLIENT_ID: 'cid_test_e2e',
      OVENBIRD_CLIENT_SECRET: 'secret_test_e2e',
      OVENBIRD_EVENTS_ENABLED: 'false',
    };
    for (const [k, v] of Object.entries(testEnv)) {
      prevEnv[k] = process.env[k];
      process.env[k] = v;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: validateEnv,
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
        }),
        OvenbirdIntegrationModule,
        HealthModule,
        AuthModule,
        PetsModule,
        DevicesModule,
        CapabilitiesModule,
        ZonesModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    })
      .overrideProvider(OvenbirdService)
      .useValue(ovenbirdMock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it('rutas públicas (/health, /capabilities, /api/docs-json) responden 200 sin token y con headers de helmet', async () => {
    const healthRes = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(healthRes.body.status).toBe('ok');
    expect(typeof healthRes.body.timestamp).toBe('string');
    expect(healthRes.headers['x-content-type-options']).toBe('nosniff');

    const capRes = await request(app.getHttpServer())
      .get('/api/v1/capabilities')
      .expect(200);
    expect(capRes.body).toEqual({
      apiVersion: '1',
      variants: ['link-loss-zones'],
    });

    const docsRes = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(docsRes.body.paths['/api/v1/zones'].get['x-variant']).toBe(
      'link-loss-zones',
    );
  });

  it('GET /api devuelve 404 (Swagger solo está montado en /api/docs)', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('protege rutas por defecto: sin token (401) y con token inválido (401)', async () => {
    const protectedEndpoints = [
      '/api/v1/auth/me',
      '/api/v1/pets',
      '/api/v1/devices',
      '/api/v1/zones',
      '/api/v1/alerts',
    ];

    for (const url of protectedEndpoints) {
      const noToken = await request(app.getHttpServer()).get(url).expect(401);
      expect(noToken.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(noToken.body.code).toBe('UNAUTHORIZED');

      await request(app.getHttpServer())
        .get(url)
        .set('Authorization', 'Bearer token.invalido.falso')
        .expect(401);
    }
  });

  it('devuelve 404 RFC 9457 (application/problem+json) si un endpoint no existe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pets/pet-123/lost')
      .expect(404);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('flujo completo + aislamiento multiusuario + claims JWT + bordes de paginación', async () => {
    // 1. Register Usuario A (con campo extra de otro frontend que debe ignorarse limpiamente)
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'usuario-a@ejemplo.com',
        password: 'Password123!',
        name: 'Fausto',
        campoExtraOtroGrupo: 'debe-ignorarse',
      })
      .expect(201);

    expect(regA.body.tokenType).toBe('Bearer');
    const tokenA = regA.body.accessToken as string;

    // Verificar claims estándar del JWT (sin datos sensibles)
    const payloadJson = Buffer.from(tokenA.split('.')[1], 'base64url').toString(
      'utf8',
    );
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    expect(payload).toMatchObject({
      email: 'usuario-a@ejemplo.com',
      iss: 'iot-pets-backend',
      aud: 'iot-pets-web',
    });
    expect(payload.sub).toBeDefined();
    expect(payload.password).toBeUndefined();
    expect(payload.passwordHash).toBeUndefined();

    // 2. Register Usuario B para comprobar aislamiento
    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'usuario-b@ejemplo.com',
        password: 'Password123!',
        name: 'Otro Usuario',
      })
      .expect(201);
    const tokenB = regB.body.accessToken as string;

    // 3. Login devuelve 200
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'usuario-a@ejemplo.com', password: 'Password123!' })
      .expect(200);

    // 4. POST /pets con {} debe rechazarse con 400 VALIDATION_ERROR
    const emptyPetRes = await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(400);
    expect(emptyPetRes.body.code).toBe('VALIDATION_ERROR');

    // 5. Crear mascota y verificar PATCH parcial sin pisar campos omitidos
    const petRes = await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Toby', species: 'dog', breed: 'Beagle' })
      .expect(201);
    const petId = petRes.body.id as string;

    const patchedPet = await request(app.getHttpServer())
      .patch(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Toby Editado' })
      .expect(200);
    expect(patchedPet.body).toMatchObject({
      name: 'Toby Editado',
      species: 'dog',
      breed: 'Beagle',
    });

    // Aislamiento: Usuario B no puede ver ni editar la mascota de A (404, nunca 403)
    const crossPet = await request(app.getHttpServer())
      .get(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    expect(crossPet.body.code).toBe('PET_NOT_FOUND');

    // 6. Emparejar, vincular dispositivo y pedir embed-token
    await request(app.getHttpServer())
      .post('/api/v1/pairing-codes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ label: 'Collar Toby' })
      .expect(201);

    const devicesRes = await request(app.getHttpServer())
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(devicesRes.body.data).toHaveLength(1);
    expect(devicesRes.body.data[0].deviceId).toBe('dev-sim-1');

    await request(app.getHttpServer())
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ deviceId: 'dev-sim-1' })
      .expect(200);

    const embedRes = await request(app.getHttpServer())
      .post('/api/v1/embed-token')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(200);
    expect(embedRes.body.token).toBe('mock-embed-token');

    // Aislamiento embed-token: Usuario B no puede pedir token del collar de Usuario A (403)
    const crossEmbed = await request(app.getHttpServer())
      .post('/api/v1/embed-token')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ deviceIds: ['dev-sim-1'] })
      .expect(403);
    expect(crossEmbed.body.code).toBe('DEVICE_NOT_OWNED');

    // 7. Zonas: rechaza radio negativo (400), PATCH parcial preserva active=false y aislamiento 404
    const badZoneRes = await request(app.getHttpServer())
      .post(`/api/v1/pets/${petId}/zones`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Zona inválida',
        centerLat: -34.603722,
        centerLon: -58.381592,
        radiusMeters: -50,
      })
      .expect(400);
    expect(badZoneRes.body.code).toBe('VALIDATION_ERROR');

    const zoneRes = await request(app.getHttpServer())
      .post(`/api/v1/pets/${petId}/zones`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Casa',
        centerLat: -34.603722,
        centerLon: -58.381592,
        radiusMeters: 120,
        active: false,
      })
      .expect(201);
    const zoneId = zoneRes.body.id as string;

    const patchedZone = await request(app.getHttpServer())
      .patch(`/api/v1/zones/${zoneId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Casa Editada' })
      .expect(200);
    expect(patchedZone.body).toMatchObject({
      name: 'Casa Editada',
      centerLat: -34.603722,
      centerLon: -58.381592,
      radiusMeters: 120,
      active: false,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/zones/${zoneId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hack' })
      .expect(404);

    // 8. Bordes de paginación (creamos 4 mascotas más para Usuario B -> total 4)
    for (let i = 1; i <= 4; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: `Mascota ${i}`, species: 'cat' })
        .expect(201);
    }

    // Valores por defecto sin query params
    const defaultPage = await request(app.getHttpServer())
      .get('/api/v1/pets')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(defaultPage.body.meta).toEqual({ page: 1, limit: 20, total: 4 });

    // Recorrido completo con limit=2 (orden determinista sin repetidos)
    const p1 = await request(app.getHttpServer())
      .get('/api/v1/pets?page=1&limit=2')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const p2 = await request(app.getHttpServer())
      .get('/api/v1/pets?page=2&limit=2')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const ids = [
      ...p1.body.data.map((p: { id: string }) => p.id),
      ...p2.body.data.map((p: { id: string }) => p.id),
    ];
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);

    // Página fuera de rango -> data vacía
    const outOfRange = await request(app.getHttpServer())
      .get('/api/v1/pets?page=99&limit=2')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(outOfRange.body.data).toEqual([]);
    expect(outOfRange.body.meta.total).toBe(4);

    // Límite máximo permitido (100) OK, por encima (101) -> 400, no numérico -> 400
    await request(app.getHttpServer())
      .get('/api/v1/pets?page=1&limit=100')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/pets?page=1&limit=101')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/pets?page=abc')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(400);
  });
});
