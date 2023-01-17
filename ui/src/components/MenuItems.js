import React from "react";
import { /*EventsIcon, */ StatusIcon, StatisticsIcon } from "./menu-icons";
import { Link, useHistory } from "react-router-dom";
import { injectIntl } from "react-intl";

const MenuItems = ({ intl }) => {
  let history = useHistory();
  const menuItems = [
    /*{
      hide: withoutEvents,
      icon: <EventsIcon />,
      link: '/events',
      text: 'Events'
    },*/
    {
      icon: <StatusIcon />,
      link: "/status",
      text: intl.formatMessage({
        id: "components.i18n.MenuItems.status",
      }),
    },
    {
      icon: <StatisticsIcon />,
      link: "/statistics",
      text: intl.formatMessage({
        id: "components.i18n.MenuItems.statistics",
      }),
    },
  ];
  return menuItems.map((item, index) => {
    const isActive =
      !!history.pathname && history.pathname.indexOf(item.link) != -1;
    console.log(`isActive ${isActive} item.link  ${item.link}`);
    return (
      <Link
        key={index}
        to={item.link}
        className={`menu-items ${isActive ? "active" : ""}`}
      >
        <span className="menu-items-text">{item.text}</span>
      </Link>
    );
  });
};

export default injectIntl(MenuItems);
