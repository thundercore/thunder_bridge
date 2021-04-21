const languageWithoutRegionCode = (locale: string) => {
  let lang = locale.toLowerCase()
  if (lang.match(/^zh/) === null) {
    lang = lang.slice(0, 2)
  }
  switch (lang) {
    case "zh-tw":
    case "zh-hk":
    case "zh-sg":
    case "zh-cht":
    case "zh-hant":
      return "zh-Hant"
    case "zh-cn":
    case "zh-chs":
    case "zh-hans":
      return "zh-Hans"
    case "ko":
      return "ko"
    case "vi_VN":
    case "vi":
      return "vi"
    case "tr_TR":
    case "tr":
      return "tr"
    case "id_ID":
    case "id":
      return "id"
    case "ja":
      return "ja"
    case "in":
      return "en"
    case "ru":
      return "ru"
    case "pt_BR":
    case "pt_GW":
    case "pt_MZ":
    case "pt_PT":
    case "pt":
      return "pt"
    case "es_AR":
    case "es_BO":
    case "es_CL":
    case "es_CO":
    case "es_CR":
    case "es_DO":
    case "es_EC":
    case "es_SV":
    case "es_GQ":
    case "es_GT":
    case "es_HN":
    case "es_419":
    case "es_MX":
    case "es_NI":
    case "es_PA":
    case "es_PY":
    case "es_PE":
    case "es_PR":
    case "es_ES":
    case "es_US":
    case "es_UY":
    case "es_VE":
    case "es":
      return "es"
    default:
      return "en"
  }
}

export function getLocale(): string {
  const language =
    (navigator.languages && navigator.languages[0]) ||
    navigator.language ||
    "en"
  return languageWithoutRegionCode(language)
}

export function getOriginalLocale(): string {
  return (
    (navigator.languages && navigator.languages[0]) ||
    navigator.language ||
    "en"
  )
}

export function getI18nKey(hubLang: string): string {
  let locale = hubLang ? hubLang : getLocale()
  if (locale === "zh-Hant" || locale === "zh-Hans") {
    locale = locale.replace(/-/g, "")
  }
  return locale
}
