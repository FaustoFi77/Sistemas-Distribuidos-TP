import { DomainEventsService } from './domain-events.service';

describe('DomainEventsService', () => {
  it('invoca handlers suscriptos, espera handlers async y permite desuscribir', async () => {
    const bus = new DomainEventsService();
    const calls: string[] = [];

    const unsubscribe = bus.on('pet.deleted', async ({ petId }) => {
      await Promise.resolve();
      calls.push(`deleted:${petId}`);
    });

    await bus.emit('pet.deleted', { petId: 'pet-1' });
    expect(calls).toEqual(['deleted:pet-1']);

    unsubscribe();
    await bus.emit('pet.deleted', { petId: 'pet-2' });
    expect(calls).toEqual(['deleted:pet-1']);
  });

  it('no falla al emitir un evento sin suscriptores', async () => {
    const bus = new DomainEventsService();
    await expect(
      bus.emit('pet.zones.changed', { petId: 'pet-1' }),
    ).resolves.toBeUndefined();
  });
});
