class BatchRequest {
  constructor(web3) {
    this.b = new web3.BatchRequest();
    this.results = [];
    this.resolve = null;
    this.reject = null;
    this.resultsFilled = 0;
  }
  web3BatchRequestCallBack(index, err, result) {
    /* if any request in our batch fails, reject the promise we return from `execute` */
    if (err) {
      this.reject(new Error(`request ${index} failed: ${err}`))
      return;
    }
    this.results[index] = result;
    this.resultsFilled++;
    if (this.resultsFilled === this.results.length) {
      this.resolve(this.results);
    }
  }
  resultPromiseExecutor(resolve, reject) {
    this.resolve = resolve;
    this.reject = reject;
  }
  add(method /* web3-core-method.Method */) {
    const index = this.results.length;
    method.callback = (err, result) => {
      this.web3BatchRequestCallBack(index, err, result)
    };
    this.b.add(method);
    this.results.push(undefined);
  }
  execute() /*: Promise */ {
    const p = new Promise((resolve, reject) => { this.resultPromiseExecutor(resolve, reject) });
    /* must arrange for resultPromiseExecutor to be called before b.execute */
    this.b.execute();
    return p;
  }
}

module.exports = {
  BatchRequest: BatchRequest,
}
