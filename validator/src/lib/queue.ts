import { EventTask } from "./types"
import { EventType } from "aws-sdk/clients/cloudfront"

export interface Queue<T> {
  channel: {
    close: () => Promise<void>
  }
  push: (msg: T) => Promise<void>
  pop: () => Promise<T>
  nackMsg: (msg: T) => Promise<void>
  ackMsg: (msg: T) => Promise<void>
}

export class FakeQueue implements Queue<EventTask>{
  queue: EventTask[] = []
  nacks: EventTask[] = []
  acks: EventTask[] = []
  map: Map<EventType, number> = new Map<EventType, number>()

  channel: {
    close: () => Promise<void>
  } = {
    close: () => Promise.resolve(),
  }

  push(msg: EventTask): Promise<void> {
    this.queue.push(msg)
    return Promise.resolve()
  }

  pop(): Promise<EventTask> {
    if (this.queue.length) {
      return Promise.resolve(this.queue.pop()!)
    } else {
      throw Error("queue is empty")
    }
  }

  nackMsg(msg: EventTask): Promise<void> {
    this.nacks.push(msg)
    return Promise.resolve()
  }

  ackMsg(msg: EventTask): Promise<void> {
    this.acks.push(msg)
    return Promise.resolve()
  }
}
