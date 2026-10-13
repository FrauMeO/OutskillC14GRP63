import type { ElementType, ReactNode } from 'react';

// One message component for problems and confirmations. The meaning is carried by
// a glyph and a visible text prefix as well as colour, so it never depends on colour alone.
// 'ok' is accepted as another name for 'success' because several pages already use it.
export type NoticeKind = 'error' | 'success' | 'ok';

export default function Notice({
  kind,
  children,
  as: Tag = 'p',
  className = '',
}: {
  kind: NoticeKind;
  children: ReactNode;
  as?: ElementType;
  /** Spacing, size and background classes. The text colour is set here. */
  className?: string;
}) {
  const isError = kind === 'error';
  const tone = isError ? 'text-alert' : 'text-current';
  return (
    <Tag role={isError ? 'alert' : 'status'} className={`${tone} ${className}`.trim()}>
      <span aria-hidden="true">{isError ? '⚠' : '✓'} </span>
      <strong className="font-semibold">{isError ? 'Problem:' : 'Done:'}</strong> {children}
    </Tag>
  );
}
