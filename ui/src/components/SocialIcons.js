import React from 'react'
import { IconGithub, IconTelegram, IconTwitter, IconReddit, IconMedium, IconDiscord } from './social-icons'

export const SocialIcons = () => {
  const socialItems = [
    {
      icon: <IconTwitter />,
      link: 'https://twitter.com/ThunderProtocol'
    },
    {
      icon: <IconMedium />,
      link: 'https://medium.com/thunderofficial'
    },
    {
      icon: <IconDiscord />,
      link: 'https://discordapp.com/invite/5EbxXfw'
    },
    {
      icon: <IconTelegram />,
      link: 'https://t.me/thunder_official'
    },
    {
      icon: <IconGithub />,
      link: 'https://github.com/thundercore'
    }
  ]

  return (
    <div className="social-icons">
      {socialItems.map((item, index) => {
        return (
          <a key={index} href={item.link} target="_blank" className="social-icons-item">
            {item.icon}
          </a>
        )
      })}
    </div>
  )
}
