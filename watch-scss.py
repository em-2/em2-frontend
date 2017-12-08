#!/usr/bin/env python3.6
from grablib import Grab, setup_logging
from grablib.common import GrablibError
from watchgod import watch


def build(grab):
    try:
        grab.build()
    except GrablibError:
        pass
    except Exception as e:
        print(f'build error, {e.__class__.__name__}: {e}')


def main():
    setup_logging('INFO')
    grab = Grab('grablib.yml')
    build(grab)
    for _ in watch('./src/scss'):
        print('rebuilding...')
        build(grab)


if __name__ == '__main__':
    main()
