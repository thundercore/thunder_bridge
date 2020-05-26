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
        'HOME_RPC_URL': 'localhost:8545',
        'FOREIGN_RPC_URL': 'localhost:8545',
        'HOME_START_BLOCK': '0',
        'FOREIGN_START_BLOCK': '0',
        'BRIDGE_MODE': 'ERC_TO_ERC',
        'QUEUE_URL': 'localhost',
        'REDIS_LOCK_TTL': '1000',
    }
    os.environ.update(envs)
    subprocess.check_call(['npm', 'run', 'test'])
    subprocess.check_call(['npm', 'run', 'test:ts'])


@contextlib.contextmanager
def dev_chain():
    try:
        subprocess.check_call(['npm', 'run', 'dev-chain'])
        yield
    finally:
        subprocess.check_call(['npm', 'run', 'dev-chain:stop'])

@contextlib.contextmanager
def pala_chain():
    tag = 'pala-for-truffle-test'
    name = 'pala-for-truffle-test'
    subprocess.check_call(['docker', 'build', '-t', tag, 'e2e/thunder'])
    try:
        subprocess.check_call(['docker', 'run', '-d', '--rm', '-p', '7545:8545/tcp', '--name', name, tag])
        yield
    finally:
        subprocess.check_call(['docker', 'stop', name])

def truffle(args):
    print('Copy {} -> {}'.format(
        os.path.join(CONTRACT_DIR, 'deploy', 'env.truffle'),
        os.path.join(CONTRACT_DIR, 'deploy', '.env'),
    ))
    shutil.copy(
        os.path.join(CONTRACT_DIR, 'deploy', 'env.truffle'),
        os.path.join(CONTRACT_DIR, 'deploy', '.env'),
    )

    # `truffle test` will compile contract to /tmp
    subprocess.check_call(['npm', 'run', 'truffle:compile'])

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

