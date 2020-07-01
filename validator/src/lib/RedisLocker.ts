import { redlock } from '../services/redisClient';
import { Locker, Lock } from './locker';

export class RedisLocker implements Locker {
  ttl: number;

  constructor(ttl: number) {
    this.ttl = ttl;
  }

  lock(key: string): Promise<Lock> {
    return redlock.lock(key, Number(this.ttl));
  }
}
