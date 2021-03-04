import React from 'react'
import { /*EventsIcon, */StatusIcon, StatisticsIcon } from './menu-icons'
import { Link } from 'react-router-dom'
import { bridgeType } from '../stores/utils/bridgeMode'

export const MenuItems = ({ onMenuToggle = null, withoutEvents }) => {
  const menuItems = [
    /*{
      hide: withoutEvents,
      icon: <EventsIcon />,
      link: '/events',
      text: 'Events'
    },*/
    {
      hide: false,
      icon: <StatusIcon />,
      link: '/status',
      text: 'Status'
    },
    {
      hide: withoutEvents,
      icon: <StatisticsIcon />,
      link: '/statistics',
      text: 'Statistics'
    }
  ]

  return menuItems.map((item, index) => {
    return (
      <Link key={index} to={`/${bridgeType}${item.link}`} className="menu-items" onClick={onMenuToggle}>
        <span className="menu-items-icon">{item.icon}</span>
        <span className="menu-items-text">{item.text}</span>
      </Link>
    )
  })
}
