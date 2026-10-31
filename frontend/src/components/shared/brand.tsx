import Link from 'next/link';

type BrandProps = { light?: boolean };
export function Brand({ light = false }: BrandProps) {
  return <Link href="/" className={`brand ${light ? 'brand--light' : ''}`} aria-label="RestoIO home">
    <span className="brand-mark" aria-hidden="true">r<span>.</span></span>
    <span className="brand-word">resto<span>IO</span></span>
  </Link>;
}
