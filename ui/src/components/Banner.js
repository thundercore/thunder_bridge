import React, { Component } from 'react'
import CloseButton from "../assets/images/modal/close.png";
import BannerLogo from "../assets/images/modal/bannerLogo.jpg";
import { ReactComponent as TTLogoIcon } from "../assets/images/themes/core/logos/logo-thundercore.svg";
import { ReactComponent as TTIcon } from "../assets/images/themes/core/logos/logo-home.svg";
// import { ReactComponent as TTIcon } from "../assets/images/themes/core/logos/logo-home.svg"

export default class Banner extends Component {
  constructor(props) {
    super(props);
    this.setWrapperRef = this.setWrapperRef.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  setWrapperRef(node) {
    this.wrapperRef = node;
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  componentWillUnmount() {
      document.removeEventListener('mousedown', this.handleClickOutside);
  }

  handleClickOutside(event) {
    if (this.wrapperRef && !this.wrapperRef.contains(event.target)) {
      this.props.closeModal()
    }
  }


  render() {
    const {closeModal} = this.props
    return (
      <div className="banner-wrapper" ref={this.setWrapperRef}>
        <div className="disclaimer-alert">
        <img
          className="close"
          src={CloseButton}
          onClick={closeModal}
          alt="close"
        />
          <div className="content">
            <img className="banner-logo" alt="banner logo" src={BannerLogo} />
            <h2 className="h2">ThunderCore x BSC Coming Soon</h2>
            <p className="disclaimer-description">
              TT-Bridge will support Binance Smart Chain Network (BEP20) assets
              including BUSD, BNB, TT tokens this month. Stay tuned!
            </p>
          </div>
          <div className="banner-footer">
            <TTIcon height={16} width={16} style={{ marginRight: 4 }} />
            <TTLogoIcon width={120} />
          </div>
        </div>
      </div>
    );
  }
}
