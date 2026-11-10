import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import * as Icons from "@/components/Layouts/sidebar/icons";
import { NavigationData } from '@/components/Layouts/sidebar/types';

export function useNavigation(): NavigationData {
  const t = useTranslations('Navigation');

  // Memoize the navigation data to prevent unnecessary re-renders
  // when translations haven't actually changed
  return useMemo(() => [
    {
      label: t('obra'),
      items: [
        { title: t('programacao'), url: '/app/programacoes', icon: Icons.Calendar, items: [] },
        { title: t('referencias'), url: '/app/referencias', icon: Icons.Table, items: [] },
        { title: t('equipes'), url: '/app/equipes', icon: Icons.User, items: [] },
        { title: t('cadastrosSimova'), url: '/app/cadastros', icon: Icons.FourCircle, items: [] },
      ],
    },
    {
      label: t('mainMenu'),
      items: [
        {
          title: t('dashboard'),
          icon: Icons.HomeIcon,
          items: [
            {
              title: t('ecommerce'),
              url: '/app/dashboard',
            },
          ],
        },
        {
          title: t('calendar'),
          url: '/app/calendar', 
          icon: Icons.Calendar,
          items: [],
        },
        {
          title: t('profile'),
          url: '/app/profile',
          icon: Icons.User,
          items: [],
        },
        {
          title: t('tables'),
          url: '/app/tables',
          icon: Icons.Table,
          items: [
            {
              title: t('tables'),
              url: '/app/tables',
            },
          ],
        },
      ],
    },
    {
      label: t('backend'),
      icon: Icons.ApiIcon,
      items: [
        {
          title: t('apiDemo'),
          icon: Icons.ApiIcon,
          url: '/app/api-demo',
          items: [],
        },
        {
          title: t('analyticsDemo'),
          icon: Icons.ApiIcon,
          url: '/app/analytics-demo',
          items: [],
        },
        {
          title: t('stateManagement'), 
          icon: Icons.ApiIcon,
          url: '/app/state-management',
          items: [],
        },

      ]
    },
    {
      label: t('others'),
      items: [
        {
          title: t('uiElements'),
          icon: Icons.FourCircle,
          items: [
            {
              title: t('alerts'),
              url: '/app/ui-elements/alerts',
            },
            {
              title: t('badges'), 
              url: '/app/ui-elements/badges',
            },
            {
              title: t('buttons'),
              url: '/app/ui-elements/buttons',
            },
            {
              title: t('carousels'),
              url: '/app/ui-elements/carousels',
            },
            {
              title: t('dialogs'),
              url: '/app/ui-elements/dialogs',
            },
            {
              title: t('drawers'),
              url: '/app/ui-elements/drawers',
            },
            {
              title: t('spinners'),
              url: '/app/ui-elements/spinners',
            },
            {
              title: t('toasts'),
              url: '/app/ui-elements/toasts',
            },
          ],
        },
        {
          title: t('forms'),
          icon: Icons.Alphabet,
          items: [
            {
              title: t('formElements'),
              url: '/app/forms/form-elements',
            },
            {
              title: t('formLayout'),
              url: '/app/forms/form-layout',
            },
            {
              title: t('validatedForms'),
              url: '/app/forms/validated-forms',
            },
          ],
        },
        {
          title: t('charts'),
          icon: Icons.PieChart,
          items: [
            {
              title: t('basicChart'),
              url: '/app/charts/basic-chart',
            },
          ],
        },
        {
          title: t('pages'),
          icon: Icons.Alphabet,
          items: [
            {
              title: t('settings'),
              url: '/app/settings',
            },
          ],
        },
        {
          title: t('authentication'),
          icon: Icons.Authentication,
          items: [
            {
              title: t('signIn'),
              url: '/auth/sign-in',
            },
            {
              title: t('signUp'),
              url: '/auth/sign-up',
            },
          ],
        }
      ],
    },
  ], [t]);
}