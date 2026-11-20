import { IconMoon, IconSun } from './Icons';

export function ThemeFab({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? '다크 테마로 전환' : '라이트 테마로 전환';
  return (
    <button
      type="button"
      className="theme-fab"
      data-testid="theme-fab"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
    >
      <span className="theme-fab-icon" data-icon="sun" aria-hidden>
        <IconSun size={19} />
      </span>
      <span className="theme-fab-icon" data-icon="moon" aria-hidden>
        <IconMoon size={19} />
      </span>
    </button>
  );
}
