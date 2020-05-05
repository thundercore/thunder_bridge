import Redlock from "redlock"

export interface Lock {
  unlock: () => Promise<void>
}

export interface Locker {
    key: string
    lock: (ttl: number) => Promise<Lock>
}

export class RedisLocker implements Locker {
  key: string
  redlock: Redlock

  lock(ttl: number): Promise<Lock> {
    return this.redlock.lock(this.key, ttl)
  }
}

class FakeLock implements Lock {
  unlock(): Promise<void> {
    return Promise.resolve()
  }
}

export class FakeLocker implements Locker {
  key: string

  lock(ttl: number): Promise<FakeLock> {
    return Promise.resolve(new FakeLock())
  }
}
