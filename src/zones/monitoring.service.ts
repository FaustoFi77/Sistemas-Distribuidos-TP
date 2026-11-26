import {
  HttpStatus,
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { isLocation, OvenbirdEvent } from '@ovenbird/node';
import { OvenbirdService } from '@ovenbird/node/nest';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../common/dto/pagination.dto';
import { DomainEventsService } from '../common/events/domain-events.service';
import { ProblemException } from '../common/exceptions/problem.exception';
import { parseFiniteEnvNumber } from '../config/env.validation';
import { Pet } from '../pets/entities/pet.entity';
import { PetsService } from '../pets/pets.service';
import {
  AlertQueryDto,
  AlertResponse,
  PetMonitoringResponse,
  ZoneEvaluationItem,
} from './dto/zone.dto';
import { Alert, AlertType } from './entities/alert.entity';
import { haversineDistanceMeters, isValidCoordinate } from './geo.utils';
import { ZonesService } from './zones.service';

interface PetRuntimeState {
  lastLocation: {
    lat: number;
    lon: number;
    hdop?: number;
    fix?: string;
    ts: string;
  } | null;
  consecutiveOutsideCount: number;
  collarOnline: boolean | null;
  bridgeOnline: boolean | null;
  lastSeenAt: string | null;
  offlineGraceTimer?: ReturnType<typeof setTimeout>;
}

interface RealtimeStreamEvent {
  userId: string;
  eventType: 'alert.created' | 'alert.resolved' | 'monitoring.updated';
  payload: unknown;
}

const MAX_PROCESSED_EVENT_IDS = 1000;

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly runtimeByPetId = new Map<string, PetRuntimeState>();
  private readonly processedEventIds = new Set<string>();
  private readonly stream$ = new Subject<RealtimeStreamEvent>();
  private readonly domainEventUnsubscribers: Array<() => void> = [];
  private subscription?: { close: () => void };

  private readonly consecutiveOutsideThreshold: number;
  private readonly hysteresisRatio: number;
  private readonly linkLossGraceMs: number;

  constructor(
    private readonly ovenbird: OvenbirdService,
    private readonly config: ConfigService,
    private readonly petsService: PetsService,
    private readonly zonesService: ZonesService,
    @InjectRepository(Pet)
    private readonly petsRepo: Repository<Pet>,
    @InjectRepository(Alert)
    private readonly alertsRepo: Repository<Alert>,
    @Optional()
    private readonly domainEvents?: DomainEventsService,
  ) {
    this.consecutiveOutsideThreshold = parseFiniteEnvNumber(
      this.config.get<string>('ZONE_CONSECUTIVE_OUTSIDE_READINGS', '2'),
      2,
      { min: 1 },
    );
    this.hysteresisRatio = parseFiniteEnvNumber(
      this.config.get<string>('ZONE_HYSTERESIS_RATIO', '0.1'),
      0.1,
      { min: 0, max: 0.5 },
    );
    this.linkLossGraceMs =
      parseFiniteEnvNumber(
        this.config.get<string>('LINK_LOSS_GRACE_SECONDS', '30'),
        30,
        { min: 0 },
      ) * 1000;
  }

  onModuleInit(): void {
    if (this.domainEvents) {
      this.domainEventUnsubscribers.push(
        this.domainEvents.on('pet.deleted', ({ petId }) => {
          this.handlePetDeleted(petId);
        }),
        this.domainEvents.on(
          'pet.device.unlinked',
          async ({ petId, userId }) => {
            await this.handleDeviceUnlinked(petId, userId);
          },
        ),
        this.domainEvents.on('pet.zones.changed', async ({ petId }) => {
          await this.reevaluateZonesForPet(petId);
        }),
      );
    }

    const enabled =
      this.config.get<string>('OVENBIRD_EVENTS_ENABLED', 'true') === 'true';
    const clientId = this.config.get<string>('OVENBIRD_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('OVENBIRD_CLIENT_SECRET', '');

    if (
      !enabled ||
      !clientId ||
      !clientSecret ||
      clientId.startsWith('placeholder') ||
      clientId.startsWith('tu-')
    ) {
      this.logger.log(
        'Suscripción SSE a Ovenbird deshabilitada (configurá OVENBIRD_EVENTS_ENABLED=true y credenciales reales para activarla).',
      );
      return;
    }

    this.logger.log(
      'Iniciando suscripción SSE a eventos de Ovenbird IoT Cloud...',
    );
    this.subscription = this.ovenbird.events.subscribe({
      types: ['device.report', 'device.online', 'device.offline'],
      onEvent: (event) => {
        void this.handleOvenbirdEvent(event).catch((err) => {
          this.logger.error(
            `Error procesando evento ${event.type}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      },
      onError: (err) => {
        this.logger.warn(
          `Interrupción en el stream de Ovenbird (el SDK reintentará automáticamente): ${err.message}`,
        );
      },
    });
  }

  onModuleDestroy(): void {
    while (this.domainEventUnsubscribers.length > 0) {
      const unsubscribe = this.domainEventUnsubscribers.pop();
      unsubscribe?.();
    }
    if (this.subscription) {
      this.subscription.close();
      this.subscription = undefined;
    }
    for (const state of this.runtimeByPetId.values()) {
      if (state.offlineGraceTimer) {
        clearTimeout(state.offlineGraceTimer);
        state.offlineGraceTimer = undefined;
      }
    }
    this.stream$.complete();
  }

  streamEventsForUser(userId: string): Observable<MessageEvent> {
    return this.stream$.asObservable().pipe(
      filter((evt) => evt.userId === userId),
      map((evt): MessageEvent => ({
        type: evt.eventType,
        data: evt.payload as string | object,
      })),
    );
  }

  async listAlertsForUser(
    userId: string,
    query: AlertQueryDto,
  ): Promise<PaginatedResponse<AlertResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: FindOptionsWhere<Alert> = { userId };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.petId) {
      await this.petsService.findOneEntityForUser(userId, query.petId);
      where.petId = query.petId;
    }

    const [items, total] = await this.alertsRepo.findAndCount({
      where,
      order: { triggeredAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((a) => this.toAlertResponse(a)),
      meta: { page, limit, total },
    };
  }

  async acknowledgeAlert(
    userId: string,
    alertId: string,
  ): Promise<AlertResponse> {
    const alert = await this.alertsRepo.findOne({
      where: { id: alertId, userId },
    });
    if (!alert) {
      throw new ProblemException({
        status: HttpStatus.NOT_FOUND,
        code: 'ALERT_NOT_FOUND',
        title: 'Not Found',
        detail: 'La alerta solicitada no existe.',
      });
    }

    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      await this.alertsRepo.save(alert);
    }

    return this.toAlertResponse(alert);
  }

  async getPetMonitoringStatus(
    userId: string,
    petId: string,
  ): Promise<PetMonitoringResponse> {
    const pet = await this.petsService.findOneEntityForUser(userId, petId);
    const state = this.getOrInitState(pet.id);

    if (
      pet.deviceId &&
      state.lastLocation === null &&
      state.lastSeenAt === null &&
      state.bridgeOnline === null &&
      state.collarOnline === null &&
      typeof this.ovenbird.devices?.status === 'function'
    ) {
      await this.hydrateRuntimeStateFromCloud(pet.deviceId, state);
    }

    const activeZones = await this.zonesService.findActiveEntitiesForPet(
      pet.id,
    );
    const activeAlerts = await this.alertsRepo.find({
      where: { userId, petId: pet.id, status: 'active' },
      order: { triggeredAt: 'DESC', id: 'ASC' },
    });

    const evaluatedZones: ZoneEvaluationItem[] = activeZones.map((zone) => {
      if (!state.lastLocation) {
        return {
          zoneId: zone.id,
          name: zone.name,
          centerLat: zone.centerLat,
          centerLon: zone.centerLon,
          radiusMeters: zone.radiusMeters,
          distanceMeters: null,
          inside: null,
        };
      }
      const dist = haversineDistanceMeters(
        state.lastLocation.lat,
        state.lastLocation.lon,
        zone.centerLat,
        zone.centerLon,
      );
      return {
        zoneId: zone.id,
        name: zone.name,
        centerLat: zone.centerLat,
        centerLon: zone.centerLon,
        radiusMeters: zone.radiusMeters,
        distanceMeters: Math.round(dist * 10) / 10,
        inside: dist <= zone.radiusMeters,
      };
    });

    let insideSafeArea: boolean | null = null;
    if (state.lastLocation && evaluatedZones.length > 0) {
      insideSafeArea = evaluatedZones.some((z) => z.inside === true);
    }

    let linkStatus: 'online' | 'offline' | 'unknown' = 'unknown';
    if (state.collarOnline === false || state.bridgeOnline === false) {
      linkStatus = 'offline';
    } else if (state.collarOnline === true || state.bridgeOnline === true) {
      linkStatus = 'online';
    }

    return {
      petId: pet.id,
      deviceId: pet.deviceId ?? null,
      linkStatus,
      collarOnline: state.collarOnline,
      bridgeOnline: state.bridgeOnline,
      lastSeenAt: state.lastSeenAt,
      lastLocation: state.lastLocation,
      insideSafeArea,
      zones: evaluatedZones,
      activeAlerts: activeAlerts.map((a) => this.toAlertResponse(a)),
    };
  }

  handlePetDeleted(petId: string): void {
    const state = this.runtimeByPetId.get(petId);
    if (state) {
      this.cancelOfflineGraceTimer(state);
      this.runtimeByPetId.delete(petId);
    }
  }

  async handleDeviceUnlinked(petId: string, userId: string): Promise<void> {
    const state = this.runtimeByPetId.get(petId);
    if (state) {
      this.cancelOfflineGraceTimer(state);
      this.runtimeByPetId.delete(petId);
    }

    const activeAlerts = await this.alertsRepo.find({
      where: { petId, status: 'active' },
    });
    for (const alert of activeAlerts) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      const saved = await this.alertsRepo.save(alert);
      this.stream$.next({
        userId: alert.userId,
        eventType: 'alert.resolved',
        payload: this.toAlertResponse(saved),
      });
    }

    this.stream$.next({
      userId,
      eventType: 'monitoring.updated',
      payload: {
        petId,
        deviceId: null,
        collarOnline: null,
        bridgeOnline: null,
        lastSeenAt: null,
        lastLocation: null,
      },
    });
  }

  async reevaluateZonesForPet(petId: string): Promise<void> {
    const pet = await this.petsRepo.findOne({ where: { id: petId } });
    if (!pet) {
      return;
    }

    const state = this.runtimeByPetId.get(petId);
    const activeZones = await this.zonesService.findActiveEntitiesForPet(petId);

    if (activeZones.length === 0) {
      if (state) {
        state.consecutiveOutsideCount = 0;
      }
      await this.resolveActiveAlert(pet, 'ZONE_EXIT');
      this.emitMonitoringUpdate(pet);
      return;
    }

    if (!state?.lastLocation) {
      return;
    }

    const { lat, lon } = state.lastLocation;
    const distances = activeZones.map((zone) => ({
      zone,
      distanceMeters: haversineDistanceMeters(
        lat,
        lon,
        zone.centerLat,
        zone.centerLon,
      ),
    }));

    const insideAny = distances.some(
      (item) => item.distanceMeters <= item.zone.radiusMeters,
    );

    if (insideAny) {
      state.consecutiveOutsideCount = 0;

      const insideWithHysteresis = distances.some(
        (item) =>
          item.distanceMeters <=
          item.zone.radiusMeters * (1 - this.hysteresisRatio),
      );
      if (insideWithHysteresis) {
        await this.resolveActiveAlert(pet, 'ZONE_EXIT');
      }
    }

    this.emitMonitoringUpdate(pet);
  }

  private async hydrateRuntimeStateFromCloud(
    deviceId: string,
    state: PetRuntimeState,
  ): Promise<void> {
    try {
      const status = await this.ovenbird.devices.status(deviceId);
      if (state.bridgeOnline === null && typeof status.online === 'boolean') {
        state.bridgeOnline = status.online;
      }
      if (state.lastSeenAt === null) {
        state.lastSeenAt = status.lastSeenAt
          ? status.lastSeenAt.toISOString()
          : null;
      }
      if (
        state.collarOnline === null &&
        typeof status.dps?.collar_online?.value === 'boolean'
      ) {
        state.collarOnline = status.dps.collar_online.value;
      }
      const locationDp = status.dps?.location;
      if (
        state.lastLocation === null &&
        locationDp?.value !== undefined &&
        isLocation(locationDp.value)
      ) {
        const loc = locationDp.value;
        if (loc.fix !== 'none' && isValidCoordinate(loc.lat, loc.lon)) {
          state.lastLocation = {
            lat: loc.lat,
            lon: loc.lon,
            hdop: loc.hdop,
            fix: loc.fix,
            ts:
              locationDp.ts instanceof Date
                ? locationDp.ts.toISOString()
                : new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo hidratar estado inicial del dispositivo ${deviceId} desde Ovenbird: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Procesa un evento proveniente de Ovenbird IoT Cloud de forma idempotente.
   * Expuesto como método público para facilitar pruebas unitarias determinísticas con Jest.
   */
  async handleOvenbirdEvent(event: OvenbirdEvent): Promise<void> {
    if (event.id) {
      if (this.processedEventIds.has(event.id)) {
        return;
      }
      this.recordProcessedEventId(event.id);
    }

    if (event.type === 'command.updated') {
      return;
    }

    const deviceId = event.data.deviceId;
    const pet = await this.petsRepo.findOne({ where: { deviceId } });
    if (!pet) {
      return;
    }

    const state = this.getOrInitState(pet.id);

    if (event.type === 'device.offline') {
      state.bridgeOnline = false;
      this.scheduleBridgeOfflineGrace(pet, deviceId, event.data.ts);
      this.emitMonitoringUpdate(pet);
      return;
    }

    if (event.type === 'device.online') {
      state.bridgeOnline = true;
      state.lastSeenAt = event.data.ts;
      this.cancelOfflineGraceTimer(state);
      if (state.collarOnline !== false) {
        await this.resolveActiveAlert(pet, 'LINK_LOSS');
      }
      this.emitMonitoringUpdate(pet);
      return;
    }

    if (event.type === 'device.report') {
      state.bridgeOnline = true;
      state.lastSeenAt = event.data.ts;
      this.cancelOfflineGraceTimer(state);

      const dps = event.data.dps ?? {};

      // 1. Evaluación de pérdida de enlace (collar_online)
      if (typeof dps.collar_online === 'boolean') {
        state.collarOnline = dps.collar_online;
        if (dps.collar_online === false) {
          await this.openAlertIfAbsent({
            pet,
            deviceId,
            zoneId: null,
            type: 'LINK_LOSS',
            message: `Se perdió el enlace LoRa con el collar de ${pet.name}.`,
            details: { reason: 'collar_offline', ts: event.data.ts },
          });
        } else {
          await this.resolveActiveAlert(pet, 'LINK_LOSS');
        }
      } else if (state.collarOnline !== false) {
        await this.resolveActiveAlert(pet, 'LINK_LOSS');
      }

      // 2. Evaluación de ubicación respecto a zonas seguras circulares
      if (dps.location !== undefined && isLocation(dps.location)) {
        const loc = dps.location;
        if (loc.fix !== 'none' && isValidCoordinate(loc.lat, loc.lon)) {
          state.lastLocation = {
            lat: loc.lat,
            lon: loc.lon,
            hdop: loc.hdop,
            fix: loc.fix,
            ts: event.data.ts,
          };
          await this.evaluateZonesForPet(pet, deviceId, state);
        }
      }

      this.emitMonitoringUpdate(pet);
    }
  }

  private async evaluateZonesForPet(
    pet: Pet,
    deviceId: string,
    state: PetRuntimeState,
  ): Promise<void> {
    if (!state.lastLocation) return;

    const activeZones = await this.zonesService.findActiveEntitiesForPet(
      pet.id,
    );
    if (activeZones.length === 0) {
      state.consecutiveOutsideCount = 0;
      await this.resolveActiveAlert(pet, 'ZONE_EXIT');
      return;
    }

    const { lat, lon } = state.lastLocation;
    const distances = activeZones.map((zone) => ({
      zone,
      distanceMeters: haversineDistanceMeters(
        lat,
        lon,
        zone.centerLat,
        zone.centerLon,
      ),
    }));

    const insideAny = distances.some(
      (item) => item.distanceMeters <= item.zone.radiusMeters,
    );

    if (insideAny) {
      state.consecutiveOutsideCount = 0;

      // Histéresis para resolver: exigir haber entrado con un margen interior
      const insideWithHysteresis = distances.some(
        (item) =>
          item.distanceMeters <=
          item.zone.radiusMeters * (1 - this.hysteresisRatio),
      );
      if (insideWithHysteresis) {
        await this.resolveActiveAlert(pet, 'ZONE_EXIT');
      }
      return;
    }

    // Fuera de TODAS las zonas activas
    state.consecutiveOutsideCount += 1;

    if (state.consecutiveOutsideCount >= this.consecutiveOutsideThreshold) {
      const nearest = distances.reduce((best, curr) =>
        curr.distanceMeters < best.distanceMeters ? curr : best,
      );
      const roundedDistance = Math.round(nearest.distanceMeters);

      await this.openAlertIfAbsent({
        pet,
        deviceId,
        zoneId: nearest.zone.id,
        type: 'ZONE_EXIT',
        message: `${pet.name} salió de sus zonas seguras (a ${roundedDistance} m del centro de "${nearest.zone.name}", radio ${Math.round(nearest.zone.radiusMeters)} m).`,
        details: {
          lat,
          lon,
          nearestZoneName: nearest.zone.name,
          distanceMeters: roundedDistance,
          radiusMeters: nearest.zone.radiusMeters,
          consecutiveReadings: state.consecutiveOutsideCount,
        },
      });
    }
  }

  private scheduleBridgeOfflineGrace(
    pet: Pet,
    deviceId: string,
    ts: string,
  ): void {
    const state = this.getOrInitState(pet.id);
    this.cancelOfflineGraceTimer(state);

    const trigger = async () => {
      state.offlineGraceTimer = undefined;
      if (this.runtimeByPetId.get(pet.id) !== state) {
        return;
      }
      if (state.bridgeOnline !== false) {
        return;
      }
      const currentPet = await this.petsRepo.findOne({
        where: { id: pet.id },
      });
      if (!currentPet || currentPet.deviceId !== deviceId) {
        return;
      }
      await this.openAlertIfAbsent({
        pet: currentPet,
        deviceId,
        zoneId: null,
        type: 'LINK_LOSS',
        message: `La unidad del collar de ${currentPet.name} perdió conexión con la nube.`,
        details: {
          reason: 'bridge_offline',
          ts,
          graceSeconds: Math.round(this.linkLossGraceMs / 1000),
        },
      });
    };

    if (this.linkLossGraceMs === 0) {
      void trigger();
      return;
    }

    state.offlineGraceTimer = setTimeout(() => {
      void trigger().catch((err) => {
        this.logger.error(
          `Error en timer de gracia offline para mascota ${pet.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }, this.linkLossGraceMs);
  }

  private cancelOfflineGraceTimer(state: PetRuntimeState): void {
    if (state.offlineGraceTimer) {
      clearTimeout(state.offlineGraceTimer);
      state.offlineGraceTimer = undefined;
    }
  }

  private async openAlertIfAbsent(params: {
    pet: Pet;
    deviceId: string;
    zoneId: string | null;
    type: AlertType;
    message: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    const existing = await this.alertsRepo.findOne({
      where: {
        petId: params.pet.id,
        type: params.type,
        status: 'active',
      },
    });
    if (existing) {
      return;
    }

    const alert = this.alertsRepo.create({
      userId: params.pet.userId,
      petId: params.pet.id,
      deviceId: params.deviceId,
      zoneId: params.zoneId,
      type: params.type,
      status: 'active',
      acknowledged: false,
      acknowledgedAt: null,
      message: params.message,
      detailsJson: JSON.stringify(params.details),
      resolvedAt: null,
    });
    const saved = await this.alertsRepo.save(alert);

    this.stream$.next({
      userId: params.pet.userId,
      eventType: 'alert.created',
      payload: this.toAlertResponse(saved),
    });
  }

  private async resolveActiveAlert(pet: Pet, type: AlertType): Promise<void> {
    const existing = await this.alertsRepo.findOne({
      where: {
        petId: pet.id,
        type,
        status: 'active',
      },
    });
    if (!existing) {
      return;
    }

    existing.status = 'resolved';
    existing.resolvedAt = new Date();
    const saved = await this.alertsRepo.save(existing);

    this.stream$.next({
      userId: pet.userId,
      eventType: 'alert.resolved',
      payload: this.toAlertResponse(saved),
    });
  }

  private emitMonitoringUpdate(pet: Pet): void {
    const state = this.getOrInitState(pet.id);
    this.stream$.next({
      userId: pet.userId,
      eventType: 'monitoring.updated',
      payload: {
        petId: pet.id,
        deviceId: pet.deviceId,
        collarOnline: state.collarOnline,
        bridgeOnline: state.bridgeOnline,
        lastSeenAt: state.lastSeenAt,
        lastLocation: state.lastLocation,
      },
    });
  }

  private recordProcessedEventId(eventId: string): void {
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > MAX_PROCESSED_EVENT_IDS) {
      const first = this.processedEventIds.values().next();
      if (!first.done) {
        this.processedEventIds.delete(first.value);
      }
    }
  }

  private getOrInitState(petId: string): PetRuntimeState {
    let state = this.runtimeByPetId.get(petId);
    if (!state) {
      state = {
        lastLocation: null,
        consecutiveOutsideCount: 0,
        collarOnline: null,
        bridgeOnline: null,
        lastSeenAt: null,
      };
      this.runtimeByPetId.set(petId, state);
    }
    return state;
  }

  toAlertResponse(alert: Alert): AlertResponse {
    let details: Record<string, unknown> | null = null;
    if (alert.detailsJson) {
      try {
        details = JSON.parse(alert.detailsJson) as Record<string, unknown>;
      } catch {
        details = null;
      }
    }

    return {
      id: alert.id,
      petId: alert.petId,
      deviceId: alert.deviceId,
      zoneId: alert.zoneId ?? null,
      type: alert.type,
      status: alert.status,
      acknowledged: alert.acknowledged,
      acknowledgedAt: alert.acknowledgedAt
        ? alert.acknowledgedAt.toISOString()
        : null,
      message: alert.message,
      details,
      triggeredAt: alert.triggeredAt.toISOString(),
      resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
    };
  }
}
