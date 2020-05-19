
export interface Lock {
  unlock: () => Promise<void>
}

export interface Locker {
    ttl: number
    lock: (key: string) => Promise<Lock>
}

class FakeLock implements Lock {
  unlock(): Promise<void> {
    return Promise.resolve()
  }
}

export class FakeLocker implements Locker {
  ttl: number = 1

  lock(key: string): Promise<FakeLock> {
    return Promise.resolve(new FakeLock())
  }
}
