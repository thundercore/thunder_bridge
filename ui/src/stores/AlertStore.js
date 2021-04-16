import { action, observable } from "mobx"
import { getI18nKey } from "../utils/locale"
import { i18nStores } from "./i18n/i18nStores"

class AlertStore {
  @observable
  alerts = []

  @observable
  showLoading = false

  @observable
  loadingStepIndex = -1

  @observable
  blockConfirmations = 0

  @observable
  showDailyQuotaInfo = false

  homeConnectionErrorSended = false
  foreignConnectionErrorSended = false
  locale = getI18nKey(window.hubLang)

  loadingSteps = [
    i18nStores["loading"][this.locale],
    i18nStores["waitConfirmations"][this.locale],
    i18nStores["verifyingTransaction"][this.locale],
    i18nStores["transferComplete"][this.locale],
  ]
  WRONG_NETWORK_ERROR = i18nStores["errWrongNetwork"][this.locale]
  HOME_CONNECTION_ERROR = i18nStores["errHomeConnection"][this.locale]
  FOREIGN_CONNECTION_ERROR = i18nStores["errForeignConnection"][this.locale]
  HOME_TRANSFER_SUCCESS = i18nStores["successHomeTransfer"][this.locale]
  FOREIGN_TRANSFER_SUCCESS = i18nStores["successForeignTransfer"][this.locale]

  @action
  pushError(message, messageType, info = {}) {
    console.error("Error: ", message)
    const shouldPushError = this.checkErrorPush(messageType, messageType)
    if (shouldPushError) {
      const node = document.createElement("div")
      node.innerHTML = message
      const error = {
        title: i18nStores["error"][this.locale],
        content: node,
        icon: "error",
        messageType,
        info,
      }
      this.alerts.push(error)
    }
  }

  checkErrorPush(message, messageType) {
    if (messageType === this.HOME_CONNECTION_ERROR) {
      if (this.homeConnectionErrorSended) {
        return false
      } else {
        this.homeConnectionErrorSended = true
        return true
      }
    } else if (messageType === this.FOREIGN_CONNECTION_ERROR) {
      if (this.foreignConnectionErrorSended) {
        return false
      } else {
        this.foreignConnectionErrorSended = true
        return true
      }
    } else {
      return true
    }
  }

  @action
  pushSuccess(message, messageType) {
    const node = document.createElement("div")
    node.innerHTML = message
    const success = {
      title: i18nStores["success"][this.locale],
      content: node,
      icon: "success",
      messageType,
    }
    this.alerts.push(success)
  }

  remove(value) {
    const result = this.alerts.remove(value)
    console.log(result, value, this.alerts)
  }

  @action
  setLoading(status) {
    this.showLoading = status
    this.loadingStepIndex = 0
    this.blockConfirmations = 0
  }

  @action
  setBlockConfirmations(blocks) {
    this.blockConfirmations = blocks
  }

  @action
  setLoadingStepIndex(index) {
    this.loadingStepIndex = index
    console.log(this.loadingSteps[index])
    if (index === this.loadingSteps.length - 1) {
      setTimeout(() => {
        this.setLoading(false)
      }, 2000)
    }
  }

  shouldDisplayLoadingSteps() {
    return this.loadingStepIndex !== -1
  }

  @action
  setShowDailyQuotaInfo(value) {
    this.showDailyQuotaInfo = value
  }
}

export default AlertStore
