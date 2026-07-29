const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.cofarmz.com&hl=en_IN';

type GooglePlayBadgeProps = {
  compact?: boolean;
  className?: string;
};

export default function GooglePlayBadge({
  compact = false,
  className = '',
}: GooglePlayBadgeProps) {
  return (
    <a
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download CoFarmz on Google Play"
      className={`group inline-flex items-center rounded-xl bg-gray-950 text-white ring-1 ring-white/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-lg hover:shadow-green-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
        compact ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-2.5'
      } ${className}`}
    >
      <svg viewBox="0 0 48 52" aria-hidden="true" className={compact ? 'h-6 w-6 flex-none' : 'h-8 w-8 flex-none'}>
        <path fill="#00d6ff" d="M3.5 2.6 27.8 26 3.5 49.4A6 6 0 0 1 1 44.5v-37a6 6 0 0 1 2.5-4.9Z" />
        <path fill="#00f076" d="m27.8 26 7.1-6.8L7.6 3.8a6.6 6.6 0 0 0-4.1-1.2L27.8 26Z" />
        <path fill="#ffdf00" d="m27.8 26-24.3 23.4a6.6 6.6 0 0 0 4.1-1.2l27.3-15.4-7.1-6.8Z" />
        <path fill="#ff4556" d="M44 24.3 34.9 19l-7.1 7 7.1 6.8 9.1-5.1c2.1-1.2 2.1-2.2 0-3.4Z" />
      </svg>
      <span className="text-left leading-none">
        <span className={`block uppercase tracking-[0.12em] text-gray-300 ${compact ? 'text-[7px]' : 'text-[9px]'}`}>
          Get it on
        </span>
        <span className={`mt-1 block whitespace-nowrap font-semibold tracking-tight ${compact ? 'text-xs' : 'text-base'}`}>
          Google Play
        </span>
      </span>
    </a>
  );
}
