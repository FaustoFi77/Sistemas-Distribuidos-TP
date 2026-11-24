import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OvenbirdService } from '@ovenbird/node/nest';
import { Pet } from '../pets/entities/pet.entity';
import { PetsService } from '../pets/pets.service';
import { Alert } from './entities/alert.entity';
import { SafeZone } from './entities/safe-zone.entity';
import { haversineDistanceMeters } from './geo.utils';
import { MonitoringService } from './monitoring.service';
import { ZonesService } from './zones.service';

describe('MonitoringService (Variante Grupo 3: link-loss-zones)', () => {
  let service: MonitoringService;
  let petsRepo: { findOne: jest.Mock };
  let alertsRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let zonesService: { findActiveEntitiesForPet: jest.Mock };
  let storedAlerts: Alert[];

  const pet: Partial<Pet> = {
    id: 'pet-1',
    userId: 'user-1',
    name: 'Luna',
    deviceId: 'dev-1',
  };

  // Zona circular centrada en el Obelisco (-34.603722, -58.381592), radio 100 m
  const homeZone: Partial<SafeZone> = {
    id: 'zone-casa',
    userId: 'user-1',
    petId: 'pet-1',
    name: 'Casa',
    centerLat: -34.603722,
    centerLon: -58.381592,
    radiusMeters: 100,
    active: true,
  };

  beforeEach(async () => {
    storedAlerts = [];

    petsRepo = {
      findOne: jest.fn().mockResolvedValue(pet),
    };
    alertsRepo = {
      findOne: jest.fn(
        async ({ where }) =>
          storedAlerts.find(
            (a) =>
              (!where.petId || a.petId === where.petId) &&
              (!where.type || a.type === where.type) &&
              (!where.status || a.status === where.status),
          ) ?? null,
      ),
      find: jest.fn(async () =>
        storedAlerts.filter((a) => a.status === 'active'),
      ),
      findAndCount: jest.fn(async () => [storedAlerts, storedAlerts.length]),
      create: jest.fn((data) => ({
        id: `alert-${storedAlerts.length + 1}`,
        triggeredAt: new Date(),
        ...data,
      })),
      save: jest.fn(async (entity: Alert) => {
        const idx = storedAlerts.findIndex((a) => a.id === entity.id);
        if (idx >= 0) {
          storedAlerts[idx] = entity;
        } else {
          storedAlerts.push(entity);
        }
        return entity;
      }),
    };
    zonesService = {
      findActiveEntitiesForPet: jest.fn().mockResolvedValue([homeZone]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: OvenbirdService,
          useValue: { events: { subscribe: jest.fn() } },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def: string) => {
              if (key === 'OVENBIRD_EVENTS_ENABLED') return 'false';
              if (key === 'ZONE_CONSECUTIVE_OUTSIDE_READINGS') return '2';
              if (key === 'ZONE_HYSTERESIS_RATIO') return '0.1';
              if (key === 'LINK_LOSS_GRACE_SECONDS') return '30';
              return def;
            },
          },
        },
        { provide: PetsService, useValue: { findOneEntityForUser: jest.fn() } },
        { provide: ZonesService, useValue: zonesService },
        { provide: getRepositoryToken(Pet), useValue: petsRepo },
        { provide: getRepositoryToken(Alert), useValue: alertsRepo },
      ],
    }).compile();

    service = moduleRef.get(MonitoringService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('calcula correctamente distancias con Haversine', () => {
    // 0.001 grados de latitud equivale aprox. a ~111 metros
    const dist = haversineDistanceMeters(
      -34.603722,
      -58.381592,
      -34.604722,
      -58.381592,
    );
    expect(dist).toBeGreaterThan(105);
    expect(dist).toBeLessThan(118);
  });

  it('descarta lecturas GPS con fix="none" sin disparar falsas alarmas', async () => {
    await service.handleOvenbirdEvent({
      id: 'e1',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: { lat: 0, lon: 0, fix: 'none' } },
      },
    });
    await service.handleOvenbirdEvent({
      id: 'e2',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: { lat: 0, lon: 0, fix: 'none' } },
      },
    });

    expect(storedAlerts).toHaveLength(0);
  });

  it('es idempotente ante eventos SSE repetidos con el mismo event.id (no los cuenta doble)', async () => {
    const outsideLoc = { lat: -34.605722, lon: -58.381592, fix: '3d' };
    const duplicatedEvent = {
      id: 'evt-duplicado-1',
      type: 'device.report' as const,
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: outsideLoc },
      },
    };

    // Llega el mismo evento dos veces por reconexión SSE -> debe contar como 1 sola lectura
    await service.handleOvenbirdEvent(duplicatedEvent);
    await service.handleOvenbirdEvent(duplicatedEvent);

    expect(storedAlerts).toHaveLength(0);
  });

  it('exige 2 lecturas consecutivas fuera para alertar ZONE_EXIT y aplica histéresis del 10% al volver', async () => {
    // Punto a ~222 m del centro (claramente fuera del radio de 100 m)
    const outsideLoc = { lat: -34.605722, lon: -58.381592, fix: '3d' };

    // 1ra lectura fuera -> NO debe disparar alerta todavía (evita saltos breves de GPS)
    await service.handleOvenbirdEvent({
      id: 'e1',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: outsideLoc },
      },
    });
    expect(storedAlerts).toHaveLength(0);

    // 2da lectura consecutiva fuera -> SÍ dispara alerta ZONE_EXIT
    await service.handleOvenbirdEvent({
      id: 'e2',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: outsideLoc },
      },
    });
    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0].type).toBe('ZONE_EXIT');
    expect(storedAlerts[0].status).toBe('active');

    // Vuelve a ~95 m del centro (adentro de 100 m, pero fuera del umbral de histéresis de 90 m) -> sigue activa
    const borderLoc = { lat: -34.604575, lon: -58.381592, fix: '3d' };
    await service.handleOvenbirdEvent({
      id: 'e3',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: borderLoc },
      },
    });
    expect(storedAlerts[0].status).toBe('active');

    // Vuelve al centro (0 m <= 90 m) -> se resuelve la alerta
    const centerLoc = { lat: -34.603722, lon: -58.381592, fix: '3d' };
    await service.handleOvenbirdEvent({
      id: 'e4',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: centerLoc },
      },
    });
    expect(storedAlerts[0].status).toBe('resolved');
    expect(storedAlerts[0].resolvedAt).not.toBeNull();
  });

  it('dispara LINK_LOSS inmediato ante collar_online=false y la resuelve al reconectar', async () => {
    await service.handleOvenbirdEvent({
      id: 'e1',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { collar_online: false },
      },
    });

    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0].type).toBe('LINK_LOSS');
    expect(storedAlerts[0].status).toBe('active');

    await service.handleOvenbirdEvent({
      id: 'e2',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { collar_online: true },
      },
    });

    expect(storedAlerts[0].status).toBe('resolved');
  });

  it('evita falsas alarmas ante microcortes de device.offline (< 30 s) y alerta si persiste', async () => {
    jest.useFakeTimers();

    // Se desconecta el puente/app móvil y vuelve a los 15 s -> NO debe haber alerta
    await service.handleOvenbirdEvent({
      id: 'e1',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    jest.advanceTimersByTime(15_000);
    await service.handleOvenbirdEvent({
      id: 'e2',
      type: 'device.online',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    jest.advanceTimersByTime(30_000);
    expect(storedAlerts).toHaveLength(0);

    // Ahora se desconecta y NO vuelve en 30 s -> SÍ dispara alerta LINK_LOSS
    await service.handleOvenbirdEvent({
      id: 'e3',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0].type).toBe('LINK_LOSS');
    expect(storedAlerts[0].status).toBe('active');
  });
});
