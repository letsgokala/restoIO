import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Brand } from '@/components/shared/brand';
import { Reveal } from '@/components/shared/reveal';
import { ApiStatus } from '@/features/health/components/api-status';

export default async function HomePage() {
  const t = await getTranslations('Home');
  return <main className="page-shell">
    <header className="site-header">
      <Brand />
      <nav className="nav-links" aria-label="Main navigation">
        <a href="#guest-experience">{t('guestNav')}</a>
        <a href="#service-tools">{t('serviceNav')}</a>
      </nav>
      <Link href="/login" className="button button--quiet">{t('signIn')} <span aria-hidden="true">↗</span></Link>
    </header>

    <section className="hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" />{t('eyebrow')}</div>
        <h1 id="home-title" className="display-type hero-title">{t('titleStart')} <em>{t('titleAccent')}</em></h1>
        <p className="hero-description">{t('description')}</p>
        <div className="hero-actions">
          <Link href="/login" className="button button--primary">{t('signIn')} <span aria-hidden="true">→</span></Link>
          <Link href="/register" className="button button--quiet">Create a restaurant</Link>
          <ApiStatus />
        </div>
        <div className="market-note"><span className="market-seal" aria-hidden="true">✳</span><span>{t('marketNote')}</span></div>
      </div>

      <div className="hero-visual">
        <figure className="photo-frame">
          <Image className="food-photo" src="/images/ethiopian-dinner-placeholder.jpg" alt={t('foodAlt')} fill priority sizes="(max-width: 700px) 90vw, (max-width: 900px) 43vw, 560px" />
          <span className="stock-label">{t('stockLabel')}</span>
          <figcaption className="photo-caption">{t('photoCredit')} <a href="https://unsplash.com/photos/a-white-plate-topped-with-lots-of-different-types-of-food-Bfy8z7EOyx4" target="_blank" rel="noreferrer">Unsplash</a></figcaption>
        </figure>
        <div className="photo-note"><strong>{t('photoNoteTitle')}</strong>{t('photoNote')}</div>
      </div>
    </section>

    <section className="story-strip" aria-label={t('principlesLabel')}>
      <div className="story-strip-inner">
        <div className="story-point"><span className="story-index">01</span>{t('principleOne')}</div>
        <div className="story-point"><span className="story-index">02</span>{t('principleTwo')}</div>
        <div className="story-point"><span className="story-index">03</span>{t('principleThree')}</div>
      </div>
    </section>

    <section className="section" aria-labelledby="guest-experience">
      <Reveal className="section-heading">
        <div className="section-kicker">{t('sectionKicker')}</div>
        <h2 id="guest-experience" className="display-type section-title">{t('sectionTitle')}</h2>
        <p className="section-copy">{t('sectionCopy')}</p>
      </Reveal>
      <div className="pillar-grid" id="service-tools">
        <Reveal delay={0}><article className="pillar-card"><span className="pillar-icon" aria-hidden="true">⌕</span><div><h3>{t('guestTitle')}</h3><p>{t('guestCopy')}</p></div></article></Reveal>
        <Reveal delay={90}><article className="pillar-card"><span className="pillar-icon" aria-hidden="true">◷</span><div><h3>{t('teamTitle')}</h3><p>{t('teamCopy')}</p></div></article></Reveal>
        <Reveal delay={180}><article className="pillar-card"><span className="pillar-icon" aria-hidden="true">✳</span><div><h3>{t('localTitle')}</h3><p>{t('localCopy')}</p></div></article></Reveal>
      </div>
    </section>

    <footer className="site-footer">
      <Brand />
      <span>{t('footer')}</span>
      <Link href="/login">{t('signIn')}</Link>
    </footer>
  </main>;
}
