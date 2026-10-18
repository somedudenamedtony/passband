// The section keys along the bottom of the panel. The lit key is the section you're in.

import { Icon, type IconName } from './icons';

export interface TabSpec<T extends string> {
  id: T;
  label: string;
  icon: IconName;
}

export function TabBar<T extends string>({ tabs, selected, onSelect }: { tabs: ReadonlyArray<TabSpec<T>>; selected: T; onSelect: (t: T) => void }) {
  return (
    <nav aria-label="Sections" className="tabbar">
      <div role="tablist" className="tabbar-keys">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === selected} className="tabkey" onClick={() => onSelect(t.id)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
