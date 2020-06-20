#!/usr/bin/env python

import os
import time
import random
import multiprocessing
import subprocess
import docker

def get_containers(client):
    # Match local chain naming.
    containers = [c for c in client.containers.list() if c.name.startswith('v')]
    containers.sort(key=lambda x: x.name)
    return containers


def crash_test():
    client = docker.from_env()
    containers = get_containers(client)
    if len(containers) < 2:
        print("Expected at least two nodes")
        return

    k = random.randint(3, 10)
    print('try to kill {} services'.format(k))
    for c in random.choices(containers, k=k):
      print('kill {}...'.format(c.name))
      try:
        c.exec_run('kill 1')
      except:
        print('{} is {}'.format(c.name, c.status))


def run_stress():
  docker_compose_file = os.path.join(os.path.dirname(__file__), '..', 'e2e', 'docker-compose-crash.yaml')
  proc = subprocess.Popen(['docker-compose', '-f', docker_compose_file, 'up'])
  return proc


def main():
  proc = run_stress()

  while True:
    crash_test()
    poll = proc.poll()
    if poll == 0:
      print('crash test success')
      break
    elif poll == 1:
      print('crash test failed')
      break
    else:
      print('crash test is running... next round...')

    time.sleep(15)

if __name__ == "__main__":
    main()