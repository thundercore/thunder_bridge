## Usage
### Environment ( Python 3 installed )
**OS X**
```
$ brew install python3
```

**Windows**
* Install Python 3 - https://www.python.org/

**Linux ( Ubuntu 18.04)**
```
$ sudo apt update
$ sudo apt install -y python3-pip
```

* Install required packages
```
$ pip3 install pprint
$ pip3 install hexbytes
```

## Script usage
* Create a folder named 'log' in 'example' folder.
* Replace "Infura project ID" in tag "f_rpc" of ./python/env.json
* In cross_chain_asset.py, add user's private key into 'pkeys'.
```
def test_01_parallel(self):
    # Add user(s)' private key(s).
    pkeys = ['Key A', 'Key B']
```
* In function _test_para
```
Use 'f2h' parameter (True / False) to transfer token from either Home -> Foreign or Foreign -> Home
```
* Run
```
$ python3 cross_chain_asset.py
Parameters
--token : usdt / dai
-t : Designate test cases which to run
-x : Designate test cases which not to run
-l : List available test cases
-d : Log level: INFO, DEBUG
-h : Help
```

**Notice**
* PYTHONPATH is being set properly.
* Make sure wallet address which has enough balance on either ThunderCore mainnet side or Ethereum mainnet side.
* Home (ThunderCore mainnet) side has minimum of 1 TT-USDT or TT-DAI limitation.