import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OvenbirdService } from '@ovenbird/node/nest';
import { DomainEventsService } from '../common/events/domain-events.service';
import { Pet } from '../pets/entities/pet.entity';
import { PetsService } from '../pets/pets.service';
import { Alert } from './entities/alert.entity';
import { SafeZone } from './entities/safe-zone.entity';
import { haversineDistanceMeters } from './geo.utils';
import { MonitoringService } from './monitoring.service';
import { ZonesService } from './zones.service';

describe('MonitoringService (Variante Grupo 3: link-loss-zones)', () => {
  let service: MonitoringService;
  let domainEvents: DomainEventsService;
  let petsRepo: { findOne: jest.Mock };
  let petsServiceMock: { findOneEntityForUser: jest.Mock };
  let alertsRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let zonesService: { findActiveEntitiesForPet: jest.Mock };
  let ovenbirdDevicesStatus: jest.Mock;
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
    domainEvents = new DomainEventsService();

    petsRepo = {
      findOne: jest.fn().mockResolvedValue(pet),
    };
    petsServiceMock = {
      findOneEntityForUser: jest.fn().mockResolvedValue(pet),
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
      find: jest.fn(async ({ where } = {}) =>
        storedAlerts.filter(
          (a) =>
            (!where?.petId || a.petId === where.petId) &&
            (!where?.status || a.status === where.status),
        ),
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
    ovenbirdDevicesStatus = jest.fn().mockResolvedValue({
      deviceId: 'dev-1',
      online: false,
      lastSeenAt: null,
      dps: {},
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: OvenbirdService,
          useValue: {
            events: { subscribe: jest.fn() },
            devices: { status: ovenbirdDevicesStatus },
          },
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
        { provide: PetsService, useValue: petsServiceMock },
        { provide: ZonesService, useValue: zonesService },
        { provide: getRepositoryToken(Pet), useValue: petsRepo },
        { provide: getRepositoryToken(Alert), useValue: alertsRepo },
        { provide: DomainEventsService, useValue: domainEvents },
      ],
    }).compile();

    service = moduleRef.get(MonitoringService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('calcula correctamente distancias con Haversine (incluyendo antípodas sin NaN)', () => {
    // 0.001 grados de latitud equivale aprox. a ~111 metros
    const dist = haversineDistanceMeters(
      -34.603722,
      -58.381592,
      -34.604722,
      -58.381592,
    );
    expect(dist).toBeGreaterThan(105);
    expect(dist).toBeLessThan(118);

    const antipodal = haversineDistanceMeters(0, 0, 0, 180);
    expect(Number.isFinite(antipodal)).toBe(true);
    expect(antipodal).toBeGreaterThan(20_000_000);
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
    await jest.advanceTimersByTimeAsync(30_000);

    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0].type).toBe('LINK_LOSS');
    expect(storedAlerts[0].status).toBe('active');
  });

  it('auto-resuelve LINK_LOSS por device.offline si llega un device.report sin collar_online (sin pisar collar_online=false)', async () => {
    jest.useFakeTimers();

    // 1. Cae el puente (>30 s) -> LINK_LOSS activa (collarOnline sigue null)
    await service.handleOvenbirdEvent({
      id: 'e-off-1',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0].type).toBe('LINK_LOSS');
    expect(storedAlerts[0].status).toBe('active');

    // 2. Reconecta enviando un device.report solo con GPS (sin DP collar_online y sin device.online previo)
    await service.handleOvenbirdEvent({
      id: 'e-rep-gps',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: { lat: -34.603722, lon: -58.381592, fix: '3d' } },
      },
    });
    expect(storedAlerts[0].status).toBe('resolved');
    expect(storedAlerts[0].resolvedAt).not.toBeNull();

    // 3. Si la pérdida fue por collar_online=false, un report sin collar_online NO debe resolverla
    await service.handleOvenbirdEvent({
      id: 'e-collar-off',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { collar_online: false },
      },
    });
    expect(storedAlerts).toHaveLength(2);
    expect(storedAlerts[1].status).toBe('active');

    await service.handleOvenbirdEvent({
      id: 'e-rep-gps-2',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: { lat: -34.603722, lon: -58.381592, fix: '3d' } },
      },
    });
    expect(storedAlerts[1].status).toBe('active');
  });

  it('cancela el timer de gracia, limpia el estado en memoria y resuelve alertas al desvincular collar', async () => {
    jest.useFakeTimers();

    // Reporte inicial con ubicación y alerta LINK_LOSS por collar_online=false + offline grace pendiente
    await service.handleOvenbirdEvent({
      id: 'e-init',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: {
          collar_online: false,
          location: { lat: -34.603722, lon: -58.381592, fix: '3d' },
        },
      },
    });
    await service.handleOvenbirdEvent({
      id: 'e-off',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0].status).toBe('active');

    // Se desvincula el collar durante la ventana de gracia
    petsServiceMock.findOneEntityForUser.mockResolvedValue({
      ...pet,
      deviceId: null,
    });
    await domainEvents.emit('pet.device.unlinked', {
      petId: 'pet-1',
      userId: 'user-1',
    });

    // Avanzar más de 30 s no debe disparar nuevas alertas
    await jest.advanceTimersByTimeAsync(35_000);
    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0].status).toBe('resolved');

    // GET /pets/:petId/monitoring refleja estado limpio
    const status = await service.getPetMonitoringStatus('user-1', 'pet-1');
    expect(status.deviceId).toBeNull();
    expect(status.linkStatus).toBe('unknown');
    expect(status.collarOnline).toBeNull();
    expect(status.bridgeOnline).toBeNull();
    expect(status.lastLocation).toBeNull();
    expect(status.activeAlerts).toEqual([]);
  });

  it('revalida en DB en el timer de gracia para no alertar si se borró la mascota o cambió el collar', async () => {
    jest.useFakeTimers();

    // Caso 1: pet borrada en DB (o evento pet.deleted)
    await service.handleOvenbirdEvent({
      id: 'e-off-del',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    petsRepo.findOne.mockResolvedValue(null);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(storedAlerts).toHaveLength(0);

    // Caso 2: collar desvinculado/cambiado en DB antes de vencer la gracia
    petsRepo.findOne.mockResolvedValue(pet);
    await service.handleOvenbirdEvent({
      id: 'e-off-unlink',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    petsRepo.findOne.mockResolvedValue({ ...pet, deviceId: null });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(storedAlerts).toHaveLength(0);

    // Caso 3: evento pet.deleted limpia estado y cancela timer
    petsRepo.findOne.mockResolvedValue(pet);
    await service.handleOvenbirdEvent({
      id: 'e-off-evt',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    await domainEvents.emit('pet.deleted', { petId: 'pet-1' });
    await jest.advanceTimersByTimeAsync(35_000);
    expect(storedAlerts).toHaveLength(0);
  });

  it('re-evalúa zonas respetando el margen interior de histéresis (10%) y resuelve ZONE_EXIT al ampliar suficiente o quitar zonas', async () => {
    const outsideLoc = { lat: -34.605722, lon: -58.381592, fix: '3d' }; // ~222.4 m
    await service.handleOvenbirdEvent({
      id: 'z-out-1',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: outsideLoc },
      },
    });
    await service.handleOvenbirdEvent({
      id: 'z-out-2',
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

    // Ampliar el radio a 230 m: la mascota queda dentro de 230 m (resetea lecturas fuera),
    // pero fuera del margen interior de histéresis (230 * 0.9 = 207 m < 222.4 m) -> sigue activa
    zonesService.findActiveEntitiesForPet.mockResolvedValue([
      { ...homeZone, radiusMeters: 230 },
    ]);
    await domainEvents.emit('pet.zones.changed', { petId: 'pet-1' });
    expect(storedAlerts[0].status).toBe('active');

    // Ampliar el radio de Casa a 300 m (300 * 0.9 = 270 m >= 222.4 m) -> resuelve ZONE_EXIT inmediatamente
    zonesService.findActiveEntitiesForPet.mockResolvedValue([
      { ...homeZone, radiusMeters: 300 },
    ]);
    await domainEvents.emit('pet.zones.changed', { petId: 'pet-1' });
    expect(storedAlerts[0].status).toBe('resolved');

    // Volver a radio 100 m, disparar otra ZONE_EXIT y eliminar/desactivar todas las zonas
    zonesService.findActiveEntitiesForPet.mockResolvedValue([homeZone]);
    await service.handleOvenbirdEvent({
      id: 'z-out-3',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: outsideLoc },
      },
    });
    await service.handleOvenbirdEvent({
      id: 'z-out-4',
      type: 'device.report',
      data: {
        deviceId: 'dev-1',
        ts: new Date().toISOString(),
        dps: { location: outsideLoc },
      },
    });
    expect(storedAlerts).toHaveLength(2);
    expect(storedAlerts[1].status).toBe('active');

    zonesService.findActiveEntitiesForPet.mockResolvedValue([]);
    await domainEvents.emit('pet.zones.changed', { petId: 'pet-1' });
    expect(storedAlerts[1].status).toBe('resolved');
  });

  it('hidrata en frío el estado desde ob.devices.status cuando la memoria está virgen y tolera fallos del SDK sin romper el 200', async () => {
    const seenAt = new Date('2026-06-01T15:00:00.000Z');
    const locTs = new Date('2026-06-01T14:59:50.000Z');

    // 1. Si Ovenbird lanza error en frío, registra warn y devuelve 200 con estado unknown
    ovenbirdDevicesStatus.mockRejectedValueOnce(new Error('Timeout Ovenbird'));
    const fallbackStatus = await service.getPetMonitoringStatus(
      'user-1',
      'pet-1',
    );
    expect(fallbackStatus.linkStatus).toBe('unknown');
    expect(fallbackStatus.lastLocation).toBeNull();

    // 2. Como sigue virgen, el siguiente llamado hidrata desde Ovenbird Cloud
    ovenbirdDevicesStatus.mockResolvedValueOnce({
      deviceId: 'dev-1',
      online: true,
      lastSeenAt: seenAt,
      dps: {
        collar_online: { value: true, ts: seenAt },
        location: {
          value: { lat: -34.603722, lon: -58.381592, hdop: 1.1, fix: '3d' },
          ts: locTs,
        },
      },
    });

    const hydrated = await service.getPetMonitoringStatus('user-1', 'pet-1');
    expect(ovenbirdDevicesStatus).toHaveBeenCalledTimes(2);
    expect(hydrated).toMatchObject({
      petId: 'pet-1',
      deviceId: 'dev-1',
      linkStatus: 'online',
      bridgeOnline: true,
      collarOnline: true,
      lastSeenAt: seenAt.toISOString(),
      insideSafeArea: true,
      lastLocation: {
        lat: -34.603722,
        lon: -58.381592,
        hdop: 1.1,
        fix: '3d',
        ts: locTs.toISOString(),
      },
    });

    // 3. Llamadas subsiguientes usan el estado en memoria sin volver a consultar ob.devices.status
    await service.getPetMonitoringStatus('user-1', 'pet-1');
    expect(ovenbirdDevicesStatus).toHaveBeenCalledTimes(2);

    // 4. Descarta ubicación con fix="none" durante hidratación en frío
    petsServiceMock.findOneEntityForUser.mockResolvedValueOnce({
      id: 'pet-2',
      userId: 'user-1',
      name: 'Milo',
      deviceId: 'dev-2',
    });
    ovenbirdDevicesStatus.mockResolvedValueOnce({
      deviceId: 'dev-2',
      online: true,
      lastSeenAt: null,
      dps: {
        location: {
          value: { lat: 0, lon: 0, fix: 'none' },
          ts: seenAt,
        },
      },
    });
    const noFixHydrated = await service.getPetMonitoringStatus(
      'user-1',
      'pet-2',
    );
    expect(noFixHydrated.bridgeOnline).toBe(true);
    expect(noFixHydrated.lastLocation).toBeNull();
  });

  it('tolera variables de entorno numéricas inválidas sin producir NaN', async () => {
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
            get: (key: string) => {
              if (key === 'OVENBIRD_EVENTS_ENABLED') return 'false';
              return 'not-a-number';
            },
          },
        },
        { provide: PetsService, useValue: petsServiceMock },
        { provide: ZonesService, useValue: zonesService },
        { provide: getRepositoryToken(Pet), useValue: petsRepo },
        { provide: getRepositoryToken(Alert), useValue: alertsRepo },
      ],
    }).compile();

    const safeService = moduleRef.get(MonitoringService);
    jest.useFakeTimers();

    await safeService.handleOvenbirdEvent({
      id: 'nan-off',
      type: 'device.offline',
      data: { deviceId: 'dev-1', ts: new Date().toISOString() },
    });
    // Con fallback seguro de 30 s, a los 10 s todavía no debe disparar alerta
    await jest.advanceTimersByTimeAsync(10_000);
    expect(storedAlerts).toHaveLength(0);

    await jest.advanceTimersByTimeAsync(20_000);
    expect(storedAlerts).toHaveLength(1);
    safeService.onModuleDestroy();
  });
});
