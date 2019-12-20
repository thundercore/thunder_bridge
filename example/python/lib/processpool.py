'''Process Pool'''

import multiprocessing

class ProcessPool:
    '''Process Pool'''
    def __init__(self, processes=5):
        self.pool = multiprocessing.Pool(processes)
        self.results = []

    def add_task(self, func, *args, **kwargs):
        '''Add task to pool'''
        self.results.append(self.pool.apply_async(func, args, kwargs))

    def wait_completion(self):
        '''Wait for completion of all tasks'''
        self.pool.close()
        self.pool.join()
        result = []

        for task_res in self.results:
            if task_res.ready():
                if task_res.successful():
                    result.append((task_res.get(), None))
                else:
                    result.append((None, "Error"))

        return result

if __name__ == "__main__":
    import random
    import time

    def _task_method(idx):
        rnd = random.randint(1, 10)
        time.sleep(rnd)
        if rnd % 2 == 0:
            raise Exception(rnd)
        return idx

    POOL = ProcessPool(5)
    for i in range(10):
        POOL.add_task(_task_method, i)

    for res in POOL.wait_completion():
        print(res)