'use client';

// ── UserAvatar ────────────────────────────────────────────────────────────────
// Drop-in replacement for <img> tags that fall back to initials avatar.
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

  // No image (null, undefined, empty string) — show initial avatar directly
  if (!image) {
    return (
      <span className={className} style={baseStyle} aria-label={name}>
        {initial}
      </span>
    );
  }

  // Image exists — render it with a hidden fallback sibling
  // If the image fails to load (404, broken URL, etc.), onError
  // hides the <img> and reveals the fallback <span>
  return (
    <>
      <img
        src={image}
        alt={name || ''}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          ...style,
        }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const sibling = e.currentTarget.nextElementSibling;
          if (sibling) sibling.style.removeProperty('display');
        }}
      />
      <span
        className={className}
        style={{ ...baseStyle, display: 'none' }}
        aria-label={name}
      >
        {initial}
      </span>
    </>
  );
}

export function getAvatarSrc(image) {
  return image || null;
}

export default UserAvatar;
