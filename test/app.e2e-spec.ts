import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvenbirdService } from '@ovenbird/node/nest';
import * as request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { CapabilitiesModule } from '../src/capabilities/capabilities.module';
import { ProblemExceptionFilter } from '../src/common/filters/problem-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';
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
      JWT_SECRET: 'test-secret-key-32-characters-long',
      JWT_EXPIRES_IN_SECONDS: '86400',
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
    })
      .overrideProvider(OvenbirdService)
      .useValue(ovenbirdMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableCors();
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new ProblemExceptionFilter());

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Test API')
      .setVersion('1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });

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

  it('GET /api/v1/health responde 200 con status ok', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/v1/capabilities anuncia versión 1 y variante link-loss-zones', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/capabilities')
      .expect(200);

    expect(res.body).toEqual({
      apiVersion: '1',
      variants: ['link-loss-zones'],
    });
  });

  it('GET /api devuelve 404 (Swagger solo está montado en /api/docs)', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
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

  it('flujo completo: auth -> pets (validación y PATCH parcial) -> devices -> embed-token -> zones (PATCH parcial)', async () => {
    // 1. Register (con campo extra de otro frontend que debe ignorarse limpiamente)
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'alumno@ejemplo.com',
        password: 'Password123!',
        name: 'Fausto',
        campoExtraOtroGrupo: 'debe-ignorarse',
      })
      .expect(201);

    expect(reg.body.tokenType).toBe('Bearer');
    const token = reg.body.accessToken as string;

    // 2. Login devuelve 200
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alumno@ejemplo.com', password: 'Password123!' })
      .expect(200);

    // 3. POST /pets con {} debe rechazarse con 400 VALIDATION_ERROR
    const emptyPetRes = await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(emptyPetRes.body.code).toBe('VALIDATION_ERROR');

    // 4. Crear mascota y verificar PATCH parcial sin pisar campos omitidos
    const petRes = await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Toby', species: 'dog', breed: 'Beagle' })
      .expect(201);
    const petId = petRes.body.id as string;

    const patchedPet = await request(app.getHttpServer())
      .patch(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Toby Editado' })
      .expect(200);
    expect(patchedPet.body).toMatchObject({
      name: 'Toby Editado',
      species: 'dog',
      breed: 'Beagle',
    });

    // 5. Generar código de emparejamiento y listar dispositivos
    await request(app.getHttpServer())
      .post('/api/v1/pairing-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Collar Toby' })
      .expect(201);

    const devicesRes = await request(app.getHttpServer())
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(devicesRes.body.data).toHaveLength(1);
    expect(devicesRes.body.data[0].deviceId).toBe('dev-sim-1');

    // 6. Vincular dispositivo y pedir embed-token
    const linkedRes = await request(app.getHttpServer())
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: 'dev-sim-1' })
      .expect(200);
    expect(linkedRes.body.deviceId).toBe('dev-sim-1');

    const embedRes = await request(app.getHttpServer())
      .post('/api/v1/embed-token')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(embedRes.body.token).toBe('mock-embed-token');

    // 7. Crear zona circular con active=false y verificar que PATCH parcial NO pisa active ni coordenadas
    const zoneRes = await request(app.getHttpServer())
      .post(`/api/v1/pets/${petId}/zones`)
      .set('Authorization', `Bearer ${token}`)
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
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Casa Editada' })
      .expect(200);
    expect(patchedZone.body).toMatchObject({
      name: 'Casa Editada',
      centerLat: -34.603722,
      centerLon: -58.381592,
      radiusMeters: 120,
      active: false,
    });

    // 8. Verificar Swagger JSON expuesto en /api/docs-json con x-variant
    const docsRes = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(docsRes.body.paths['/api/v1/zones'].get['x-variant']).toBe(
      'link-loss-zones',
    );
  });
});
