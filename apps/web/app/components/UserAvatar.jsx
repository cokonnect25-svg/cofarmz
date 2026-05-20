'use client';

// ── UserAvatar ────────────────────────────────────────────────────────────────
// Drop-in replacement for <img> tags that fall back to dicebear.
// Shows the user's profile image if available, otherwise shows
// the first letter of their name with a coloured background.
//
// Usage:
//   <UserAvatar image={user.image} name={user.name} size={40} className="rounded-full" />

const COLOURS = [
  ['#166534', '#bbf7d0'], // green
  ['#1d4ed8', '#bfdbfe'], // blue
  ['#7c3aed', '#ede9fe'], // purple
  ['#b45309', '#fef3c7'], // amber
  ['#0e7490', '#cffafe'], // cyan
  ['#be185d', '#fce7f3'], // pink
  ['#15803d', '#dcfce7'], // emerald
  ['#b91c1c', '#fee2e2'], // red
];

function pickColour(name) {
  const idx = (name?.charCodeAt(0) || 0) % COLOURS.length;
  return COLOURS[idx];
}

export function UserAvatar({ image, name, size = 40, className = '', style = {} }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const [bg, fg] = pickColour(name);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.4,
    fontWeight: 800,
    fontFamily: 'system-ui, sans-serif',
    background: bg,
    color: fg,
    userSelect: 'none',
    ...style,
  };

  if (image) {
    return (
      <img
        src={image}
        alt={name || ''}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
        onError={(e) => {
          // If image fails to load, replace with initial avatar
          e.currentTarget.style.display = 'none';
          const sibling = e.currentTarget.nextElementSibling;
          if (sibling) sibling.style.display = 'inline-flex';
        }}
      />
    );
  }

  return (
    <span className={className} style={baseStyle} aria-label={name}>
      {initial}
    </span>
  );
}

// Simpler version for cases where you need both img + fallback in same element
// Use this when you can't change markup easily — just replaces the src
export function getAvatarSrc(image, name) {
  // Returns image src if exists, otherwise returns null (use UserAvatar component instead)
  return image || null;
}

export default UserAvatar;