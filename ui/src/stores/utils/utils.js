import { bridgeType } from "./bridgeMode";
import Bsc from '../../assets/images/themes/core/logos/logo-foreign-bsc.svg'
import Eth from '../../assets/images/themes/core/logos/logo-foreign-eth.svg'

export function updateForeignLogo() {
  const ForeignImg = bridgeType === "eth" ? Eth : Bsc
  return { backgroundImage: `url(${ForeignImg})`}
}