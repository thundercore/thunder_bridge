const sinon = require('sinon')
const { expect } = require('chai')
const proxyquire = require('proxyquire').noPreserveCache()
const { fetchGasPrice, gasPriceWithinLimits, setTestCachedGasPrice, getPrice } = require('../src/services/gasPrice')
const { DEFAULT_UPDATE_INTERVAL, GAS_PRICE_BOUNDARIES } = require('../src/utils/constants')

describe('gasPrice', () => {
  describe('fetchGasPrice', () => {
    beforeEach(() => {
      sinon.stub(console, 'error')
    })
    afterEach(() => {
      console.error.restore()
    })

    it('should fetch the gas price from the oracle by default', async () => {
      // given
      const oracleFnMock = () => Promise.resolve('1')
      const bridgeContractMock = {
        methods: {
          gasPrice: {
            call: sinon.stub().returns(Promise.resolve('2')),
          },
        },
      }

      // when
      const gasPrice = await fetchGasPrice({
        bridgeContract: bridgeContractMock,
        oracleFn: oracleFnMock,
      })

      // then
      expect(gasPrice).to.equal('1')
    })
    it('should fetch the gas price from the contract if the oracle fails', async () => {
      // given
      const oracleFnMock = () => Promise.reject(new Error('oracle failed'))
      const bridgeContractMock = {
        methods: {
          gasPrice: sinon.stub().returns({
            call: sinon.stub().returns(Promise.resolve('2')),
          }),
        },
      }

      // when
      const gasPrice = await fetchGasPrice({
        bridgeContract: bridgeContractMock,
        oracleFn: oracleFnMock,
      })

      // then
      expect(gasPrice).to.deep.equal({ standard: '2', fast: '2', instant: '2' })
    })
    it('should return null if both the oracle and the contract fail', async () => {
      // given
      const oracleFnMock = () => Promise.reject(new Error('oracle failed'))
      const bridgeContractMock = {
        methods: {
          gasPrice: sinon.stub().returns({
            call: sinon.stub().returns(Promise.reject(new Error('contract failed'))),
          }),
        },
      }

      // when
      const gasPrice = await fetchGasPrice({
        bridgeContract: bridgeContractMock,
        oracleFn: oracleFnMock,
      })

      // then
      expect(gasPrice).to.equal(null)
    })
    it('should return max if both the oracle and the contract success', async () => {
      // given
      const oracleFnMock = () => Promise.resolve({ standard: '1', fast: '3', instant: '5' })
      const bridgeContractMock = {
        methods: {
          gasPrice: sinon.stub().returns({
            call: sinon.stub().returns('2'),
          }),
        },
      }

      // when
      const gasPrice = await fetchGasPrice({
        bridgeContract: bridgeContractMock,
        oracleFn: oracleFnMock,
      })

      // then
      expect(gasPrice).to.deep.equal({ standard: '2', fast: '3', instant: '5' })
    })
  })
  describe('get price', () => {
    it('get price', async () => {
      const toGWei = function(wei) {
        return (wei * Math.pow(10, 9)).toString()
      }
      process.env.GET_PRICE_TEST = 'test'
      // this function only works when env.GET_PRICE_TEST is set to 'test'
      const standard = toGWei(1)
      const fast = toGWei(3)
      const instant = toGWei(7)
      const max = toGWei(GAS_PRICE_BOUNDARIES.MAX)
      setTestCachedGasPrice({
        standard: standard,
        fast: fast,
        instant: instant,
      })

      const now = Math.floor(Date.now() / 1000)

      expect(getPrice(now)).to.equal(standard, 'should use standard speed type')
      expect(getPrice(now - 350)).to.equal(fast, 'should use fast speed type')
      expect(getPrice(now - 650)).to.equal(instant, 'should use instant speed type')
      expect(getPrice(now - 950)).to.equal(toGWei(7+(7-3)*1))
      expect(getPrice(now - 1250)).to.equal(toGWei(7+(7-3)*2))
      // The maximum gas price will be GAS_PRICE_BOUNDARIES.MAX after a long time
      expect(getPrice(now - 100000)).to.equal(max, 'should use instant speed type')
    })
    it('set price from env', async () => {
      process.env.SET_GAS_PRICE = 1000
      const now = Math.floor(Date.now() / 1000)
      expect(getPrice(now)).to.equal('1000', 'should use gas price from env')
      expect(getPrice(now - 300)).to.equal('1000', 'should use gas price from env')
      process.env.SET_GAS_PRICE = undefined
    })
  })

  describe('start', () => {
    const utils = { setIntervalAndRun: sinon.spy() }
    beforeEach(() => {
      utils.setIntervalAndRun.resetHistory()
    })
    it('should call setIntervalAndRun with HOME_GAS_PRICE_UPDATE_INTERVAL interval value on Home', async () => {
      // given
      process.env.HOME_GAS_PRICE_UPDATE_INTERVAL = 15000
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('home')

      // then
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.equal('15000')
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.not.equal(DEFAULT_UPDATE_INTERVAL.toString())
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL.toString())
    })
    it('should call setIntervalAndRun with FOREIGN_GAS_PRICE_UPDATE_INTERVAL interval value on Foreign', async () => {
      // given
      process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL = 15000
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('foreign')

      // then
      expect(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL).to.equal('15000')
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.not.equal(DEFAULT_UPDATE_INTERVAL.toString())
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL.toString())
    })
    it.skip('should call setIntervalAndRun with default interval value on Home', async () => {
      // given
      delete process.env.HOME_GAS_PRICE_UPDATE_INTERVAL
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('home')

      // then
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.equal(undefined)
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(DEFAULT_UPDATE_INTERVAL)
    })
    it.skip('should call setIntervalAndRun with default interval value on Foreign', async () => {
      // given
      delete process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('foreign')

      // then
      expect(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL).to.equal(undefined)
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(DEFAULT_UPDATE_INTERVAL)
    })
  })
  describe('gasPriceWithinLimits', () => {
    it('should return gas price if gas price is between boundaries', () => {
      // given
      const minGasPrice = 1
      const middleGasPrice = 10
      const maxGasPrice = 250

      // when
      const minGasPriceWithinLimits = gasPriceWithinLimits(minGasPrice)
      const middleGasPriceWithinLimits = gasPriceWithinLimits(middleGasPrice)
      const maxGasPriceWithinLimits = gasPriceWithinLimits(maxGasPrice)

      // then
      expect(minGasPriceWithinLimits).to.equal(minGasPrice)
      expect(middleGasPriceWithinLimits).to.equal(middleGasPrice)
      expect(maxGasPriceWithinLimits).to.equal(maxGasPrice)
    })
    it('should return min limit if gas price is below min boundary', () => {
      // Given
      const initialGasPrice = 0.5

      // When
      const gasPrice = gasPriceWithinLimits(initialGasPrice)

      // Then
      expect(gasPrice).to.equal(GAS_PRICE_BOUNDARIES.MIN)
    })
    it('should return max limit if gas price is above max boundary', () => {
      // Given
      const initialGasPrice = 260

      // When
      const gasPrice = gasPriceWithinLimits(initialGasPrice)

      // Then
      expect(gasPrice).to.equal(GAS_PRICE_BOUNDARIES.MAX)
    })
  })
})
