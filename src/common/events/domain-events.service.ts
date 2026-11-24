import { Injectable } from '@nestjs/common';

export interface DomainEventMap {
  'pet.deleted': { petId: string };
  'pet.device.unlinked': { petId: string; userId: string };
  'pet.zones.changed': { petId: string };
}

type DomainEventHandler<K extends keyof DomainEventMap> = (
  payload: DomainEventMap[K],
) => Promise<void> | void;

@Injectable()
export class DomainEventsService {
  private readonly handlers = new Map<
    keyof DomainEventMap,
    Set<(payload: unknown) => Promise<void> | void>
  >();

  on<K extends keyof DomainEventMap>(
    event: K,
    handler: DomainEventHandler<K>,
  ): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const wrapped = (payload: unknown) => handler(payload as DomainEventMap[K]);
    set.add(wrapped);

    return () => {
      set.delete(wrapped);
    };
  }

  async emit<K extends keyof DomainEventMap>(
    event: K,
    payload: DomainEventMap[K],
  ): Promise<void> {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) {
      return;
    }
    for (const handler of Array.from(set)) {
      await handler(payload);
    }
  }
}
