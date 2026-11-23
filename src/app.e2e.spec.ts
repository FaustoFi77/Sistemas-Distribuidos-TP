import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvenbirdService } from '@ovenbird/node/nest';
import * as request from 'supertest';
import { AuthModule } from './auth/auth.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { ProblemExceptionFilter } from './common/filters/problem-exception.filter';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';
import { DevicesModule } from './devices/devices.module';
import { OvenbirdIntegrationModule } from './ovenbird/ovenbird.integration.module';
import { PetsModule } from './pets/pets.module';
import { ZonesModule } from './zones/zones.module';

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'test-secret-key-32-characters-long',
              JWT_EXPIRES_IN_SECONDS: '86400',
              OVENBIRD_EVENTS_ENABLED: 'false',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
        }),
        OvenbirdIntegrationModule,
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

  it('flujo completo: register -> login -> pets -> pairing -> link -> embed-token -> zones -> monitoring', async () => {
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

    // 3. Auth /me
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.email).toBe('alumno@ejemplo.com');

    // 4. Crear mascota
    const petRes = await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Toby', species: 'dog', breed: 'Beagle' })
      .expect(201);
    const petId = petRes.body.id as string;

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

    // 7. Crear zona segura circular y consultar monitoreo + alertas
    const zoneRes = await request(app.getHttpServer())
      .post(`/api/v1/pets/${petId}/zones`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Casa',
        centerLat: -34.603722,
        centerLon: -58.381592,
        radiusMeters: 120,
      })
      .expect(201);
    expect(zoneRes.body.shape).toBe('circle');

    const zonesList = await request(app.getHttpServer())
      .get('/api/v1/zones')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(zonesList.body.meta.total).toBe(1);

    const monitoring = await request(app.getHttpServer())
      .get(`/api/v1/pets/${petId}/monitoring`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(monitoring.body.zones).toHaveLength(1);

    // 8. Verificar Swagger JSON expuesto en /api/docs-json con x-variant
    const docsRes = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(docsRes.body.paths['/api/v1/zones'].get['x-variant']).toBe(
      'link-loss-zones',
    );
  });
});
