import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Brand } from '@/components/shared/brand';
import { ApiStatus } from '@/features/health/components/api-status';

export default async function HomePage() {
  const t = await getTranslations('Home');

  return <main className="page-shell landing-page">

    <header className="site-header landing-header">
      <Brand />
      <nav className="nav-links" aria-label={t('mainNavigation')}>
        <a href="#experience">{t('guestNav')}</a>
        <a href="#platform">{t('serviceNav')}</a>
        <a href="#story">{t('localTitle')}</a>
      </nav>
      <Link href="/login" className="button button--quiet">{t('signIn')} <span aria-hidden="true">↗</span></Link>
    </header>



    <section className="hero landing-hero" aria-labelledby="home-title">
      <div className="hero-copy landing-hero-copy">
        <div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" />{t('eyebrow')}</div>
        <h1 id="home-title" className="display-type hero-title">{t('titleStart')} <em>{t('titleAccent')}</em></h1>
        <p className="hero-description">{t('description')}</p>
        <div className="hero-actions">
          <Link href="/register" className="button button--primary">{t('createRestaurant')} <span aria-hidden="true">→</span></Link>
          <Link href="#platform" className="button button--quiet">{t('explorePlatform')} <span aria-hidden="true">↓</span></Link>
        </div>
        <div className="market-note"><span className="market-seal" aria-hidden="true">✳</span><span>{t('marketNote')}</span></div>
      </div>

      <div className="hero-visual landing-hero-visual">
        <figure className="photo-frame landing-photo-frame">
          <Image className="food-photo" src="https://images.unsplash.com/photo-1755811248279-1ab13b7d4384?auto=format&fit=crop&fm=jpg&q=88&w=1800" alt={t('foodAlt')} fill priority unoptimized sizes="(max-width: 700px) 92vw, (max-width: 1000px) 48vw, 650px" />
        </figure>
        <div className="hero-floating-card"><span className="floating-card-mark">✳</span><span><strong>{t('floatingTitle')}</strong><small>{t('floatingCopy')}</small></span><span className="floating-card-arrow" aria-hidden="true">↗</span></div>
        <div className="hero-api"><ApiStatus /></div>
      </div>
    </section>



    <section className="story-strip landing-benefits" aria-label={t('principlesLabel')}>
      <div className="story-strip-inner">
        <div className="story-point"><span className="story-index">01</span>{t('principleOne')}</div>
        <div className="story-point"><span className="story-index">02</span>{t('principleTwo')}</div>
        <div className="story-point"><span className="story-index">03</span>{t('principleThree')}</div>
      </div>
    </section>



    <section className="section platform-section" id="platform" aria-labelledby="platform-title">

        <div>
          <div className="section-kicker">{t('sectionKicker')}</div>
          <h2 id="platform-title" className="display-type section-title">{t('sectionTitle')}</h2>
        </div>
        <p className="section-copy">{t('sectionCopy')}</p>


      <div className="platform-showcase" id="experience">

          <span className="showcase-overline">{t('showcaseLabel')}</span>
          <h3>{t('showcaseTitle')}</h3>
          <p>{t('showcaseCopy')}</p>
          <Link href="/register" className="text-link">{t('buildWorkspace')} <span aria-hidden="true">↗</span></Link>


          <div className="preview-topbar"><span className="preview-window-dots"><i /><i /><i /></span><span>{t('tonight')}</span><span className="preview-live"><i /> {t('live')}</span></div>
          <div className="preview-content">
            <div className="preview-sidebar"><span className="preview-brand">r.</span><span className="preview-side-icon active">⌂</span><span className="preview-side-icon">▤</span><span className="preview-side-icon">◷</span><span className="preview-side-icon">⚙</span></div>
            <div className="preview-main">
              <div className="preview-heading"><div><small>{t('previewDay')}</small><strong>{t('goodEvening')}</strong></div><span className="preview-date">{t('dinnerRoom')}</span></div>
              <div className="preview-stats"><div><small>{t('openTables')}</small><strong>08 <i>+2</i></strong></div><div><small>{t('inKitchen')}</small><strong>04</strong></div><div><small>{t('readyToServe')}</small><strong>02</strong></div></div>
              <div className="preview-orders"><div className="preview-orders-title"><strong>{t('serviceFlow')}</strong><span>{t('viewAll')} <b>→</b></span></div>
                <div className="preview-order"><span className="order-table">04</span><span className="order-copy"><strong>{t('table')} 04</strong><small>2 · {t('justNow')}</small></span><span className="order-status preparing">{t('preparing')}</span></div>
                <div className="preview-order"><span className="order-table">08</span><span className="order-copy"><strong>{t('table')} 08</strong><small>3 · {t('fourMinutes')}</small></span><span className="order-status ready">{t('ready')}</span></div>
                <div className="preview-order"><span className="order-table">12</span><span className="order-copy"><strong>{t('table')} 12</strong><small>1 · {t('eightMinutes')}</small></span><span className="order-status served">{t('served')}</span></div>
              </div>
            </div>
          </div>
          <div className="preview-caption"><span>✳</span> {t('previewCaption')}</div>

      </div>

      <div className="pillar-grid landing-pillar-grid">
        <article className="pillar-card landing-pillar"><span className="pillar-icon" aria-hidden="true">⌕</span><div><span className="pillar-number">01 / {t('guests')}</span><h3>{t('guestTitle')}</h3><p>{t('guestCopy')}</p><span className="card-corner" aria-hidden="true">↗</span></div></article>
        <article className="pillar-card landing-pillar"><span className="pillar-icon" aria-hidden="true">◷</span><div><span className="pillar-number">02 / {t('service')}</span><h3>{t('teamTitle')}</h3><p>{t('teamCopy')}</p><span className="card-corner" aria-hidden="true">↗</span></div></article>
        <article className="pillar-card landing-pillar"><span className="pillar-icon" aria-hidden="true">✳</span><div><span className="pillar-number">03 / {t('localRoots')}</span><h3>{t('localTitle')}</h3><p>{t('localCopy')}</p><span className="card-corner" aria-hidden="true">↗</span></div></article>
      </div>
    </section>



    <section className="landing-story" id="story" aria-labelledby="story-title">
      <div className="landing-story-image">
        <Image src="https://images.unsplash.com/photo-1755811248279-1ab13b7d4384?auto=format&fit=crop&fm=jpg&q=88&w=1400" alt={t('storyImageAlt')} fill unoptimized sizes="(max-width: 700px) 100vw, 50vw" />
        <span>{t('storyImageCaption')}</span>
      </div>
      <div className="landing-story-copy">
        <div className="section-kicker">{t('localTitle')}</div>
        <h2 id="story-title" className="display-type">{t('storyTitle')}</h2>
        <p>{t('localCopy')}</p>
        <div className="story-detail"><span>✳</span><p><strong>{t('madeForHosts')}</strong><br />{t('storyDetail')}</p></div>
        <Link href="/register" className="button button--quiet">{t('bringRestaurant')} <span aria-hidden="true">→</span></Link>
      </div>
    </section>



    <section className="landing-close" aria-labelledby="close-title">
      <div className="close-ornament" aria-hidden="true">✳</div>
      <div className="section-kicker">{t('closeKicker')}</div>
      <h2 id="close-title" className="display-type">{t('closeTitleStart')}<br /><em>{t('closeTitleAccent')}</em></h2>
      <p>{t('closeCopy')}</p>
      <div className="hero-actions"><Link href="/register" className="button button--primary">{t('createAccount')} <span aria-hidden="true">→</span></Link><Link href="/login" className="button button--quiet">{t('signIn')} <span aria-hidden="true">↗</span></Link></div>
    </section>



    <footer className="site-footer landing-footer">
      <Brand />
      <span>{t('footer')}</span>
      <div><a href="#experience">{t('platform')}</a><Link href="/register">{t('createAccount')}</Link><Link href="/login">{t('signIn')}</Link></div>
    </footer>

  </main>;
}
