import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

const LINK_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)]+$/;

function splitTrailingPunctuation(value: string) {
  const match = value.match(TRAILING_PUNCTUATION);
  if (!match) return { link: value, trailing: '' };
  return {
    link: value.slice(0, -match[0].length),
    trailing: match[0],
  };
}

function toHref(value: string) {
  return value.toLowerCase().startsWith('www.') ? `https://${value}` : value;
}

export default function LinkifiedText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  text.replace(LINK_PATTERN, (match, _matchValue, offset: number) => {
    if (offset > lastIndex) parts.push(text.slice(lastIndex, offset));

    const { link, trailing } = splitTrailingPunctuation(match);
    parts.push(
      <a
        key={`${link}-${offset}`}
        href={toHref(link)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-green-700 underline underline-offset-2 break-all hover:text-green-800"
        onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
        onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => event.stopPropagation()}
      >
        {link}
      </a>
    );
    if (trailing) parts.push(trailing);

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <p className={className}>{parts}</p>;
}
