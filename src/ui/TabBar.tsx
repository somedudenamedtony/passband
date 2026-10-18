// The native tab bar, driven directly. @ionic/react's IonTabBar takes its selection from Ionic's
// router; Passband has no router (D2's base path and the live screen's history entry are simpler
// without one), so the core web component is used with `selectedTab` set from React state.

import { createElement } from 'react';
import { IonIcon, IonLabel } from '@ionic/react';
import { defineCustomElement as defineTabBar } from '@ionic/core/components/ion-tab-bar.js';
import { defineCustomElement as defineTabButton } from '@ionic/core/components/ion-tab-button.js';

defineTabBar();
defineTabButton();

export interface TabSpec<T extends string> {
  id: T;
  label: string;
  icon: string;
}

export function TabBar<T extends string>({ tabs, selected, onSelect }: { tabs: ReadonlyArray<TabSpec<T>>; selected: T; onSelect: (t: T) => void }) {
  return createElement(
    'ion-tab-bar',
    { selectedTab: selected, 'aria-label': 'Sections' },
    tabs.map((t) =>
      createElement(
        'ion-tab-button',
        { key: t.id, tab: t.id, onClick: () => onSelect(t.id) },
        createElement(IonIcon, { icon: t.icon, 'aria-hidden': true }),
        createElement(IonLabel, null, t.label),
      ),
    ),
  );
}
