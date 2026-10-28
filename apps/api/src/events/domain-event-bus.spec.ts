import { DomainEventBus } from './domain-event-bus';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('DomainEventBus', () => {
  it('delivers events to handlers of the matching type only', async () => {
    const bus = new DomainEventBus();
    const signed = jest.fn();
    const other = jest.fn();
    bus.on('clinical.EncounterSigned', signed);
    bus.on('billing.PaymentReceived', other);

    bus.publish({ type: 'clinical.EncounterSigned', timestamp: new Date() });
    await tick();

    expect(signed).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('isolates handler failures from the publisher and later events', async () => {
    const bus = new DomainEventBus();
    const handler = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    bus.on('x', handler);

    expect(() => bus.publish({ type: 'x', timestamp: new Date() })).not.toThrow();
    await tick();
    bus.publish({ type: 'x', timestamp: new Date() });
    await tick();

    expect(handler).toHaveBeenCalledTimes(2);
    bus.onModuleDestroy();
  });
});
