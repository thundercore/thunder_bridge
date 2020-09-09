import React from 'react'
import { SocialIcons } from './SocialIcons'
import { ReactComponent as TTLogoIcon } from '../assets/images/themes/core/logos/logo-thundercore.svg'
import { ReactComponent as TTIcon } from '../assets/images/themes/core/logos/logo-home.svg'
const config = require('../config.json')

const footer = `Thunder bridge ${config.version}`

export const Footer = () => (
  <footer className="footer">
    <div className="container">
      <a href="https://thundercore.com" target="_blank" className="footer-logo-container">
        <TTIcon height={16} width={16} style={{ marginRight: 4 }}/>
        <TTLogoIcon width={120}/>
      </a>
      <p>{ footer }</p>
      <SocialIcons />
    </div>
  </footer>
)
