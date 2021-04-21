import React from "react"
import ReactDOM from "react-dom"
import App from "./App"
import ReactGA from "react-ga"
import { BrowserRouter } from "react-router-dom"
import { Provider } from "mobx-react"
import RootStore from "./stores/RootStore"
import { bridgeType } from "./stores/utils/bridgeMode"

if (process.env.NODE_ENV === "production") {
  ReactGA.initialize("UA-134150236-15")
} else {
  ReactGA.initialize("test", { testMode: true })
}
ReactGA.pageview(window.location.pathname + window.location.search)

ReactDOM.render(
  <Provider RootStore={RootStore}>
    <BrowserRouter basename={`/${bridgeType}`}>
      <App />
    </BrowserRouter>
  </Provider>,
  document.getElementById("root")
)
