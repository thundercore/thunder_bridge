#!/usr/bin/env python

import os
import argparse
import shutil
import subprocess
import contextlib


PWD = os.path.realpath(os.path.dirname(__file__))
CONTRACT_DIR = os.path.join(PWD, '..', 'contracts')

def unittest(args):
    envs = {
        'HOME_BRIDGE_ADDRESS': '0x1feB40aD9420b186F019A717c37f5546165d411E',
        'ERC20_TOKEN_ADDRESS': '0x1feB40aD9420b186F019A717c37f5546165d411E',
        'VALIDATOR_ADDRESS': '0x1feB40aD9420b186F019A717c37f5546165d411E',
        'FOREIGN_BRIDGE_ADDRESS': '0x4a58D6d8D416a5fBCAcf3dC52eb8bE8948E25127',
    }

    cmd = ['docker-compose', '-f', 'e2e/docker-compose.yml', 'run', '--rm']
    for k, v in envs.items():
        cmd.append('-e')
        cmd.append('{}={}'.format(k, v))
    cmd += ['validator', 'npm', 'test']
    subprocess.check_call(cmd)


@contextlib.contextmanager
def dev_chain():
    try:
        subprocess.check_call(['docker-compose', 'up', '-d', 'truffle'])
        yield
    finally:
        subprocess.check_call(['docker-compose', 'down'])


@contextlib.contextmanager
def pala_chain():
    try:
        subprocess.check_call(['docker-compose', 'up', '-d', 'pala'])
        yield
    finally:
        subprocess.check_call(['docker-compose', 'down'])


def copy(src, dest):
    print('Copy {} -> {}'.format(src, dest))
    shutil.copy(src, dest)


def truffle(args):
    copy(
        os.path.join(CONTRACT_DIR, 'deploy', 'env.local'),
        os.path.join(CONTRACT_DIR, 'deploy', '.env'),
    )

    # `truffle test` will compile contract to /tmp
    subprocess.check_call(['npm', 'run', 'truffle:compile'])

    copy(os.path.join(PWD, 'env.test'), os.path.join(PWD, '.env'))

    print('Using network', args.network)
    chain_funcs = {
        'ganache': dev_chain,
        'pala': pala_chain,
    }
    ret = True
    with chain_funcs[args.network]():
        try:
            if args.network == 'pala':
                subprocess.check_call(['npm', 'run', 'truffle-test:pala'])
            else:
                subprocess.check_call(['npm', 'run', 'truffle-test'])
        except subprocess.CalledProcessError:
            print("Failed to run truffle-test.")
            ret = False

    return ret


def parse_args():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers()

    unit_parser = subparsers.add_parser('unittest')
    unit_parser.set_defaults(func=unittest)

    truffle_parser = subparsers.add_parser('truffle')
    truffle_parser.set_defaults(func=truffle)
    truffle_parser.add_argument('--network', choices=['pala', 'ganache'], default='ganache')
    return parser.parse_args()


def main():
    args = parse_args()
    return args.func(args)


if __name__ == "__main__":
    main()

