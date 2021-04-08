import * as React from "react"
import { IntlProvider, addLocaleData } from "react-intl"
import * as enLocaleData from "react-intl/locale-data/en"
import * as zhLocaleData from "react-intl/locale-data/zh"
import * as koLocaleData from "react-intl/locale-data/ko"
import * as viLocaleData from "react-intl/locale-data/vi"
import * as trLocaleData from "react-intl/locale-data/tr"
import * as idLocaleData from "react-intl/locale-data/id"
import * as jaLocaleData from "react-intl/locale-data/ja"
import * as ruLocaleData from "react-intl/locale-data/ru"
import * as ptLocaleData from "react-intl/locale-data/pt"
import * as esLocaleData from "react-intl/locale-data/es"
import localeMessages from "../translations"
import { getLocale } from "../utils/locale"

addLocaleData([
  ...enLocaleData,
  ...zhLocaleData,
  ...koLocaleData,
  ...viLocaleData,
  ...trLocaleData,
  ...idLocaleData,
  ...jaLocaleData,
  ...ruLocaleData,
  ...ptLocaleData,
  ...esLocaleData,
])

export const LocaleContext = React.createContext({})

export class LocaleProvider extends React.PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      locale: getLocale(),
      options: [
        {
          displayName: "English",
          locale: "en",
        },
        {
          displayName: "繁體中文",
          locale: "zh-Hant",
        },
        {
          displayName: "简体中文",
          locale: "zh-Hans",
        },
        {
          displayName: "한국어",
          locale: "ko",
        },
        {
          displayName: "Tiếng việt",
          locale: "vi",
        },
        {
          displayName: "Türk dili",
          locale: "tr",
        },
        {
          displayName: "Indonesia",
          locale: "id",
        },
        {
          displayName: "日本語",
          locale: "ja",
        },
        {
          displayName: "Русский",
          locale: "ru",
        },
        {
          displayName: "Português",
          locale: "pt",
        },
        {
          displayName: "español",
          locale: "es",
        },
      ],
    }
  }

  changeLocale = (locale) => {
    this.setState({ locale })
  }

  render() {
    const store = {
      state: this.state,
      changeLocale: this.changeLocale,
    }

    const messages = localeMessages[this.state.locale]

    return (
      <LocaleContext.Provider value={store}>
        <IntlProvider
          key={this.state.locale}
          locale={this.state.locale}
          messages={messages}
          textComponent={React.Fragment}
        >
          {this.props.children}
        </IntlProvider>
      </LocaleContext.Provider>
    )
  }
}

export const LocaleConsumer = LocaleContext.Consumer
