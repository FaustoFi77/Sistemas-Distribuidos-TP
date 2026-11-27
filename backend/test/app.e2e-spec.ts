import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvenbirdService } from '@ovenbird/node/nest';
import * as http from 'http';
import { AddressInfo } from 'net';
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
import { MonitoringService } from '../src/zones/monitoring.service';
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
    await app.listen(0);
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

    const schemas = docsRes.body.components?.schemas ?? {};
    const expectedSchemas = [
      'AuthTokenResponseDto',
      'UserResponseDto',
      'PetResponseDto',
      'PaginatedPetResponseDto',
      'DeviceResponseDto',
      'PaginatedDeviceResponseDto',
      'PairingCodeResponseDto',
      'EmbedTokenResponseDto',
      'CapabilitiesResponseDto',
      'HealthResponseDto',
      'SafeZoneResponseDto',
      'PaginatedSafeZoneResponseDto',
      'AlertResponseDto',
      'PaginatedAlertResponseDto',
      'PetMonitoringResponseDto',
    ];
    for (const schemaName of expectedSchemas) {
      expect(schemas[schemaName]).toBeDefined();
    }
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

  it('rechaza deviceIds vacío ([]) y strings de solo espacios con 400 VALIDATION_ERROR', async () => {
    // RegisterDto con nombre de solo espacios -> 400
    const badReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'espacios@ejemplo.com',
        password: 'Password123!',
        name: '   ',
      })
      .expect(400);
    expect(badReg.body.code).toBe('VALIDATION_ERROR');

    // Crear usuario válido para probar el resto de DTOs
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'validacion@ejemplo.com',
        password: 'Password123!',
        name: 'Validador',
      })
      .expect(201);
    const token = reg.body.accessToken as string;

    // CreatePetDto con name o species solo espacios -> 400
    await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ', species: 'dog' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Boby', species: '   ' })
      .expect(400);

    const petRes = await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Boby', species: 'dog' })
      .expect(201);
    const petId = petRes.body.id as string;

    // CreateZoneDto con name solo espacios -> 400
    await request(app.getHttpServer())
      .post(`/api/v1/pets/${petId}/zones`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '   ',
        centerLat: -34.603722,
        centerLon: -58.381592,
        radiusMeters: 100,
      })
      .expect(400);

    // LinkDeviceDto con deviceId solo espacios -> 400
    await request(app.getHttpServer())
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: '   ' })
      .expect(400);

    // CreateEmbedTokenDto con deviceIds: [] -> 400
    const emptyEmbed = await request(app.getHttpServer())
      .post('/api/v1/embed-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceIds: [] })
      .expect(400);
    expect(emptyEmbed.body.code).toBe('VALIDATION_ERROR');
  });

  it('cubre monitoreo, /alerts, /alerts/:alertId/acknowledge, SSE /alerts/stream, re-evaluación de zonas y DELETEs', async () => {
    const monitoringService = app.get(MonitoringService);

    // Registrar dos usuarios para probar aislamiento en alertas y deletes
    const regOwner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'monitoreo@ejemplo.com',
        password: 'Password123!',
        name: 'Dueño Monitoreo',
      })
      .expect(201);
    const ownerToken = regOwner.body.accessToken as string;

    const regOther = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'otro-monitoreo@ejemplo.com',
        password: 'Password123!',
        name: 'Otro Usuario',
      })
      .expect(201);
    const otherToken = regOther.body.accessToken as string;

    // Crear mascota, vincular collar dev-mon-1 y crear zona segura activa
    const petRes = await request(app.getHttpServer())
      .post('/api/v1/pets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Milo', species: 'dog' })
      .expect(201);
    const petId = petRes.body.id as string;

    ovenbirdMock.devices.get.mockResolvedValueOnce({
      deviceId: 'dev-mon-1',
      name: 'Collar Milo',
      productId: 'ob.lora.unit',
      online: true,
    });
    await request(app.getHttpServer())
      .put(`/api/v1/pets/${petId}/device`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: 'dev-mon-1' })
      .expect(200);

    const zoneRes = await request(app.getHttpServer())
      .post(`/api/v1/pets/${petId}/zones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Parque',
        centerLat: -34.603722,
        centerLon: -58.381592,
        radiusMeters: 100,
      })
      .expect(201);
    const zoneId = zoneRes.body.id as string;

    // 1. Conectar SSE /api/v1/alerts/stream y verificar emisión en vivo de alert.created
    const address = app.getHttpServer().address() as AddressInfo;
    const sseReceived = await new Promise<string>((resolve, reject) => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path: '/api/v1/alerts/stream',
          headers: { Authorization: `Bearer ${ownerToken}` },
        },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('text/event-stream');

          let buffer = '';
          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            if (buffer.includes('ZONE_EXIT')) {
              res.destroy();
              req.destroy();
              resolve(buffer);
            }
          });
          res.on('error', (err) => {
            if (!buffer.includes('ZONE_EXIT')) reject(err);
          });

          // Disparar 2 lecturas fuera de zona (~222 m) + collar_online=false
          const outsideLoc = { lat: -34.605722, lon: -58.381592, fix: '3d' };
          void (async () => {
            await monitoringService.handleOvenbirdEvent({
              id: 'e2e-out-1',
              type: 'device.report',
              data: {
                deviceId: 'dev-mon-1',
                ts: new Date().toISOString(),
                dps: { location: outsideLoc },
              },
            });
            await monitoringService.handleOvenbirdEvent({
              id: 'e2e-out-2',
              type: 'device.report',
              data: {
                deviceId: 'dev-mon-1',
                ts: new Date().toISOString(),
                dps: { location: outsideLoc, collar_online: false },
              },
            });
          })().catch(reject);
        },
      );
      req.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
    expect(sseReceived).toContain('event: alert.created');
    expect(sseReceived).toContain('ZONE_EXIT');

    // 2. GET /pets/:petId/monitoring muestra estado en vivo, zona fuera y 2 alertas activas
    const monRes = await request(app.getHttpServer())
      .get(`/api/v1/pets/${petId}/monitoring`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(monRes.body).toMatchObject({
      petId,
      deviceId: 'dev-mon-1',
      linkStatus: 'offline',
      collarOnline: false,
      insideSafeArea: false,
    });
    expect(monRes.body.zones).toHaveLength(1);
    expect(monRes.body.zones[0].inside).toBe(false);
    expect(monRes.body.activeAlerts).toHaveLength(2);

    // 3. GET /alerts paginado y filtrado + aislamiento multiusuario
    const alertsRes = await request(app.getHttpServer())
      .get(`/api/v1/alerts?petId=${petId}&status=active&type=ZONE_EXIT`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(alertsRes.body.meta.total).toBe(1);
    const zoneAlertId = alertsRes.body.data[0].id as string;
    expect(alertsRes.body.data[0].acknowledged).toBe(false);

    const otherAlerts = await request(app.getHttpServer())
      .get('/api/v1/alerts')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(otherAlerts.body.data).toEqual([]);

    // 4. POST /alerts/:alertId/acknowledge (200 dueño, 404 ajeno)
    const ackRes = await request(app.getHttpServer())
      .post(`/api/v1/alerts/${zoneAlertId}/acknowledge`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(ackRes.body.acknowledged).toBe(true);
    expect(ackRes.body.acknowledgedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/alerts/${zoneAlertId}/acknowledge`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    // 5. Re-evaluación al ampliar radio por PATCH /zones/:zoneId -> ZONE_EXIT se resuelve inmediatamente
    await request(app.getHttpServer())
      .patch(`/api/v1/zones/${zoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ radiusMeters: 500 })
      .expect(200);

    const monAfterExpand = await request(app.getHttpServer())
      .get(`/api/v1/pets/${petId}/monitoring`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(monAfterExpand.body.insideSafeArea).toBe(true);
    expect(monAfterExpand.body.activeAlerts).toHaveLength(1);
    expect(monAfterExpand.body.activeAlerts[0].type).toBe('LINK_LOSS');

    // 6. DELETE /zones/:zoneId (404 ajeno, 204 dueño, 404 repetido)
    await request(app.getHttpServer())
      .delete(`/api/v1/zones/${zoneId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/zones/${zoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/zones/${zoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);

    // 7. DELETE /pets/:petId/device -> 204, limpia estado runtime y resuelve LINK_LOSS activa
    await request(app.getHttpServer())
      .delete(`/api/v1/pets/${petId}/device`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    const monAfterUnlink = await request(app.getHttpServer())
      .get(`/api/v1/pets/${petId}/monitoring`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(monAfterUnlink.body).toMatchObject({
      petId,
      deviceId: null,
      linkStatus: 'unknown',
      collarOnline: null,
      bridgeOnline: null,
      lastLocation: null,
      activeAlerts: [],
    });

    const resolvedAlerts = await request(app.getHttpServer())
      .get(`/api/v1/alerts?petId=${petId}&status=resolved`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(resolvedAlerts.body.meta.total).toBe(2);

    // 8. DELETE /pets/:petId -> 404 ajeno, 204 dueño, luego GET -> 404
    await request(app.getHttpServer())
      .delete(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/pets/${petId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
