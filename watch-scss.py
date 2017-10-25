#!/usr/bin/env python3.6
from grablib import Grab, setup_logging
from watchgod import watch


def main():
    setup_logging('INFO')
    grab = Grab('grablib.yml')
    grab.build()
    for _ in watch('./src/scss'):
        print('rebuilding...')
        grab.build()


if __name__ == '__main__':
    main()
