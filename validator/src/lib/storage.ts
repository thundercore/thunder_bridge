declare namespace Cache {
  type KeyType = string
  type ValueType = string | number | any[]
}

export interface Cache {
    status: string
    get: (key: Cache.KeyType) => Promise<Cache.ValueType|null>
    set: (key: Cache.KeyType, value: Cache.ValueType) => Promise<void|string>
}

export class FakeCache implements Cache {
    status: string = "processing"
    m: {
      [key: string]: Cache.ValueType;
    } = {}

  async get(key: Cache.KeyType): Promise<Cache.ValueType> {
    return Promise.resolve(this.m[key])
  }

  async set(key: Cache.KeyType, value: Cache.ValueType): Promise<void> {
    this.m[key] = value
  }
}
