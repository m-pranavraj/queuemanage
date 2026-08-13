import { useState, useEffect } from 'react';
import { useTranslation } from './translations';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowRight, BarChart3, Bell, CalendarDays, Check, CheckCircle2, ChevronRight,
  Clock3, ExternalLink, FileSearch, Landmark, ListChecks, MapPin, Menu, Plus, Printer,
  QrCode, RefreshCcw, Search, Settings2, ShieldCheck, SlidersHorizontal, Ticket,
  Trash2, UsersRound, X, LogOut, Lock, Key, ShieldAlert
} from 'lucide-react';
import {
  getGetAvailabilityQueryKey, getGetOfficeAnalyticsQueryKey, getGetOfficeDashboardQueryKey,
  getGetOfficeQueueQueryKey, getGetOfficeVisitQueryKey, getGetVisitStatusQueryKey,
  getGetOfficeAppointmentsQueryKey, getGetOfficeSlotsQueryKey, getSearchOfficeVisitsQueryKey,
  getGetOfficeUsersQueryKey,
  useCreateOfficeSlot, useCreateVisit, useDeleteOfficeSlot, useGetAvailability,
  useGetOfficeAnalytics, useGetOfficeAppointments, useGetOfficeDashboard, useGetOfficeQueue,
  useGetOfficeSlots, useGetOfficeVisit, useGetVisitStatus, useSaveVisitOutcome,
  useSearchOfficeVisits, useUpdateQueueAction,
  useLogin, useGetOfficeUsers, useCreateOfficeUser, useDeleteOfficeUser,
  setAuthTokenGetter, setBaseUrl
} from '@workspace/api-client-react';
import type {
  AppointmentSlotAdmin, DashboardSummary, OutcomeInput, QueueActionInput,
  VisitInput, UserResponse
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

// Initialize token getter from localStorage for all API requests
setAuthTokenGetter(() => localStorage.getItem('zp_session_token'));

if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value?: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const timeLabel = (value?: string | null) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

function Wordmark({ dark = false }: { dark?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3" data-testid="brand-wordmark">
      <div className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${dark ? 'border-white/20 bg-white/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}>
        <Landmark className={dark ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--secondary))]'} size={22} strokeWidth={1.7} />
        <span className="absolute bottom-1 left-2 right-2 h-0.5 rounded bg-[hsl(var(--primary))]" />
      </div>
      <div>
        <p className={`display-serif text-base font-bold tracking-tight ${dark ? 'text-white' : 'text-[hsl(var(--foreground))]'}`}>{t('zp_sampark')}</p>
        <p className={`mono-label mt-0.5 text-[9px] ${dark ? 'text-white/55' : 'text-[hsl(var(--muted-foreground))]'}`}>{t('citizen_desk')}</p>
      </div>
    </div>
  );
}

function PublicHeader() {
  const token = localStorage.getItem('zp_session_token');
  const role = localStorage.getItem('zp_user_role');
  const { t, lang, changeLanguage } = useTranslation();

  return (
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" data-testid="link-home-brand"><Wordmark /></Link>
        <nav className="flex items-center gap-2">
          <select 
            value={lang} 
            onChange={(e) => changeLanguage(e.target.value as any)}
            className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold outline-none hover:border-[hsl(var(--secondary))]"
            data-testid="select-language"
          >
            <option value="en">English</option>
            <option value="mr">मराठी</option>
            <option value="hi">हिंदी</option>
          </select>
          <Link href="/status/lookup" className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] sm:flex" data-testid="link-check-status">
            <Ticket size={16} /> {t('check_status')}
          </Link>
          <Link href="/qr" className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3 py-2 text-sm font-semibold text-[hsl(var(--secondary))] transition hover:border-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/5" data-testid="link-public-qr">
            <QrCode size={16} /> <span className="hidden sm:inline">{t('qr_entry')}</span>
          </Link>
          {token ? (
            <Link href="/office" className="flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90" data-testid="link-staff-console">
              {t('staff_desk')} ({role})
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-staff-login">
              {t('staff_login')}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function OfficeShell({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow: string }) {
  const [location, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const role = localStorage.getItem('zp_user_role') || '';
  const fullName = localStorage.getItem('zp_user_fullname') || 'PA';
  const { t, lang, changeLanguage } = useTranslation();

  const logout = () => {
    localStorage.removeItem('zp_session_token');
    localStorage.removeItem('zp_user_role');
    localStorage.removeItem('zp_user_name');
    localStorage.removeItem('zp_user_fullname');
    setLocation('/');
  };

  // Define links visible to roles
  const allLinks = [
    { href: '/office', label: t('live_desk'), icon: ListChecks, roles: ['admin', 'ceo', 'reception'] },
    { href: '/appointments', label: t('appointments'), icon: CalendarDays, roles: ['admin', 'ceo', 'reception'] },
    { href: '/office/analytics', label: t('analytics'), icon: BarChart3, roles: ['admin', 'ceo'] },
    { href: '/office/search', label: t('visitor_records'), icon: FileSearch, roles: ['admin', 'ceo', 'reception', 'officer'] },
    { href: '/admin', label: t('admin_settings'), icon: Settings2, roles: ['admin'] },
  ];

  const visibleLinks = allLinks.filter(link => link.roles.includes(role));

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between">
          <Wordmark dark />
          <button className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden" onClick={() => setMobileNav(false)} data-testid="button-close-office-nav"><X size={18} /></button>
        </div>
        <div className="mt-8 border-l-2 border-[hsl(var(--primary))] pl-4">
          <p className="mono-label text-[9px] text-white/50">Zilla Parishad</p>
          <p className="mt-1 font-serif text-sm text-white/90">Office of the Chief Executive Officer</p>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Office navigation">
          {visibleLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileNav(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${location === href ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'}`} data-testid={`link-office-${label.toLowerCase().replace(' ', '-')}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{location === href && <ChevronRight className="ml-auto text-[hsl(var(--primary))]" size={15} />}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between text-white/70">
              <span className="text-xs font-semibold">{fullName}</span>
              <Badge className="bg-[hsl(var(--primary))]/80 text-[10px] text-white capitalize">{role}</Badge>
            </div>
            <p className="mt-1 text-[10px] text-white/45">{t('authenticated_session')}</p>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2 border-white/10 text-white hover:bg-white/10 hover:text-white" onClick={logout} data-testid="button-logout">
            <LogOut size={16} /> {t('logout')}
          </Button>
        </div>
      </aside>
      {mobileNav && <button className="fixed inset-0 z-30 bg-[hsl(var(--foreground))]/40 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation" data-testid="button-office-nav-overlay" />}
      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-[hsl(var(--border))] p-2 lg:hidden" onClick={() => setMobileNav(true)} data-testid="button-open-office-nav"><Menu size={18} /></button>
              <div><p className="mono-label text-[10px] text-[hsl(var(--primary))]">{t(eyebrow)}</p><h1 className="display-serif mt-1 text-xl font-bold tracking-tight sm:text-2xl" data-testid="text-office-page-title">{t(title)}</h1></div>
            </div>
            <div className="flex items-center gap-3">
              <select 
                value={lang} 
                onChange={(e) => changeLanguage(e.target.value as any)}
                className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold outline-none hover:border-[hsl(var(--secondary))]"
                data-testid="select-language"
              >
                <option value="en">English</option>
                <option value="mr">मराठी</option>
                <option value="hi">हिंदी</option>
              </select>
              <div className="hidden text-right sm:block"><p className="text-xs font-semibold">Today, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p><p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('zp_sampark')}</p></div>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-white uppercase" data-testid="avatar-office-user">{fullName.slice(0, 2)}</div>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}

function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return <div className="space-y-3 animate-pulse-soft" data-testid="status-loading">{Array.from({ length: lines }).map((_, i) => <div key={i} className={`h-4 rounded bg-[hsl(var(--muted))] ${i === 0 ? 'w-2/3' : i === 1 ? 'w-full' : 'w-4/5'}`} />)}</div>;
}

function QueryError({ retry }: { retry: () => void }) {
  return <div className="rounded-2xl border border-[hsl(var(--destructive))]/25 bg-[hsl(var(--destructive))]/5 p-5 text-center" data-testid="status-query-error"><p className="font-semibold">We could not load this right now.</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Please try once more. Your place in the queue is not affected.</p><Button className="mt-4" variant="outline" onClick={retry} data-testid="button-retry-query"><RefreshCcw size={15} /> Try again</Button></div>;
}

// ---------------------------------------------------------------------------
// Route Protection Wrapper
// ---------------------------------------------------------------------------

function ProtectedRoute({ path, component: Component, allowedRoles }: { path: string; component: React.ComponentType<any>; allowedRoles?: string[] }) {
  const [location, setLocation] = useLocation();
  const token = localStorage.getItem('zp_session_token');
  const role = localStorage.getItem('zp_user_role');

  useEffect(() => {
    if (!token) {
      setLocation(`/login?redirect=${encodeURIComponent(location)}`);
    }
  }, [token, location, setLocation]);

  if (!token) return null;

  if (allowedRoles && !allowedRoles.includes(role || '')) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[hsl(var(--background))] p-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]">
          <ShieldAlert size={32} />
        </div>
        <h1 className="display-serif mt-6 text-3xl font-bold">403 Forbidden</h1>
        <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">You do not have the required role ({allowedRoles.join(', ')}) to view this operations panel.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90">Go Home</Link>
          <Button variant="outline" onClick={() => {
            localStorage.removeItem('zp_session_token');
            localStorage.removeItem('zp_user_role');
            setLocation('/login');
          }}>Log in with another account</Button>
        </div>
      </div>
    );
  }

  return <Route path={path} component={Component} />;
}

// ---------------------------------------------------------------------------
// Visitor Pages
// ---------------------------------------------------------------------------

function Home() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
      <PublicHeader />
      <section className="civic-grid relative overflow-hidden">
        <div className="absolute -right-28 top-14 h-72 w-72 rounded-full border-[18px] border-[hsl(var(--primary))]/10 sm:h-96 sm:w-96" />
        <div className="absolute -right-10 top-28 h-44 w-44 rounded-full border border-[hsl(var(--secondary))]/20" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/8 px-3 py-1.5 text-xs font-bold text-[hsl(var(--secondary))]" data-testid="status-civic-service"><span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))]" /> {t('public_service')}</div>
            <h1 className="display-serif mt-6 max-w-2xl text-4xl font-bold leading-[1.12] tracking-[-.04em] sm:text-6xl">{t('hero_title')}<br /><span className="text-[hsl(var(--primary))]">{t('hero_subtitle')}</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[hsl(var(--muted-foreground))] sm:text-lg">{t('hero_desc')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/book" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 text-sm font-bold text-white shadow-lg shadow-[hsl(var(--primary))]/20 transition hover:-translate-y-0.5" data-testid="link-start-registration">{t('start_registration')} <ArrowRight size={17} /></Link>
              <Link href="/status/lookup" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 text-sm font-bold text-[hsl(var(--secondary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-track-token">{t('track_token')} <Ticket size={17} /></Link>
            </div>
          </div>
          <div className="relative animate-rise [animation-delay:120ms]">
            <Card className="paper-shadow overflow-hidden border-0 bg-[hsl(var(--secondary))] text-white">
              <div className="flex items-center justify-between border-b border-white/12 px-5 py-4"><div><p className="mono-label text-[9px] text-white/50">{t('today_journey')}</p><p className="mt-1 text-sm font-semibold">{t('journey_subtitle')}</p></div><div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10"><Activity size={17} className="text-[hsl(var(--primary))]" /></div></div>
              <div className="space-y-0 px-5 py-5">
                {[['01', 'step1_title', 'step1_desc'], ['02', 'step2_title', 'step2_desc'], ['03', 'step3_title', 'step3_desc'], ['04', 'step4_title', 'step4_desc']].map(([number, titleKey, textKey], i) => (
                  <div className="relative flex gap-4 pb-7 last:pb-0" key={number} data-testid={`card-journey-step-${i + 1}`}>
                    {i < 3 && <span className="absolute left-[15px] top-8 h-full w-px bg-white/15" />}
                    <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[hsl(var(--primary))]/60 bg-[hsl(var(--secondary))] font-mono text-[10px] font-bold text-[hsl(var(--primary))]">{number}</span>
                    <div><p className="font-semibold">{t(titleKey)}</p><p className="mt-1 text-sm text-white/55">{t(textKey)}</p></div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 bg-white/7 px-5 py-4 text-xs text-white/60"><ShieldCheck size={15} className="text-[hsl(var(--primary))]" /> {t('info_care')}</div>
            </Card>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6 sm:py-14">
        {[{ icon: Clock3, title: t('promise1_title'), text: t('promise1_desc') }, { icon: MapPin, title: t('promise2_title'), text: t('promise2_desc') }, { icon: CheckCircle2, title: t('promise3_title'), text: t('promise3_desc') }].map(({ icon: Icon, title, text }, i) => <div key={title} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`card-service-promise-${i + 1}`}><Icon size={21} className={i === 1 ? 'text-[hsl(var(--secondary))]' : 'text-[hsl(var(--primary))]'} /><h2 className="mt-5 font-serif text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{text}</p></div>)}
      </section>
      <footer className="border-t border-[hsl(var(--border))] px-4 py-6 sm:px-6"><div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between"><span data-testid="text-footer-office">{t('footer_office')}</span><span data-testid="text-footer-help">{t('footer_help')}</span></div></footer>
    </div>
  );
}

function QRPage() {
  const { t } = useTranslation();
  const bookingUrl = new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/book`, window.location.origin).toString();
  const qrImageUrl = `https://quickchart.io/qr?size=360&margin=2&text=${encodeURIComponent(bookingUrl)}`;
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))]"><PublicHeader /><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16"><Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--muted-foreground))]" data-testid="link-qr-back"><ChevronRight className="rotate-180" size={15} /> {t('back_to_sampark')}</Link><div className="mt-8 grid gap-8 md:grid-cols-[.9fr_1.1fr] md:items-center"><div><p className="mono-label text-[10px] text-[hsl(var(--primary))]">{t('qr_entry')}</p><h1 className="display-serif mt-2 text-3xl font-bold sm:text-4xl">{t('scan_register_title')}</h1><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('scan_register_desc')}</p><div className="mt-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><p className="mono-label text-[9px] text-[hsl(var(--muted-foreground))]">{t('exposed_url')}</p><p className="mt-2 break-all font-mono text-xs font-semibold" data-testid="text-exposed-booking-url">{bookingUrl}</p></div><div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => window.print()} data-testid="button-print-qr"><Printer size={16} /> {t('print_qr')}</Button><a href={bookingUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 text-sm font-semibold text-[hsl(var(--secondary))]" data-testid="link-open-booking-url"><ExternalLink size={16} /> {t('open_reg')}</a></div></div><Card className="paper-shadow border-0 p-6 text-center sm:p-8"><div className="mx-auto max-w-[360px] rounded-2xl bg-white p-3"><img src={qrImageUrl} alt={`QR code for ${bookingUrl}`} className="mx-auto aspect-square w-full" data-testid="img-registration-qr" /></div><p className="mt-5 font-serif text-lg font-bold">{t('zp_sampark')} {t('wizard_title')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('public_link_desc')}</p></Card></div></main></div>;
}

type BookState = Record<string, string | boolean | number>;
const bookDefaults: BookState = {
  fullName: '', mobile: '', taluka: 'Baramati', location: '', organisation: '',
  purpose: '', category: 'Grievance', department: 'Water & Sanitation', description: '',
  previouslyApproached: false, previousDepartment: '', previousDate: '', previousReference: '',
  visitType: 'walk_in', appointmentDate: today(), appointmentSlot: '', appointmentDuration: 5,
  priority: 'normal'
};

function Field({ label, name, value, onChange, placeholder, type = 'text', required = false }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name} className="text-sm font-semibold">{label}{required && <span className="ml-1 text-[hsl(var(--primary))]">*</span>}</Label><Input id={name} name={name} value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={placeholder} type={type} required={required} data-testid={`input-${name}`} /></div>;
}

function Book() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1); // 1: Details, 2: Visit Plan, 3: Review
  const [form, setForm] = useState<BookState>(bookDefaults);
  const [created, setCreated] = useState<{ token: string; id: number } | null>(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState(String(form.appointmentDate));

  const availability = useGetAvailability({ date }, { query: { queryKey: getGetAvailabilityQueryKey({ date }) } });
  const createVisit = useCreateVisit();
  const setValue = (name: string, value: string | boolean | number) => setForm((current) => ({ ...current, [name]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const payload: VisitInput = {
      fullName: String(form.fullName),
      mobile: String(form.mobile),
      taluka: String(form.taluka),
      location: String(form.location),
      organisation: String(form.organisation) || null,
      purpose: String(form.purpose),
      category: String(form.category),
      department: String(form.department),
      description: String(form.description),
      previouslyApproached: Boolean(form.previouslyApproached),
      previousDepartment: String(form.previousDepartment) || null,
      previousDate: String(form.previousDate) || null,
      previousReference: String(form.previousReference) || null,
      visitType: form.visitType === 'walk_in' ? 'walk_in' : 'appointment',
      appointmentDate: form.visitType === 'appointment' ? String(form.appointmentDate) : null,
      appointmentSlot: form.visitType === 'appointment' ? String(form.appointmentSlot) || null : null,
      appointmentDuration: form.visitType === 'appointment' ? Number(form.appointmentDuration) : 5,
      priority: form.priority as any
    };

    createVisit.mutate({ data: payload }, {
      onSuccess: (visit) => {
        queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey({ date }) });
        queryClient.invalidateQueries({ queryKey: getGetOfficeDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOfficeQueueQueryKey() });
        setCreated({ token: visit.token, id: visit.id });
      },
      onError: () => {
        setError('We could not register this visit. Please check details and try again.');
      }
    });
  };

  // Compute availability for consecutive 5-min slots client-side
  const getFilteredSlots = () => {
    const rawSlots = availability.data?.slots ?? [];
    const duration = Number(form.appointmentDuration);
    const numSlotsNeeded = Math.ceil(duration / 5);

    if (numSlotsNeeded <= 1) return rawSlots;

    return rawSlots.map((slot, idx) => {
      // Check if slot and the next (numSlotsNeeded - 1) slots are all available
      let isConsecAvailable = true;
      let minRemaining = slot.remaining;

      for (let k = 0; k < numSlotsNeeded; k++) {
        const targetIndex = idx + k;
        if (targetIndex >= rawSlots.length) {
          isConsecAvailable = false;
          minRemaining = 0;
          break;
        }
        const targetSlot = rawSlots[targetIndex];
        if (!targetSlot.available || targetSlot.remaining <= 0) {
          isConsecAvailable = false;
          minRemaining = 0;
          break;
        }
        minRemaining = Math.min(minRemaining, targetSlot.remaining);
      }

      return {
        ...slot,
        available: isConsecAvailable,
        remaining: minRemaining,
      };
    });
  };

  if (created) {
    return (
      <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
        <PublicHeader />
        <div className="mx-auto max-w-lg px-4 py-12 sm:py-20">
          <Card className="paper-shadow overflow-hidden border-0">
            <div className="h-2 bg-[hsl(var(--secondary))]" />
            <div className="p-6 text-center sm:p-10">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))]"><CheckCircle2 size={32} /></div>
              <p className="mono-label mt-6 text-[10px] text-[hsl(var(--secondary))] font-bold">Registration received</p>
              <h1 className="display-serif mt-3 text-3xl font-bold">Keep this token safe</h1>
              <div className={`mt-7 rounded-2xl p-5 text-white ${created.token.startsWith('VVIP-') ? 'bg-amber-600 shadow-amber-600/30 shadow-lg' : 'bg-[hsl(var(--secondary))]'}`}>
                <p className="text-xs text-white/75">{created.token.startsWith('VVIP-') ? '🌟 VVIP Priority Token' : 'Your Sampark token'}</p>
                <p className="mt-2 font-mono text-4xl font-bold tracking-[.18em]" data-testid="text-created-token">{created.token}</p>
              </div>
              <p className="mt-6 text-sm leading-6 text-[hsl(var(--muted-foreground))] font-medium">Please present this token at the entrance desk. You can follow your queue position online.</p>
              <div className="mt-6 flex flex-col gap-3">
                <Link href={`/status/${created.token}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-white shadow-md hover:opacity-90" data-testid="link-view-created-status">View live status <ArrowRight size={16} /></Link>
                <Link href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-[hsl(var(--border))] text-sm font-bold text-[hsl(var(--secondary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-return-home">Return to Home</Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const stepsList = [t('step_details'), t('step_plan'), t('step_confirm')];
  
  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--muted-foreground))]" data-testid="link-book-back"><ChevronRight className="rotate-180" size={15} /> {t('back_to_home')}</Link>
          <p className="mono-label mt-8 text-[10px] text-[hsl(var(--primary))] font-bold">{t('wizard_title')}</p>
          <h1 className="display-serif mt-2 text-3xl font-bold sm:text-4xl">{t('let_us_understand')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('wizard_subtitle')}</p>
        </div>

        <div className="mb-7 flex items-center gap-2">
          {stepsList.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2" data-testid={`step-${i + 1}`}>
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${step > i + 1 ? 'bg-[hsl(var(--secondary))] text-white' : step === i + 1 ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{step > i + 1 ? <Check size={14} /> : i + 1}</div>
              <span className={`hidden text-xs font-semibold sm:block ${step === i + 1 ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{label}</span>
              {i < stepsList.length - 1 && <span className="h-px flex-1 bg-[hsl(var(--border))]" />}
            </div>
          ))}
        </div>

        <Card className="paper-shadow border-0 p-5 sm:p-8">
          {step === 1 && (
            <div className="space-y-6 animate-rise">
              <div>
                <h2 className="font-serif text-xl font-bold">{t('step_details')}</h2>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('provide_details_desc')}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('full_name')} name="fullName" value={String(form.fullName)} onChange={setValue} placeholder="Visitor's name" required />
                <Field label={t('mobile_number')} name="mobile" value={String(form.mobile)} onChange={setValue} placeholder="10-digit mobile number" type="tel" required />
                <div className="space-y-2">
                  <Label htmlFor="taluka" className="text-sm font-semibold">{t('taluka')}</Label>
                  <select id="taluka" name="taluka" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(form.taluka)} onChange={(e) => setValue('taluka', e.target.value)} data-testid="select-taluka">
                    {['Baramati', 'Indapur', 'Daund', 'Shirur', 'Purandar', 'Bhor', 'Velhe', 'Maval', 'Mulshi', 'Haveli', 'Khed', 'Ambegaon', 'Junnar'].map((name) => (
                      <option key={name} value={name}>{t(name)}</option>
                    ))}
                  </select>
                </div>
                <Field label={t('village')} name="location" value={String(form.location)} onChange={setValue} placeholder="Where do you live?" required />
                <Field label={t('org')} name="organisation" value={String(form.organisation)} onChange={setValue} placeholder="If representing an entity" />
              </div>

              <div>
                <Label htmlFor="purpose" className="text-sm font-semibold">{t('purpose')}<span className="ml-1 text-[hsl(var(--primary))]*">*</span></Label>
                <Input id="purpose" name="purpose" value={String(form.purpose)} onChange={(e) => setValue('purpose', e.target.value)} placeholder="Brief title of your request" className="mt-2" required data-testid="input-purpose" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-semibold">{t('wizard_title')}</Label>
                  <select id="category" name="category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(form.category)} onChange={(e) => setValue('category', e.target.value)} data-testid="select-category">
                    {['Grievance', 'Government Scheme', 'Education', 'Health', 'Water / Sanitation', 'Rural Development', 'Employment / Skill Development', 'Infrastructure / Roads', 'SHG / Livelihood', 'Agriculture', 'Administrative Matter', 'Proposal / Partnership', 'Personal Appointment', 'Other'].map((cat) => (
                      <option key={cat} value={cat}>{t(cat)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-sm font-semibold">{t('department')}</Label>
                  <select id="department" name="department" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(form.department)} onChange={(e) => setValue('department', e.target.value)} data-testid="select-department">
                    {['General Administration', 'Rural Development', 'Revenue', 'Education', 'Health', 'Water & Sanitation', 'Women & Child Development', 'Agriculture', 'Finance', 'Works (Roads & Infra)'].map((dept) => (
                      <option key={dept} value={dept}>{t(dept)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">{t('explain_request_desc')}<span className="ml-1 text-[hsl(var(--primary))]*">*</span></Label>
                <Textarea id="description" value={String(form.description)} onChange={(e) => setValue('description', e.target.value)} maxLength={250} placeholder={t('explain_request_placeholder')} required data-testid="textarea-description" />
                <p className="text-right text-xs text-[hsl(var(--muted-foreground))]">{String(form.description).length}/250</p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--border))] p-4">
                <input type="checkbox" checked={Boolean(form.previouslyApproached)} onChange={(e) => setValue('previouslyApproached', e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" data-testid="input-previously-approached" />
                <span>
                  <span className="block text-sm font-semibold">{t('approached_before')}</span>
                  <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('approached_dept_desc')}</span>
                </span>
              </label>

              {Boolean(form.previouslyApproached) && (
                <div className="grid gap-5 rounded-xl bg-[hsl(var(--muted))]/60 p-4 sm:grid-cols-3">
                  <Field label={t('dept_officer')} name="previousDepartment" value={String(form.previousDepartment)} onChange={setValue} placeholder="Name of officer" />
                  <Field label={t('prev_date')} name="previousDate" value={String(form.previousDate)} onChange={setValue} type="date" />
                  <Field label={t('ref_id')} name="previousReference" value={String(form.previousReference)} onChange={setValue} placeholder="e.g. ZP/REVENUE/2026/12" />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Link href="/" className="inline-flex h-10 items-center justify-center rounded-md border border-[hsl(var(--border))] px-4 text-sm font-semibold text-[hsl(var(--secondary))] transition hover:bg-[hsl(var(--muted))]">{t('cancel')}</Link>
                <Button type="button" onClick={() => setStep(2)} disabled={!form.fullName || !form.mobile || String(form.mobile).length < 10 || !form.location || !form.purpose || !form.description} data-testid="button-next-visit-plan">{t('continue')} <ArrowRight size={16} /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-rise">
              <div>
                <h2 className="font-serif text-xl font-bold">Appointment type & scheduling</h2>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Choose to book an appointment slot or enter the walk-in queue today.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[{ value: 'appointment', title: t('book_appointment_title'), text: t('book_appointment_desc') },
                  { value: 'walk_in', title: t('register_walkin_title'), text: t('register_walkin_desc') }].map((item) => (
                  <button type="button" key={item.value} onClick={() => setValue('visitType', item.value)} className={`rounded-xl border p-4 text-left transition ${form.visitType === item.value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/7 ring-1 ring-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`button-visit-type-${item.value}`}>
                    <div className="flex items-center justify-between"><span className="font-semibold text-sm">{item.title}</span>{form.visitType === item.value && <CheckCircle2 size={17} className="text-[hsl(var(--primary))]" />}</div>
                    <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{item.text}</p>
                  </button>
                ))}
              </div>

              {form.visitType === 'appointment' && (
                <div className="rounded-2xl bg-[hsl(var(--muted))]/65 p-4 sm:p-5 space-y-5 animate-rise">
                  <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
                    <div className="space-y-3">
                      <Label htmlFor="appointmentDate" className="text-sm font-semibold">{t('preferred_date')}</Label>
                      <Input id="appointmentDate" type="date" min={today()} value={String(form.appointmentDate)} onChange={(e) => { setValue('appointmentDate', e.target.value); setDate(e.target.value); }} data-testid="input-appointment-date" />

                      <Label htmlFor="appointmentDuration" className="text-sm font-semibold mt-4 block">{t('duration')}</Label>
                      <select id="appointmentDuration" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={Number(form.appointmentDuration)} onChange={(e) => { setValue('appointmentDuration', Number(e.target.value)); setValue('appointmentSlot', ''); }} data-testid="select-duration">
                        <option value={5}>5 {t('minutes')} (1 slot)</option>
                        <option value={10}>10 {t('minutes')} (2 slots)</option>
                        <option value={15}>15 {t('minutes')} (3 slots max)</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-sm font-semibold">{t('available_slots')} ({form.appointmentDuration} {t('minutes')})</Label>
                      {availability.isLoading ? (
                        <div className="mt-3 grid grid-cols-2 gap-2"><LoadingBlock lines={1} /><LoadingBlock lines={1} /></div>
                      ) : availability.isError ? (
                        <p className="mt-3 text-sm text-[hsl(var(--destructive))]">{t('slots_unavailable')}</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                          {getFilteredSlots().map((slot) => (
                            <button type="button" key={slot.id} disabled={!slot.available} onClick={() => setValue('appointmentSlot', slot.id)} className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${form.appointmentSlot === slot.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : slot.available ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5' : 'cursor-not-allowed border-transparent bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] line-through opacity-40'}`} data-testid={`button-slot-${slot.id}`}>
                              <span>{slot.label}</span>
                              <span className="mt-0.5 block text-[9px] opacity-75">{slot.available ? `${slot.remaining} seats` : 'Full'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">{t('priority_status_audited')}</Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  {[{ value: 'normal', label: t('normal'), text: t('priority_normal_desc') },
                    { value: 'priority', label: t('priority_level'), text: t('priority_level_desc') },
                    { value: 'official', label: t('official'), text: t('priority_official_desc') },
                    { value: 'vvip', label: t('vvip'), text: t('priority_vvip_desc') }].map((item) => (
                    <button type="button" key={item.value} onClick={() => setValue('priority', item.value)} className={`rounded-xl border p-3 text-left transition ${form.priority === item.value ? 'border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/8' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`button-priority-${item.value}`}>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-1 block text-[10px] text-[hsl(var(--muted-foreground))]">{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>{t('prev')}</Button>
                <Button type="button" onClick={() => setStep(3)} disabled={form.visitType === 'appointment' && !form.appointmentSlot} data-testid="button-next-confirm">{t('review_reg')} <ArrowRight size={16} /></Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={submit} className="space-y-6 animate-rise" data-testid="form-visit-registration">
              <div>
                <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">{t('final_check')}</p>
                <h2 className="display-serif mt-2 text-2xl font-bold">{t('please_review')}</h2>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('ensure_correct')}</p>
              </div>

              <div className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))]">
                {[
                  [t('full_name'), form.fullName],
                  [t('mobile_number'), form.mobile],
                  [`${t('taluka')} / ${t('village')}`, `${t(String(form.taluka))} / ${form.location}`],
                  [t('department'), t(String(form.department))],
                  [t('wizard_title'), t(String(form.category))],
                  [t('purpose'), form.purpose],
                  [t('priority'), t(String(form.priority))],
                  [t('visit_type'), form.visitType === 'appointment' ? `${t('appointment')} · ${dateLabel(String(form.appointmentDate))}` : t('walkin')],
                  [t('duration'), form.visitType === 'appointment' ? `${form.appointmentDuration} ${t('minutes')} @ ${availability.data?.slots.find((slot) => slot.id === form.appointmentSlot)?.label ?? 'Selected slot'}` : t('walkin')],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span className="text-[hsl(var(--muted-foreground))] font-semibold">{label}</span>
                    <span className="text-right font-bold capitalize" data-testid={`text-review-${String(label).toLowerCase().replaceAll(' ', '-')}`}>{String(value)}</span>
                  </div>
                ))}
              </div>

              {error && <p className="rounded-lg bg-[hsl(var(--destructive))]/8 p-3 text-sm text-[hsl(var(--destructive))] font-semibold" data-testid="status-registration-error">{error}</p>}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>{t('prev')}</Button>
                <Button type="submit" disabled={createVisit.isPending} data-testid="button-submit-registration" className="bg-[hsl(var(--secondary))] text-white">
                  {createVisit.isPending ? `${t('registering')}` : `${t('confirm_get_token')}`} <Check size={16} />
                </Button>
              </div>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}

function Status() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const [lookup, setLookup] = useState(token === 'lookup' ? '' : token);
  const activeToken = token === 'lookup' ? lookup.trim() : token;
  const status = useGetVisitStatus(activeToken, { query: { enabled: activeToken.length > 2, queryKey: getGetVisitStatusQueryKey(activeToken), refetchInterval: 10000 } });
  const visit = status.data;

  const submitLookup = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--muted-foreground))]" data-testid="link-status-back"><ChevronRight className="rotate-180" size={15} /> {t('back_to_home')}</Link>

        {token === 'lookup' && (
          <Card className="paper-shadow mt-8 border-0 p-6 sm:p-8">
            <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">{t('lookup_title')}</p>
            <h1 className="display-serif mt-2 text-3xl font-bold">{t('enter_token')}</h1>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('lookup_desc')}</p>
            <form className="mt-6 flex gap-2" onSubmit={submitLookup}>
              <Input value={lookup} onChange={(e) => setLookup(e.target.value.toUpperCase())} placeholder="e.g. CEO-001 or VVIP-002" className="font-mono uppercase tracking-widest text-lg" data-testid="input-status-token" />
              <Button type="submit" disabled={lookup.length < 3} data-testid="button-find-status">{t('check')} <Search size={16} /></Button>
            </form>
          </Card>
        )}

        {activeToken.length > 2 && (
          <div className="mt-8">
            {status.isLoading && <Card className="border-0 p-6"><LoadingBlock lines={5} /></Card>}
            {status.isError && <QueryError retry={() => status.refetch()} />}
            {visit && (
              <Card className="paper-shadow overflow-hidden border-0">
                <div className={`h-2 ${visit.token.startsWith('VVIP-') ? 'bg-amber-600' : 'bg-[hsl(var(--secondary))]'}`} />
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">{t('token_label')}</p>
                        {visit.priority === 'vvip' && <Badge className="bg-amber-600 text-white text-[9px] px-1.5 py-0">🌟 VVIP</Badge>}
                      </div>
                      <p className="mt-2 font-mono text-3xl font-bold tracking-wider" data-testid="text-status-token">{visit.token}</p>
                      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] font-semibold">{t('full_name')}: {visit.fullName}</p>
                    </div>
                    <Badge className={`w-fit px-3 py-1.5 text-white capitalize ${visit.token.startsWith('VVIP-') ? 'bg-amber-600' : 'bg-[hsl(var(--secondary))]'}`} data-testid="status-visit-state">{t(`status_${visit.status}`)}</Badge>
                  </div>

                  <div className="mt-8 grid grid-cols-3 gap-2 rounded-xl bg-[hsl(var(--muted))]/60 p-4 text-center">
                    <div>
                      <p className="mono-label text-[9px] text-[hsl(var(--muted-foreground))] font-bold">{t('queue_position')}</p>
                      <p className="mt-2 font-serif text-2xl font-bold" data-testid="text-status-position">{visit.status === 'waiting' ? visit.queuePosition : '—'}</p>
                    </div>
                    <div className="border-x border-[hsl(var(--border))]">
                      <p className="mono-label text-[9px] text-[hsl(var(--muted-foreground))] font-bold">{t('est_wait')}</p>
                      <p className="mt-2 font-serif text-2xl font-bold" data-testid="text-status-wait">
                        {visit.status === 'waiting' ? (visit.token.startsWith('VVIP-') ? '~5m' : `${(visit.queuePosition ?? 1) * 5}m`) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="mono-label text-[9px] text-[hsl(var(--muted-foreground))] font-bold">{t('visit_type')}</p>
                      <p className="mt-2 text-xs font-bold text-wrap" data-testid="text-status-visit-date">{visit.visitType === 'appointment' ? dateLabel(visit.appointmentDate) : t('walkin')}</p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="mono-label text-[10px] text-[hsl(var(--muted-foreground))] font-bold">{t('journey_subtitle')}</p>
                    <div className="mt-4 space-y-4">
                      {[
                        [t('registration_received'), true],
                        [t('status_waiting'), ['waiting', 'called', 'held', 'completed'].includes(visit.status)],
                        [t('called_list'), ['called', 'completed'].includes(visit.status)],
                        [t('status_completed'), visit.status === 'completed']
                      ].map(([label, done], i) => (
                        <div className="flex items-center gap-3" key={String(label)} data-testid={`status-timeline-${i + 1}`}>
                          <div className={`grid h-7 w-7 place-items-center rounded-full ${done ? (visit.token.startsWith('VVIP-') ? 'bg-amber-600 text-white' : 'bg-[hsl(var(--secondary))] text-white') : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{done ? <Check size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</div>
                          <span className={`text-sm ${done ? 'font-semibold' : 'text-[hsl(var(--muted-foreground))]'}`}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {visit.outcome && (
                      <div className="mt-8 rounded-xl border border-[hsl(var(--secondary))]/25 bg-[hsl(var(--secondary))]/5 p-5 animate-rise">
                        <p className="mono-label text-[9px] text-[hsl(var(--secondary))] font-bold">{t('referred_to')}</p>
                        <p className="mt-2 font-serif font-bold text-lg capitalize text-[hsl(var(--secondary))]" data-testid="text-status-outcome">{t(visit.outcome)}</p>
                        {visit.notes && <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] bg-white border border-[hsl(var(--border))] rounded-lg p-3 italic">"{visit.notes}"</p>}
                        {visit.referredTo && <p className="mt-2 text-xs font-semibold">{t('department')}: <span className="text-[hsl(var(--primary))]">{t(visit.referredTo)}</span></p>}
                        {visit.referenceNumber && <p className="mt-4 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{t('ref_num')}: {visit.referenceNumber}</p>}
                      </div>
                    )}

                    <p className="mt-8 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('token_desc')}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [, setLocation] = useLocation();
  const query = new URLSearchParams(window.location.search);
  const redirect = query.get('redirect') || '/office';

  const loginMutation = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    loginMutation.mutate({
      data: { username, password }
    }, {
      onSuccess: (result) => {
        localStorage.setItem('zp_session_token', result.token);
        localStorage.setItem('zp_user_role', result.role);
        localStorage.setItem('zp_user_name', result.username);
        localStorage.setItem('zp_user_fullname', result.fullName);
        setLocation(redirect);
      },
      onError: (err: any) => {
        setLoginError(err?.message || 'Login failed. Please check credentials and try again.');
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[hsl(var(--background))]">
      <PublicHeader />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md paper-shadow overflow-hidden border-0">
          <div className="h-2 bg-[hsl(var(--primary))]" />
          <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-6">
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]">
                <Lock size={20} />
              </div>
              <h1 className="display-serif mt-4 text-2xl font-bold">Office Login</h1>
              <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">Authentication is required to access queue operations and dashboard panels.</p>
            </div>

            {loginError && (
              <div className="rounded-lg bg-[hsl(var(--destructive))]/8 p-3 text-xs text-[hsl(var(--destructive))] font-semibold">
                {loginError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-bold uppercase">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]"><UsersRound size={15} /></span>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9" placeholder="e.g. admin or ceo" required data-testid="input-login-username" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase">Password</Label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]"><Key size={15} /></span>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" required data-testid="input-login-password" />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full shadow-sm" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Authenticating…' : 'Sign In to Portal'}
            </Button>

            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3 space-y-1">
              <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase">Default roles for testing</p>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                <span>Admin: <span className="font-mono font-bold">admin / admin123</span></span>
                <span>CEO: <span className="font-mono font-bold">ceo / ceo123</span></span>
                <span>PA/Desk: <span className="font-mono font-bold">reception / reception123</span></span>
                <span>Officer: <span className="font-mono font-bold">officer / officer123</span></span>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protected Staff Pages
// ---------------------------------------------------------------------------

function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const items = [
    { label: 'Registered today', value: summary.registered, icon: UsersRound, tone: 'primary' },
    { label: 'Waiting now', value: summary.waiting, icon: Clock3, tone: 'green' },
    { label: 'Completed', value: summary.completed, icon: CheckCircle2, tone: 'ink' },
    { label: 'Average wait', value: `${summary.averageWait}m`, icon: Activity, tone: 'gold' }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="border-0 p-4 paper-shadow" data-testid={`card-summary-${label.toLowerCase().replaceAll(' ', '-')}`}>
          <div className={`grid h-9 w-9 place-items-center rounded-lg ${tone === 'primary' ? 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]' : tone === 'green' ? 'bg-[hsl(var(--secondary))]/12 text-[hsl(var(--secondary))]' : tone === 'gold' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--secondary))]'}`}><Icon size={18} /></div>
          <p className="mt-5 font-serif text-3xl font-bold" data-testid={`text-summary-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] font-semibold">{label}</p>
        </Card>
      ))}
    </div>
  );
}

function Office() {
  const client = useQueryClient();
  const dashboard = useGetOfficeDashboard({ query: { queryKey: getGetOfficeDashboardQueryKey(), refetchInterval: 10000 } });
  const queue = useGetOfficeQueue({ query: { queryKey: getGetOfficeQueueQueryKey(), refetchInterval: 10000 } });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState('resolved');
  const [notes, setNotes] = useState('');
  const [referredTo, setReferredTo] = useState('General Administration');
  const [followUpDate, setFollowUpDate] = useState('');

  const selected = useGetOfficeVisit(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetOfficeVisitQueryKey(selectedId ?? 0) } });
  const queueAction = useUpdateQueueAction();
  const saveOutcome = useSaveVisitOutcome();

  const refresh = () => {
    dashboard.refetch();
    queue.refetch();
  };

  const act = (id: number, action: QueueActionInput['action']) => {
    queueAction.mutate({ id, data: { action } }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getGetOfficeDashboardQueryKey() });
        client.invalidateQueries({ queryKey: getGetOfficeQueueQueryKey() });
        client.invalidateQueries({ queryKey: getGetOfficeVisitQueryKey(id) });
      }
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId === null) return;

    saveOutcome.mutate({
      id: selectedId,
      data: {
        outcome: outcome as OutcomeInput['outcome'],
        notes: notes || null,
        referredTo: outcome === 'referred' ? referredTo : null,
        followUpDate: followUpDate || null
      }
    }, {
      onSuccess: () => {
        setNotes('');
        setFollowUpDate('');
        setSelectedId(null);
        client.invalidateQueries({ queryKey: getGetOfficeDashboardQueryKey() });
        client.invalidateQueries({ queryKey: getGetOfficeQueueQueryKey() });
        client.invalidateQueries({ queryKey: getGetOfficeVisitQueryKey(selectedId) });
        client.invalidateQueries({ queryKey: getGetOfficeAnalyticsQueryKey() });
      }
    });
  };

  return (
    <OfficeShell title="CEO Queue Panel" eyebrow="Live operations">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Monitor live wait lists, check in walk-ins, view briefing files, and dispatch case outcomes.</p>
          </div>
          <Button variant="outline" onClick={refresh} data-testid="button-refresh-office" className="shadow-sm"><RefreshCcw size={15} /> Refresh queue</Button>
        </div>

        {dashboard.isLoading ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Card key={i} className="h-32 border-0 p-4"><LoadingBlock lines={3} /></Card>)}</div>
        ) : dashboard.isError ? (
          <QueryError retry={() => dashboard.refetch()} />
        ) : (
          dashboard.data && <SummaryCards summary={dashboard.data} />
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <Card className="border-0 paper-shadow">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5">
              <div>
                <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">Live queue</p>
                <h2 className="mt-1 font-serif text-xl font-bold">Active Visitors</h2>
              </div>
              <Badge variant="outline" data-testid="status-queue-count" className="font-bold">{queue.data?.length ?? 0} waiting</Badge>
            </div>

            {queue.isLoading ? (
              <div className="space-y-4 p-5"><LoadingBlock lines={5} /></div>
            ) : queue.isError ? (
              <div className="p-5"><QueryError retry={() => queue.refetch()} /></div>
            ) : queue.data?.length ? (
              <div className="divide-y divide-[hsl(var(--border))]">
                {queue.data.map((entry) => (
                  <button className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-[hsl(var(--muted))]/60 ${selectedId === entry.id ? 'bg-[hsl(var(--primary))]/6' : ''}`} key={entry.id} onClick={() => setSelectedId(entry.id)} data-testid={`row-queue-entry-${entry.id}`}>
                    <span className={`grid h-9 w-12 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-bold text-white uppercase ${entry.token.startsWith('VVIP-') ? 'bg-amber-600' : 'bg-[hsl(var(--secondary))]'}`}>
                      {entry.token}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold">{entry.fullName}</span>
                        {entry.priority !== 'normal' && (
                          <Badge className={`px-1.5 py-0 text-[8px] font-bold uppercase ${entry.priority === 'vvip' ? 'bg-amber-600 text-white' : 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]'}`}>
                            {entry.priority}
                          </Badge>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{entry.purpose} · <span className="font-semibold">{entry.department}</span></span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={`block font-mono text-xs font-bold ${entry.token.startsWith('VVIP-') ? 'text-amber-600' : 'text-[hsl(var(--primary))]'}`}>{entry.waitingMinutes}m</span>
                      <span className="mt-0.5 block text-[10px] text-[hsl(var(--muted-foreground))] capitalize">{entry.status.replaceAll('_', ' ')}</span>
                    </span>
                    <ChevronRight size={16} className="text-[hsl(var(--muted-foreground))]" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <CheckCircle2 className="mx-auto text-[hsl(var(--secondary))]" size={28} />
                <p className="mt-3 font-semibold">The queue is clear</p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">New visitor registrations will appear here instantly.</p>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            {dashboard.data?.nowMeeting && (
              <Card className="overflow-hidden border-0 bg-[hsl(var(--secondary))] text-white paper-shadow">
                <div className="border-b border-white/10 px-5 py-4"><p className="mono-label text-[9px] text-white/60 font-bold uppercase">In the room now</p></div>
                <div className="p-5">
                  <p className="font-serif text-2xl font-bold" data-testid="text-now-meeting">{dashboard.data.nowMeeting.fullName}</p>
                  <p className="mt-2 text-xs text-white/80">{dashboard.data.nowMeeting.purpose} ({dashboard.data.nowMeeting.department})</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs text-white/70"><MapPin size={13} /> {dashboard.data.nowMeeting.location || 'Location not recorded'}</span>
                    <span className="font-mono text-xs font-bold bg-white/15 px-2.5 py-1 rounded">{dashboard.data.nowMeeting.token}</span>
                  </div>
                </div>
              </Card>
            )}

            <Card className="border-0 paper-shadow">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mono-label text-[10px] text-[hsl(var(--secondary))] font-bold">Up next</p>
                    <h2 className="mt-1 font-serif text-lg font-bold">Prep next visitors</h2>
                  </div>
                  <Bell size={18} className="text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-5 space-y-3">
                  {(dashboard.data?.nextVisitors ?? []).slice(0, 3).map((visitor, i) => (
                    <div className="flex items-center gap-3" key={visitor.id} data-testid={`card-next-visitor-${visitor.id}`}>
                      <span className="font-mono text-xs font-bold text-[hsl(var(--primary))]">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{visitor.fullName}</p>
                        <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{visitor.purpose} · <span className="font-semibold">{visitor.token}</span></p>
                      </div>
                      <span className="text-xs font-bold font-mono text-[hsl(var(--primary))]">{visitor.waitingMinutes}m</span>
                    </div>
                  ))}
                  {!dashboard.data?.nextVisitors?.length && <p className="text-xs text-[hsl(var(--muted-foreground))]">No waiting list entries queued.</p>}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {selectedId !== null && (
          <Card className="border-0 bg-[hsl(var(--card))] paper-shadow animate-rise">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5">
              <div>
                <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">Visitor briefing file</p>
                <h2 className="mt-1 font-serif text-xl font-bold">{selected.isLoading ? 'Loading briefing...' : selected.data?.fullName ?? 'Visitor brief'}</h2>
              </div>
              <button className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={() => setSelectedId(null)} data-testid="button-close-visitor-briefing"><X size={18} /></button>
            </div>

            {selected.isLoading ? (
              <div className="p-5"><LoadingBlock lines={4} /></div>
            ) : selected.data && (
              <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_.9fr]">
                <div>
                  <div className="bg-[hsl(var(--muted))]/50 rounded-2xl p-4 border border-[hsl(var(--border))]">
                    <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase">Grievance / Issue details</p>
                    <p className="mt-2 text-sm leading-6 font-medium text-[hsl(var(--foreground))] bg-white border border-[hsl(var(--border))] p-3 rounded-lg italic">"{selected.data.description}"</p>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
                    <div><p className="text-xs text-[hsl(var(--muted-foreground))] font-bold">TOKEN</p><p className="mt-1 font-mono font-bold text-sm" data-testid="text-briefing-token">{selected.data.token}</p></div>
                    <div><p className="text-xs text-[hsl(var(--muted-foreground))] font-bold">MOBILE</p><p className="mt-1 font-mono font-bold text-sm" data-testid="text-briefing-mobile">{selected.data.mobile}</p></div>
                    <div><p className="text-xs text-[hsl(var(--muted-foreground))] font-bold">TALUKA / VILLAGE</p><p className="mt-1 font-bold">{selected.data.taluka} · {selected.data.location}</p></div>
                    <div><p className="text-xs text-[hsl(var(--muted-foreground))] font-bold">REPEAT VISITS</p><p className="mt-1 font-bold text-sm text-[hsl(var(--primary))]">{selected.data.previousVisits ?? 0} previous meetings</p></div>
                    <div><p className="text-xs text-[hsl(var(--muted-foreground))] font-bold">PURPOSE CATEGORY</p><p className="mt-1 font-semibold">{selected.data.category}</p></div>
                    {selected.data.organisation && <div><p className="text-xs text-[hsl(var(--muted-foreground))] font-bold">ORGANISATION</p><p className="mt-1 font-semibold">{selected.data.organisation}</p></div>}
                  </div>

                  {selected.data.previouslyApproached && (
                    <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Previous Department Interaction</p>
                      <p className="text-xs font-medium">Officer: <span className="font-bold">{selected.data.previousDepartment}</span></p>
                      <p className="text-xs font-medium">Interaction Date: <span className="font-bold">{dateLabel(selected.data.previousDate)}</span></p>
                      {selected.data.previousReference && <p className="text-xs font-mono text-[10px]">Reference ID: {selected.data.previousReference}</p>}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-2 pt-5 border-t border-[hsl(var(--border))]">
                    <Button variant={selected.data.status === 'called' ? 'outline' : 'default'} size="sm" onClick={() => act(selected.data!.id, 'call')} disabled={queueAction.isPending} data-testid="button-queue-action-call">Call Room</Button>
                    <Button variant="outline" size="sm" onClick={() => act(selected.data!.id, 'hold')} disabled={queueAction.isPending} data-testid="button-queue-action-hold">Place Hold</Button>
                    <Button variant="outline" size="sm" onClick={() => act(selected.data!.id, 'check_in')} disabled={queueAction.isPending} data-testid="button-queue-action-check-in">Re-queue (Waiting)</Button>
                    <Button variant="outline" size="sm" onClick={() => act(selected.data!.id, 'no_show')} disabled={queueAction.isPending} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-600" data-testid="button-queue-action-no-show">Mark No-Show</Button>
                  </div>
                </div>

                <form className="rounded-xl bg-[hsl(var(--muted))]/60 p-5 border border-[hsl(var(--border))]" onSubmit={save} data-testid="form-visit-outcome">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--secondary))]">Record Meeting Decision</h3>
                  <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">Post meeting disposition updates token status and alerts departments.</p>

                  <div className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="outcome" className="text-xs font-bold uppercase">Decision Status</Label>
                      <select id="outcome" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)} data-testid="select-outcome">
                        <option value="resolved">Resolved (Close Case)</option>
                        <option value="referred">Referred to Department</option>
                        <option value="action_required">Action Required</option>
                        <option value="information_provided">Information Provided</option>
                        <option value="rescheduled">Rescheduled</option>
                        <option value="rejected">Rejected / Not Applicable</option>
                        <option value="follow_up">Follow-up Required</option>
                      </select>
                    </div>

                    {outcome === 'referred' && (
                      <div className="space-y-1.5 animate-rise">
                        <Label htmlFor="referred-dept" className="text-xs font-bold uppercase">Target Department</Label>
                        <select id="referred-dept" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={referredTo} onChange={(e) => setReferredTo(e.target.value)} data-testid="select-referred-dept">
                          <option>General Administration</option>
                          <option>Rural Development</option>
                          <option>Revenue</option>
                          <option>Education</option>
                          <option>Health</option>
                          <option>Water & Sanitation</option>
                          <option>Women & Child Development</option>
                          <option>Agriculture</option>
                          <option>Finance</option>
                          <option>Works (Roads & Infra)</option>
                        </select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="outcome-notes" className="text-xs font-bold uppercase">Official Notes / Instructions</Label>
                      <Textarea id="outcome-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter formal instructions for reference or action..." required data-testid="textarea-outcome-notes" />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="follow-up-date" className="text-xs font-bold uppercase">Follow-up Date (optional)</Label>
                      <Input id="follow-up-date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} data-testid="input-follow-up-date" />
                    </div>

                    <Button type="submit" className="w-full bg-[hsl(var(--secondary))] text-white shadow" disabled={saveOutcome.isPending} data-testid="button-save-outcome">
                      {saveOutcome.isPending ? 'Saving outcome…' : 'Record and complete visit'} <Check size={15} />
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        )}
      </div>
    </OfficeShell>
  );
}

function Analytics() {
  const analytics = useGetOfficeAnalytics({ query: { queryKey: getGetOfficeAnalyticsQueryKey(), refetchInterval: 30000 } });
  const data = analytics.data;

  return (
    <OfficeShell title="Desk analytics & Intelligence" eyebrow="Operational insights">
      <div className="space-y-6">
        {analytics.isLoading ? (
          <Card className="border-0 p-6"><LoadingBlock lines={8} /></Card>
        ) : analytics.isError ? (
          <QueryError retry={() => analytics.refetch()} />
        ) : (
          data && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[{ label: 'Today\'s Visits', value: data.today },
                  { label: 'Weekly load', value: data.weekly },
                  { label: 'Monthly load', value: data.monthly },
                  { label: 'No-show rate', value: `${data.noShowRate}%` }].map((item, i) => (
                  <Card className="border-0 p-5 paper-shadow" key={item.label} data-testid={`card-analytics-${i}`}>
                    <p className="mono-label text-[9px] text-[hsl(var(--muted-foreground))] font-bold">{item.label}</p>
                    <p className="mt-4 font-serif text-3xl font-bold" data-testid={`text-analytics-${i}`}>{item.value}</p>
                  </Card>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
                <Card className="border-0 paper-shadow p-5 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">Visitor profile mix</p>
                      <h2 className="mt-1 font-serif text-xl font-bold">Citizen metrics</h2>
                    </div>
                    <UsersRound size={19} className="text-[hsl(var(--secondary))]" />
                  </div>
                  <div className="mt-7 grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[hsl(var(--secondary))] p-4 text-white">
                      <p className="text-xs text-white/70 font-semibold">Unique citizens</p>
                      <p className="mt-3 font-serif text-3xl font-bold" data-testid="text-unique-visitors">{data.unique}</p>
                    </div>
                    <div className="rounded-xl bg-[hsl(var(--primary))]/12 p-4">
                      <p className="text-xs text-[hsl(var(--muted-foreground))] font-semibold">Repeat Grievances</p>
                      <p className="mt-3 font-serif text-3xl font-bold text-[hsl(var(--secondary))]">{data.repeat}</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4 pt-4 border-t border-[hsl(var(--border))]">
                    {[{ label: 'Walk-ins', value: data.walkIns, total: data.walkIns + data.appointments, color: 'bg-[hsl(var(--primary))]' },
                      { label: 'Appointments', value: data.appointments, total: data.walkIns + data.appointments, color: 'bg-[hsl(var(--secondary))]' }].map((item) => (
                      <div key={item.label} data-testid={`metric-visitor-type-${item.label.toLowerCase()}`}>
                        <div className="flex justify-between text-xs font-semibold">
                          <span>{item.label}</span>
                          <span className="font-mono text-xs">{item.value} ({item.total ? Math.round((item.value / item.total) * 100) : 0}%)</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[hsl(var(--muted))]">
                          <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.total ? Math.max(8, (item.value / item.total) * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <BreakdownCard title="Cases by department" eyebrow="Departments" items={data.departments} icon={<Landmark size={19} />} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <BreakdownCard title="Citizens' concerns" eyebrow="Categories" items={data.categories} icon={<SlidersHorizontal size={19} />} />
                <BreakdownCard title="Recorded Outcomes" eyebrow="Outcomes" items={data.outcomes} icon={<CheckCircle2 size={19} />} />
              </div>
            </>
          )
        )}
      </div>
    </OfficeShell>
  );
}

function BreakdownCard({ title, eyebrow, items, icon }: { title: string; eyebrow: string; items: { label: string; value: number; share: number }[]; icon: React.ReactNode }) {
  return (
    <Card className="border-0 paper-shadow p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">{eyebrow}</p>
          <h2 className="mt-1 font-serif text-xl font-bold">{title}</h2>
        </div>
        <span className="text-[hsl(var(--secondary))]">{icon}</span>
      </div>
      {items.length ? (
        <div className="mt-6 space-y-4 max-h-[300px] overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={item.label} data-testid={`row-breakdown-${eyebrow.toLowerCase()}-${i}`}>
              <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 font-mono text-xs text-[hsl(var(--muted-foreground))]">{item.value} · {Math.round(item.share)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div className={`h-full rounded-full ${i % 2 ? 'bg-[hsl(var(--secondary))]' : 'bg-[hsl(var(--primary))]'}`} style={{ width: `${Math.min(100, item.share)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-xs text-[hsl(var(--muted-foreground))]">No statistics recorded yet.</p>
      )}
    </Card>
  );
}

function SearchPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = useSearchOfficeVisits({ query: submitted }, { query: { enabled: submitted.length > 1, queryKey: getSearchOfficeVisitsQueryKey({ query: submitted }) } });

  return (
    <OfficeShell title="Visitor Records Registry" eyebrow="Records lookup">
      <div className="space-y-6">
        <Card className="border-0 paper-shadow p-5 sm:p-6">
          <div className="max-w-2xl">
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))] font-semibold">Search the entire citizen registration database by name, mobile, token number, village/taluka, concerned department, or reference ID.</p>
            <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); }}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={17} />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Enter keywords e.g. Rajesh or Water or CEO-001" data-testid="input-office-search" />
              </div>
              <Button type="submit" disabled={query.trim().length < 2} data-testid="button-submit-office-search">Search Registry</Button>
            </form>
          </div>
        </Card>

        {submitted && (
          <Card className="border-0 paper-shadow animate-rise">
            <div className="border-b border-[hsl(var(--border))] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">Query results</p>
                  <h2 className="mt-1 font-serif text-xl font-bold">Matches for “{submitted}”</h2>
                </div>
                <Badge variant="outline" data-testid="status-search-count" className="font-bold">{results.data?.length ?? 0} matches</Badge>
              </div>
            </div>

            {results.isLoading ? (
              <div className="p-5"><LoadingBlock lines={5} /></div>
            ) : results.isError ? (
              <div className="p-5"><QueryError retry={() => results.refetch()} /></div>
            ) : results.data?.length ? (
              <div className="divide-y divide-[hsl(var(--border))]">
                {results.data.map((visit) => (
                  <Link href={`/status/${visit.token}`} key={visit.id} className="flex flex-col gap-3 p-5 transition hover:bg-[hsl(var(--muted))]/55 sm:flex-row sm:items-center" data-testid={`row-search-result-${visit.id}`}>
                    <span className={`grid h-10 w-16 place-items-center rounded-lg font-mono text-xs font-bold text-white uppercase shrink-0 ${visit.token.startsWith('VVIP-') ? 'bg-amber-600' : 'bg-[hsl(var(--secondary))]'}`}>
                      {visit.token}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{visit.fullName}</span>
                      <span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{visit.purpose} · <span className="font-semibold">{visit.department}</span></span>
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 font-medium">{dateLabel(visit.appointmentDate || visit.registeredAt)}</span>
                    <Badge variant="outline" className="w-fit capitalize text-xs">{visit.status.replaceAll('_', ' ')}</Badge>
                    <ChevronRight size={16} className="text-[hsl(var(--muted-foreground))]" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <FileSearch className="mx-auto text-[hsl(var(--muted-foreground))]" size={28} />
                <p className="mt-3 font-semibold">No records found</p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Verify spelling, or try entering a shorter token number or mobile number.</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </OfficeShell>
  );
}

function Appointments() {
  const date = today();
  const appointments = useGetOfficeAppointments({ date }, { query: { queryKey: getGetOfficeAppointmentsQueryKey({ date }), refetchInterval: 10000 } });

  return (
    <OfficeShell title="Appointment Schedule Manager" eyebrow="Scheduled visits">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">Selected date</p>
            <h2 className="mt-1 font-serif text-2xl font-bold">{dateLabel(date)}</h2>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] font-semibold">Scheduled time-slots booked by citizens for today.</p>
          </div>
          <Button variant="outline" onClick={() => appointments.refetch()} data-testid="button-refresh-appointments" className="shadow-sm"><RefreshCcw size={15} /> Refresh</Button>
        </div>

        {appointments.isLoading ? (
          <Card className="border-0 p-6"><LoadingBlock lines={7} /></Card>
        ) : appointments.isError ? (
          <QueryError retry={() => appointments.refetch()} />
        ) : appointments.data?.length ? (
          <Card className="border-0 paper-shadow">
            <div className="divide-y divide-[hsl(var(--border))]">
              {appointments.data.map((visit) => (
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center justify-between" key={visit.id} data-testid={`row-appointment-${visit.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-20 shrink-0 place-items-center rounded-xl bg-[hsl(var(--secondary))]/10 font-mono text-xs font-bold text-[hsl(var(--secondary))] border border-[hsl(var(--secondary))]/20">
                      {visit.appointmentSlot ? `ID ${visit.appointmentSlot}` : 'Slot'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{visit.fullName} <span className="font-mono text-xs text-[hsl(var(--primary))] ml-2">({visit.token})</span></p>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{visit.purpose} · <span className="font-semibold">{visit.department}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5">{visit.appointmentDuration} Mins</Badge>
                    <Badge variant="outline" className="capitalize">{visit.status.replaceAll('_', ' ')}</Badge>
                    <span className="text-xs font-mono font-bold text-[hsl(var(--muted-foreground))]">{visit.mobile}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="border-0 p-10 text-center paper-shadow">
            <CalendarDays className="mx-auto text-[hsl(var(--secondary))]" size={30} />
            <p className="mt-3 font-semibold">No appointments scheduled for today</p>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Scheduled slots will display here as citizens complete bookings.</p>
          </Card>
        )}
      </div>
    </OfficeShell>
  );
}

function AdminPage() {
  const slots = useGetOfficeSlots({ query: { queryKey: getGetOfficeSlotsQueryKey() } });
  const createSlot = useCreateOfficeSlot();
  const deleteSlot = useDeleteOfficeSlot();

  const users = useGetOfficeUsers({ query: { queryKey: getGetOfficeUsersQueryKey() } });
  const createUser = useCreateOfficeUser();
  const deleteUser = useDeleteOfficeUser();

  const client = useQueryClient();

  // Slot states
  const [slotLabel, setSlotLabel] = useState('');
  const [slotCapacity, setSlotCapacity] = useState('');
  const [slotSortOrder, setSlotSortOrder] = useState('');

  // User states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userRole, setUserRole] = useState('reception');
  const [userDept, setUserDept] = useState('');
  const [userError, setUserError] = useState('');

  const submitSlot = (event: React.FormEvent) => {
    event.preventDefault();
    createSlot.mutate({
      data: {
        label: slotLabel,
        capacity: Number(slotCapacity),
        active: true,
        sortOrder: Number(slotSortOrder)
      }
    }, {
      onSuccess: () => {
        setSlotLabel('');
        setSlotCapacity('');
        setSlotSortOrder('');
        client.invalidateQueries({ queryKey: getGetOfficeSlotsQueryKey() });
        client.invalidateQueries({ queryKey: getGetAvailabilityQueryKey({ date: today() }) });
      }
    });
  };

  const submitUser = (event: React.FormEvent) => {
    event.preventDefault();
    setUserError('');

    createUser.mutate({
      data: {
        username,
        password,
        fullName: userFullName,
        role: userRole,
        department: userRole === 'officer' ? userDept : null,
      }
    }, {
      onSuccess: () => {
        setUsername('');
        setPassword('');
        setUserFullName('');
        setUserDept('');
        client.invalidateQueries({ queryKey: getGetOfficeUsersQueryKey() });
      },
      onError: (err: any) => {
        setUserError(err?.message || 'Failed to create user account. Username may be taken.');
      }
    });
  };

  const handleDeleteSlot = (id: number) => {
    deleteSlot.mutate({ id }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getGetOfficeSlotsQueryKey() });
        client.invalidateQueries({ queryKey: getGetAvailabilityQueryKey({ date: today() }) });
      }
    });
  };

  const handleDeleteUser = (id: number) => {
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getGetOfficeUsersQueryKey() });
      }
    });
  };

  return (
    <OfficeShell title="Admin configuration panel" eyebrow="System Settings">
      <div className="space-y-10">
        {/* User Account Configuration */}
        <div className="space-y-6">
          <Card className="border-0 paper-shadow p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <UsersRound className="mt-1 text-[hsl(var(--primary))]" size={20} />
              <div>
                <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">Staff Directory & RBAC</p>
                <h2 className="mt-1 font-serif text-xl font-bold">Manage portal user accounts</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Create and remove system operator credentials. Roles regulate access to Live Desk, Analytics, and Settings panels.</p>
              </div>
            </div>

            {userError && <p className="mt-4 rounded-lg bg-[hsl(var(--destructive))]/8 p-3 text-xs text-[hsl(var(--destructive))] font-semibold">{userError}</p>}

            <form onSubmit={submitUser} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 items-end" data-testid="form-create-user">
              <div className="lg:col-span-1">
                <Field label="Username" name="user-username" value={username} onChange={(_, v) => setUsername(v)} placeholder="e.g. patil_pa" required />
              </div>
              <div className="lg:col-span-1">
                <Field label="Password" name="user-password" value={password} onChange={(_, v) => setPassword(v)} placeholder="Min 6 chars" type="password" required />
              </div>
              <div className="lg:col-span-1.5">
                <Field label="Full Name" name="user-fullname" value={userFullName} onChange={(_, v) => setUserFullName(v)} placeholder="e.g. Rajesh Patil" required />
              </div>
              <div className="space-y-2 lg:col-span-1">
                <Label htmlFor="user-role" className="text-xs font-semibold">User Role</Label>
                <select id="user-role" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={userRole} onChange={(e) => setUserRole(e.target.value)}>
                  <option value="reception">Reception / PA</option>
                  <option value="ceo">CEO / Officer</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>
              <div className="lg:col-span-1">
                <Field label="Dept (for Officers)" name="user-dept" value={userDept} onChange={(_, v) => setUserDept(v)} placeholder="e.g. Revenue" />
              </div>
              <div className="lg:col-span-0.5">
                <Button type="submit" disabled={createUser.isPending || !username || !password || !userFullName} className="w-full"><Plus size={16} /> Add user</Button>
              </div>
            </form>
          </Card>

          <Card className="border-0 paper-shadow">
            <div className="border-b border-[hsl(var(--border))] p-5">
              <h3 className="font-serif text-lg font-bold">Registered Users</h3>
            </div>
            {users.isLoading ? (
              <div className="p-5"><LoadingBlock lines={4} /></div>
            ) : users.data?.length ? (
              <div className="divide-y divide-[hsl(var(--border))]">
                {users.data.map((user: UserResponse) => (
                  <div className="flex items-center justify-between p-5" key={user.id} data-testid={`row-user-${user.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                        <UsersRound size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{user.fullName} <span className="font-mono text-xs text-[hsl(var(--muted-foreground))] ml-2">(@{user.username})</span></p>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Role: <span className="font-semibold capitalize text-[hsl(var(--secondary))]">{user.role}</span> {user.department ? `· Dept: ${user.department}` : ''}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteUser(user.id)} disabled={deleteUser.isPending} data-testid={`button-delete-user-${user.id}`}><Trash2 size={16} /></Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center"><p className="text-xs text-[hsl(var(--muted-foreground))]">No users registered.</p></div>
            )}
          </Card>
        </div>

        {/* Slot Configuration */}
        <div className="space-y-6">
          <Card className="border-0 paper-shadow p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-1 text-[hsl(var(--primary))]" size={20} />
              <div>
                <p className="mono-label text-[10px] text-[hsl(var(--primary))] font-bold">Appointment Slots availability</p>
                <h2 className="mt-1 font-serif text-xl font-bold">Configure active time slots</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Define 5-minute increment slots that citizens can select. Capacity limits regulate concurrent bookings.</p>
              </div>
            </div>
            <form onSubmit={submitSlot} className="mt-6 grid gap-4 sm:grid-cols-[1.4fr_.7fr_.7fr_auto] sm:items-end" data-testid="form-create-slot">
              <Field label="Slot label" name="slot-label" value={slotLabel} onChange={(_, value) => setSlotLabel(value)} placeholder="e.g. 10:45 AM" required />
              <Field label="Capacity" name="slot-capacity" value={slotCapacity} onChange={(_, value) => setSlotCapacity(value)} placeholder="Max bookings" type="number" required />
              <Field label="Sort Order" name="slot-order" value={slotSortOrder} onChange={(_, value) => setSlotSortOrder(value)} placeholder="e.g. 10" type="number" required />
              <Button type="submit" disabled={createSlot.isPending || !slotLabel || !slotCapacity || !slotSortOrder} data-testid="button-create-slot"><Plus size={16} /> Add slot</Button>
            </form>
          </Card>

          <Card className="border-0 paper-shadow">
            <div className="border-b border-[hsl(var(--border))] p-5">
              <h3 className="font-serif text-lg font-bold">Appointment Slot Slots Configuration</h3>
            </div>
            {slots.isLoading ? (
              <div className="p-5"><LoadingBlock lines={4} /></div>
            ) : slots.data?.length ? (
              <div className="divide-y divide-[hsl(var(--border))]">
                {slots.data.map((slot: AppointmentSlotAdmin) => (
                  <div className="flex items-center gap-4 p-5" key={slot.id} data-testid={`row-slot-${slot.id}`}>
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))]"><CalendarDays size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm">{slot.label}</p>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Capacity: {slot.capacity} · Sort Order: {slot.sortOrder} · {slot.active ? 'Active' : 'Disabled'}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteSlot(slot.id)} disabled={deleteSlot.isPending} data-testid={`button-delete-slot-${slot.id}`}><Trash2 size={16} /></Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <CalendarDays className="mx-auto text-[hsl(var(--muted-foreground))]" size={30} />
                <p className="mt-3 font-semibold">No appointment slots configured</p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Add 5-minute increment slots above to enable bookings.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </OfficeShell>
  );
}

// ---------------------------------------------------------------------------
// Root Router
// ---------------------------------------------------------------------------

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book" component={Book} />
      <Route path="/qr" component={QRPage} />
      <Route path="/status/:token" component={Status} />
      <Route path="/login" component={Login} />

      {/* Protected Routes */}
      <ProtectedRoute path="/office" component={Office} allowedRoles={['admin', 'ceo', 'reception']} />
      <ProtectedRoute path="/appointments" component={Appointments} allowedRoles={['admin', 'ceo', 'reception']} />
      <ProtectedRoute path="/office/analytics" component={Analytics} allowedRoles={['admin', 'ceo']} />
      <ProtectedRoute path="/office/search" component={SearchPage} allowedRoles={['admin', 'ceo', 'reception', 'officer']} />
      <ProtectedRoute path="/admin" component={AdminPage} allowedRoles={['admin']} />

      <Route component={NotFound} />
    </Switch>
  );
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <Router />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;