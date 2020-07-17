const sinon = require('sinon')
const { expect } = require('chai')
const proxyquire = require('proxyquire').noPreserveCache()
const { fetchGasPrice, gasPriceWithinLimits, setTestCachedGasPrice, getPrice } = require('../src/services/gasPrice')
const config = require('../config')
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
    it('get price without speed base', async () => {
      const toGWei = function(wei) {
        return (wei * Math.pow(10, 9)).toString()
      }
      process.env.GET_PRICE_TEST = 'test'
      config.maxGasPriceLimit = 300
      // this function only works when env.GET_PRICE_TEST is set to 'test'
      const standard = toGWei(1)
      const fast = toGWei(3)
      const instant = toGWei(7)
      const max = toGWei(300)

      setTestCachedGasPrice({
        standard: standard,
        fast: fast,
        instant: instant,
      })

      const now = Math.floor(Date.now())

      expect(getPrice(now)).to.equal(standard, 'should use standard speed type')
      expect(getPrice(now - 70 * 1000)).to.equal(fast, 'should use fast speed type')
      expect(getPrice(now - 130 * 1000)).to.equal(instant, 'should use instant speed type')
      expect(getPrice(now - 190 * 1000)).to.equal(toGWei(7+(7-3)*1))
      expect(getPrice(now - 250 * 1000)).to.equal(toGWei(7+(7-3)*2))
      // The maximum gas price will be GAS_PRICE_BOUNDARIES.MAX after a long time
      expect(getPrice(now - 100000 * 1000)).to.equal(max)
    })

    it('get price with speed base', async () => {
      const toGWei = function(wei) {
        return (wei * Math.pow(10, 9)).toString()
      }
      process.env.GET_PRICE_TEST = 'test'
      config.maxGasPriceLimit = 250
      // this function only works when env.GET_PRICE_TEST is set to 'test'
      const standard = toGWei(1)
      const fast = toGWei(3)
      const instant = toGWei(7)
      const max = toGWei(250)
      setTestCachedGasPrice({
        standard: standard,
        fast: fast,
        instant: instant,
      })

      // Set speedType to fast
      config.speedType = 'fast'
      const now = Math.floor(Date.now())

      expect(getPrice(now)).to.equal(fast, 'should use fast speed type')
      expect(getPrice(now - 70 * 1000)).to.equal(instant, 'should use instant speed type')
      expect(getPrice(now - 130 * 1000)).to.equal(toGWei(7+(7-3)*1))
      expect(getPrice(now - 190 * 1000)).to.equal(toGWei(7+(7-3)*2))
      expect(getPrice(now - 250 * 1000)).to.equal(toGWei(7+(7-3)*3))
      // The maximum gas price will be GAS_PRICE_BOUNDARIES.MAX after a long time
      expect(getPrice(now - 100000 * 1000)).to.equal(max)
    })

    it('get price with adjusted bump interval', async () => {
      const toGWei = function(wei) {
        return (wei * Math.pow(10, 9)).toString()
      }
      process.env.GET_PRICE_TEST = 'test'
      config.maxGasPriceLimit = 500
      // this function only works when env.GET_PRICE_TEST is set to 'test'
      const standard = toGWei(1)
      const fast = toGWei(3)
      const instant = toGWei(7)
      const max = toGWei(500)
      setTestCachedGasPrice({
        standard: standard,
        fast: fast,
        instant: instant,
      })

      // Set speedType to instant
      config.speedType = 'instant'
      process.env.GAS_PRICE_BUMP_INTERVAL = 30 * 1000
      const now = Math.floor(Date.now())

      expect(getPrice(now)).to.equal(instant, 'should use instant speed type')
      expect(getPrice(now - 40 * 1000)).to.equal(toGWei(7+(7-3)*1))
      expect(getPrice(now - 70 * 1000)).to.equal(toGWei(7+(7-3)*2))
      expect(getPrice(now - 100 * 1000)).to.equal(toGWei(7+(7-3)*3))
      // The maximum gas price will be GAS_PRICE_BOUNDARIES.MAX after a long time
      expect(getPrice(now - 100000 * 1000)).to.equal(max)
    })

    it('set price from env', async () => {
      process.env.SET_GAS_PRICE = 1000
      const now = Math.floor(Date.now())
      expect(getPrice(now)).to.equal('1000', 'should use gas price from env')
      expect(getPrice(now - 350 * 1000)).to.equal('1000', 'should use gas price from env')
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
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.equal(15000)
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.not.equal(DEFAULT_UPDATE_INTERVAL)
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL)
    })
    it('should call setIntervalAndRun with FOREIGN_GAS_PRICE_UPDATE_INTERVAL interval value on Foreign', async () => {
      // given
      process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL = 15000
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('foreign')

      // then
      expect(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL).to.equal(15000)
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.not.equal(DEFAULT_UPDATE_INTERVAL)
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL)
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
      const initialGasPrice = 10000

      // When
      const gasPrice = gasPriceWithinLimits(initialGasPrice)

      // Then
      expect(gasPrice).to.equal(config.maxGasPriceLimit)
    })
  })
})
