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
    case "ja":
      return "en"
    case "in":
    case "id":
      return "en"
    case "ru":
      return "ru"
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
