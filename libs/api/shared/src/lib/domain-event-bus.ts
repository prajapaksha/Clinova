import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { EMPTY, Subject, Subscription, catchError, filter, from, mergeMap } from 'rxjs';

export interface DomainEvent {
  readonly type: string;
  readonly timestamp: Date;
}

/**
 * In-process publish/subscribe for domain events between bounded contexts
 * (e.g. clinical.EncounterSigned -> billing drafts an invoice). Handlers run
 * asynchronously; failures are logged and never propagate to the publisher.
 */
@Injectable()
export class DomainEventBus implements OnModuleDestroy {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly events$ = new Subject<DomainEvent>();
  private readonly subscriptions = new Subscription();

  publish<T extends DomainEvent>(event: T): void {
    this.events$.next(event);
  }

  on<T extends DomainEvent>(type: T['type'], handler: (event: T) => Promise<unknown> | unknown): void {
    this.subscriptions.add(
      this.events$.pipe(
        filter((e): e is T => e.type === type),
        mergeMap(event => from(Promise.resolve().then(() => handler(event))).pipe(
          catchError(err => {
            this.logger.error(`Handler for ${type} failed: ${err instanceof Error ? err.message : err}`);
            return EMPTY;
          }),
        )),
      ).subscribe(),
    );
  }

  onModuleDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventsModule {}
