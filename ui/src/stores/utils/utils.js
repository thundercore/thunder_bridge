import { bridgeType } from "./bridgeMode"
import numeral from "numeral"
import Bsc from "../../assets/images/themes/core/logos/logo-foreign-bsc.svg"
import Eth from "../../assets/images/themes/core/logos/logo-foreign-eth.svg"
import Heco from "../../assets/images/themes/core/logos/logo-foreign-heco.png"

export function updateForeignLogo() {
  console.log("updateForeignLogo bridgeType", bridgeType)
  let ForeignImg
  switch (bridgeType) {
    case "eth":
      ForeignImg = Eth
      break
    case "bsc":
      ForeignImg = Bsc
      break
    case "heco":
      ForeignImg = Heco
      break
    default:
      ForeignImg = Bsc
  }
  return { backgroundImage: `url(${ForeignImg})` }
}

export function valueFormatter(value) {
  return numeral(value).format("0.00", Math.floor) === "NaN"
    ? numeral(0).format("0,0", Math.floor)
    : numeral(value)
        .format("0,0.000", Math.floor)
        .replace(/(\.0+|0+)$/, "")
}
