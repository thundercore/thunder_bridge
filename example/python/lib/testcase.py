"""Test base for all tests"""
import sys
import os
import time
import unittest
import argparse
import logging
import traceback
import json

from pathlib import Path

PY_HELPER_DIR = Path(os.path.dirname(os.path.realpath(__file__)))
PROJECT_ROOT_DIR = PY_HELPER_DIR.parent.parent
LOGS_DIR = PROJECT_ROOT_DIR.joinpath("log")

def setup_logging(filename, log_level="INFO"):
    '''Setup logging'''
    os.makedirs(LOGS_DIR.as_posix(), exist_ok=True)
    log_format = "%(asctime)s.%(msecs)03d %(levelname)-06s: %(module)s" \
                 "::%(funcName)s:%(lineno)s: %(message)s"
    log_datefmt = "%m-%dT%H:%M:%S"
    log_formatter = logging.Formatter(log_format, datefmt=log_datefmt)
    logging.basicConfig(filename="%s/%s" % (LOGS_DIR.as_posix(), filename), level=logging.INFO, \
        format=log_format, datefmt=log_datefmt)
    logging.getLogger().handlers = []
    file_handler = logging.FileHandler("%s/%s" % (LOGS_DIR.as_posix(), filename))
    file_handler.setFormatter(log_formatter)
    file_handler.setLevel(log_level)
    logging.getLogger().addHandler(file_handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(log_formatter)
    stream_handler.setLevel(log_level)
    logging.getLogger().addHandler(stream_handler)

    logging.getLogger().setLevel(log_level)


class ThunderTestResult(unittest.result.TestResult):
    """unittest Result"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.successes = []
        self.log = logging.getLogger('ThunderTestResult')

    def startTest(self, test):
        super().startTest(test)
        self.log.info("###### Start to run -%s- ######", test)

    def stopTest(self, test):
        self.log.info("###### Stop to run -%s- ######", test)
        super().stopTest(test)

    def addSuccess(self, test):
        self.successes.append((test, ''))

    def summary(self):
        '''Summarize tests results'''
        def _get_name(arg):
            if hasattr(arg[0], '_testMethodName'):
                return getattr(arg[0], '_testMethodName')
            else:
                return str(arg[0])
        get_names = lambda x: list(map(_get_name, x))
        self.log.info("Successes: %s", get_names(self.successes))
        self.log.info("Failures: %s", get_names(self.failures))
        self.log.info("Errors: %s", get_names(self.errors))
        self.log.info("Skipped: %s", get_names(self.skipped))

        return len(self.failures) + len(self.errors)


def log_exceptions(func):
    """wrapper of each test, to print exceptions"""
    def _wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception:
            log = None
            if args and isinstance(args[0], TestBase):
                instance = args[0]
                log = logging.getLogger(instance.__class__.__name__)
            else:
                log = logging.getLogger(func.__self__.__name__)
            if log:
                log.info(traceback.format_exc())
            raise

    return _wrapper


def testmain(testclass, *methods):
    '''Main entry for test'''
    return testcli(testclass, None, *methods)


def testcli(testclass, argv, *methods):
    '''Main entry for tests, which can accept CLI args'''

    class_name = testclass.__name__
    parser = argparse.ArgumentParser()
    parser.add_argument('-t', action='append', help="Designate test cases which to run")
    parser.add_argument('-x', action='append', help="Designate test cases which not to run")
    parser.add_argument('-l', action='store_true', help="List available test cases")
    parser.add_argument('-d', default="INFO", help="Log level: INFO, DEBUG")

    args, unknown_args = parser.parse_known_args(argv)

    #sub.set_defaults(test=name)
    if hasattr(testclass, 'setup_parser'):
        sub = getattr(testclass, 'setup_parser')()
        testclass.ARGS = sub.parse_args(unknown_args)
        if not testclass.ARGS.o:
            testclass.ARGS.o = []

    setup_logging("%s_%s_log.txt" % (class_name, time.strftime("%Y-%m-%d_%H-%M")), args.d)
    log = logging.getLogger(class_name)
    tests = None
    if args.l:
        testcase_names = unittest.loader.getTestCaseNames(testclass, "test_")
        #print(testcaseNames)
        for name in testcase_names:
            print(name)
        return 0

    existed_names = unittest.loader.getTestCaseNames(testclass, "test_")
    if args.x:
        for name in args.x:
            if name in existed_names:
                existed_names.remove(name)

    #import pdb; pdb.set_trace()
    testcase_names = []
    if args.t or methods:
        names = list(methods)
        if args.t:
            names.extend(args.t)
        for testcase_name in names:
            if testcase_name in existed_names:
                testcase_names.append(testcase_name)
    else:
        testcase_names.extend(existed_names)
    if not testcase_names:
        log.info("## No test to run")
        return 0

    for test_name in testcase_names:
        orig_method = getattr(testclass, test_name)
        setattr(testclass, test_name, log_exceptions(orig_method))
    for method_name in ['setUp', 'setUpClass', 'tearDown', 'tearDownClass']:
        orig_method = getattr(testclass, method_name)
        setattr(testclass, method_name, log_exceptions(orig_method))
    tests = unittest.suite.TestSuite(map(testclass, testcase_names))

    result = ThunderTestResult(sys.stdout)
    tests(result)
    nr_fail_error = result.summary()
    if nr_fail_error == 0:
        log.info("## Test %s: PASSED", class_name)
    else:
        log.error("## Test %s: FAILED", class_name)
    return nr_fail_error


class TestBase(unittest.TestCase):
    """TestBase for all tests"""
    LOG = logging.getLogger('TestBase')
    ARGS = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.log = logging.getLogger(__name__)

    @classmethod
    def setup_parser(cls):
        '''setup parser'''
        parser = argparse.ArgumentParser()
        parser.add_argument('--loop', help='Loop times for a test with @TestBase.loop', default='1')
        parser.add_argument('-o', action='append', help="options parameters")

        return parser

    def setUp(self):
        pass

    def tearDown(self):
        pass

    @classmethod
    def setUpClass(cls):
        pass

    @classmethod
    def tearDownClass(cls):
        pass

    @staticmethod
    def loop(func):
        '''decorator added on a test'''
        def _wrapper(*args, **kwargs):
            if args and isinstance(args[0], TestBase):
                instance = args[0]
                if hasattr(instance.ARGS, 'loop'):
                    times = int(getattr(instance.ARGS, 'loop'))
                else:
                    times = 1

                if times > 1:
                    result = True
                    for i in range(times):
                        TestBase.LOG.info("Test #%s time to run test", i+1)
                        try:
                            func(*args, **kwargs)
                        except Exception:
                            TestBase.LOG.info(traceback.format_exc())
                            TestBase.LOG.info("Test #%s time to run FAILED!!!", i+1)
                            result = False
                    assert result, "At least one time failed for %s loop" % times
                else:
                    func(*args, **kwargs)

        return _wrapper

    @classmethod
    def load_json(cls, file_path, *args):
        '''Load json'''
        ret = {}
        with open(file_path) as file:
            ret = json.load(file)
        if args:
            for arg in args:
                ret = ret[arg]
        if cls.ARGS.o:
            for item in cls.ARGS.o:
                keystr, value = item.split('=', 1)
                cls.LOG.info("Option: %s", item)
                keys = keystr.split('.')
                tval = ret
                for key in keys[:-1]:
                    if key not in tval:
                        tval[key] = {}
                    tval = tval[key]
                tval[keys[-1]] = value
        return ret