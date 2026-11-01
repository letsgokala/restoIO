import { PlatformBootstrapForm } from '@/features/platform/components/platform-bootstrap-form';

export default function PlatformBootstrapPage() {
  return <main className="login-shell"><section className="login-panel register-panel"><div className="login-content"><div className="eyebrow">ONE-TIME PLATFORM SETUP</div><h1 className="display-type login-title">Create the platform administrator</h1><p className="login-subtitle">This setup works only while the server has no platform administrator and the one-time setup token is configured.</p><PlatformBootstrapForm/></div></section></main>;
}
