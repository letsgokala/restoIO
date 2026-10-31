'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { loginSchema, type LoginFormValues } from '../schemas/login.schema';
import { useAuth } from '../hooks/use-auth';
import { Button } from '@/components/ui/button';
export function LoginForm() {
  const t = useTranslations('Auth');
  const auth = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });
  const onSubmit = handleSubmit(async ({ email, password }) => {
    const result = await auth.signIn(email, password);
    if (result) {
      const hasManagementAccess = result.user.isPlatformAdmin || result.memberships.some((membership) => ['RESTAURANT_OWNER', 'MANAGER'].includes(membership.role));
      const hasWaiterAccess = result.memberships.some((membership) => membership.role === 'WAITER');
      const hasKitchenAccess = result.memberships.some((membership) => membership.role === 'KITCHEN');
      window.location.assign(result.user.isPlatformAdmin ? '/platform' : hasManagementAccess ? '/manage' : hasKitchenAccess ? '/kitchen' : hasWaiterAccess ? '/waiter' : result.memberships.some((membership) => membership.role === 'CASHIER') ? '/cashier' : '/manage');
    }
  });
  return <form onSubmit={onSubmit} className="login-form">
    <label className="form-label" htmlFor="login-email">{t('email')}
      <input id="login-email" autoComplete="username" type="email" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined} {...register('email')} className="form-input" />
      {errors.email && <span id="login-email-error" className="form-error">{errors.email.message}</span>}
    </label>
    <label className="form-label" htmlFor="login-password">{t('password')}
      <input id="login-password" autoComplete="current-password" type="password" required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined} {...register('password')} className="form-input" />
      {errors.password && <span id="login-password-error" className="form-error">{errors.password.message}</span>}
    </label>
    {auth.error && <p role="alert" className="form-error">{t('failed')}</p>}
    <Button className="button--full" disabled={auth.loading}>{auth.loading ? t('submitting') : t('submit')}<span aria-hidden="true">→</span></Button>
  </form>;
}
