import React from "react";
import { ReactComponent as Logo } from "../assets/images/logos/thundercore-logo.svg";
const config = require("../config.json");
import { injectIntl } from "react-intl";

const footer = `Copyright ${config.year} © All rights Reserved by Thunder Token Ltd.`;

const items = {
  community: [
    { name: "Twitter", link: "https://twitter.com/thunderprotocol" },
    { name: "Discord", link: "https://discordapp.com/invite/5EbxXfw" },
    { name: "Medium", link: "https://medium.com/thundercore" },
    { name: "Telegram - ENG", link: "https://t.me/thunder_official" },
    { name: "Telegram - CHN", link: "https://t.me/thundercore_china" },
    { name: "Telegram - KOR", link: "https://t.me/thundercore_korea" },
    {
      name: "View All",
      link: "https://thundercore.zendesk.com/hc/en-us/articles/4409279468313-Join-our-community-",
    },
  ],
  aboutUs: [
    { name: "Help Center", link: "https://thundercore.zendesk.com/hc/en-us" },
    { name: "Events", link: "https://medium.com/thundercore/events/home" },
    { name: "Blog", link: "https://medium.com/thundercore" },
  ],
  legal: [
    { name: "Privacy Policy", link: "/privacy_policy.pdf" },
    { name: "Website Terms", link: "/t&c.pdf" },
  ],
};

const Footer = () => (
  <footer className="footer">
    <div className="footer-section">
      <div className="footer-main">
        <div className="footer-logo">
          <Logo />
          <a
            href="https://mailchi.mp/thundercore/subscribe"
            className="subscribe"
          >
            Subscribe
          </a>
        </div>

        <div className="footer-info">
          {Object.keys(items).map((section) => (
            <div className="group-column" key={section} type="column">
              <h3 className="info-header">{section}</h3>
              {items[section].map((item) => (
                <a key={item.name} href={item.link || ""}>
                  {/* <p id={`${section}.${item.name}`} /> */}
                  <p className="info-list">{item.name}</p>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
    <p className="copy-right">{footer}</p>
  </footer>
);

export default injectIntl(Footer);
