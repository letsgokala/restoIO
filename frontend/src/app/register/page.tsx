import Image from 'next/image';
import Link from 'next/link';
import { Brand } from '@/components/shared/brand';
import { RestaurantRegistrationForm } from '@/features/auth/components/restaurant-registration-form';

export default function RegisterPage() {
  return <main className="login-shell">
    <section className="login-visual" aria-label="Restaurant workspace setup">
      <Image className="login-photo" src="/images/ethiopian-dinner-placeholder.jpg" alt="" fill priority sizes="(max-width: 700px) 100vw, 48vw"/>
      <div className="login-visual-content"><Brand light/><div className="login-message"><div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true"/>YOUR RESTAURANT, YOUR WORKSPACE</div><h2 className="display-type">A better service starts here.</h2><p>Create your restaurant workspace, add your team, and get your first table ready for QR orders.</p></div><div className="login-photo-label">Restaurant setup</div></div>
    </section>
    <section className="login-panel register-panel">
      <div className="login-content">
        <div className="mobile-brand"><Brand/></div>
        <div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true"/>RESTAURANT OWNER SETUP</div>
        <h1 className="display-type login-title">Create your account</h1>
        <p className="login-subtitle">Your first branch is created with your workspace. You can add more branches, team members, tables, and menu items after signing in.</p>
        <RestaurantRegistrationForm/>
        <Link className="back-link" href="/">← Back to RestoIO</Link>
      </div>
    </section>
  </main>;
}
