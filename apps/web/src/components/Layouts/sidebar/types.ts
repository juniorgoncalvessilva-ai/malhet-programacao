import { ComponentType, SVGProps } from 'react';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavigationSubItem {
  title: string;
  url: string;
  localizedUrl?: Record<string, string>;
}

export interface NavigationItem {
  title: string;
  icon: IconComponent;
  url?: string;
  items: NavigationSubItem[];
  localizedUrl?: Record<string, string>;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

export type NavigationData = NavigationSection[];

export interface MenuItemProps {
  className?: string;
  children: React.ReactNode;
  isActive: boolean;
}

export interface MenuItemButtonProps extends MenuItemProps {
  as?: "button";
  onClick: () => void;
}

export interface MenuItemLinkProps extends MenuItemProps {
  as: "link";
  href: string;
}

export type MenuItemUnionProps = MenuItemButtonProps | MenuItemLinkProps;

export type SupportedLocale = 'pt-BR' | 'en';

export interface LocalizedRoute {
  [key: string]: string;
}

export interface RouteMapping {
  [locale: string]: LocalizedRoute;
}

export type NavigationTranslationKeys = 
  | 'mainMenu'
  | 'dashboard'
  | 'ecommerce'
  | 'calendar'
  | 'profile'
  | 'forms'
  | 'formElements'
  | 'formLayout'
  | 'validatedForms'
  | 'tables'
  | 'pages'
  | 'settings'
  | 'others'
  | 'charts'
  | 'basicChart'
  | 'uiElements'
  | 'alerts'
  | 'buttons'
  | 'authentication'
  | 'signIn'
  | 'signUp';

export type TranslationValues = Record<NavigationTranslationKeys, string>; 