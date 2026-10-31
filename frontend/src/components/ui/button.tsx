import type { ButtonHTMLAttributes } from 'react';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' };
export function Button({ variant = 'primary', className = '', ...props }: Props) {
  const style = variant === 'primary' ? 'button button--primary' : 'button button--quiet';
  return <button className={`${style} ${className}`} {...props} />;
}
