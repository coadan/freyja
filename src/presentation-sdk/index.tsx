import React, { createContext, useContext, useId, type ReactNode } from 'react';
import { ArrowRight, Bell, Check, CircleHelp, Database, Globe, Home, Mail, MessageCircle, Search, Server, Shield, Sparkles, User, Zap } from 'lucide-react';
import type { Brand, SlideManifest } from '../shared/manifest.ts';

export type SlideProps = {step: number; slide: SlideManifest; goTo: (step: number) => void};
type Context = SlideProps & {brand: Brand};
export const PresentationContext = createContext<Context | null>(null);
export function usePresentation() {const value = useContext(PresentationContext); if (!value) throw new Error('Presentation SDK requires the Freyja player'); return value;}
export function Reveal({at, children, reserve = true}: {at: number; children: ReactNode; reserve?: boolean}) {
  const {step} = usePresentation();
  if (step < at && !reserve) return null;
  return <div className={`f-reveal ${step >= at ? 'is-visible' : ''}`} aria-hidden={step < at}>{children}</div>;
}
export function Title({children, subtitle}: {children: ReactNode; subtitle?: ReactNode}) {return <div className="f-title"><h1>{children}</h1>{subtitle && <p>{subtitle}</p>}</div>;}
export function Columns({children, ratio}: {children: ReactNode; ratio?: string}) {return <div className="f-columns" style={{gridTemplateColumns: ratio}}>{children}</div>;}
export function Card({children, tone = 'neutral'}: {children: ReactNode; tone?: Tone}) {return <article className={`f-card tone-${tone}`}>{children}</article>;}
export function Point({title, children, icon}: {title: string; children?: ReactNode; icon?: IconName}) {return <article className="f-point">{icon && <Icon name={icon}/>}<h3>{title}</h3>{children && <p>{children}</p>}</article>;}
export function StepTabs() {
  const {slide, step, goTo} = usePresentation();
  return <nav className="f-tabs" aria-label="Slide steps">{slide.steps.map((name, i) => <button key={i} aria-current={step === i ? 'step' : undefined} onClick={() => goTo(i)}>{name}</button>)}</nav>;
}
const icons = {arrow: ArrowRight, bell: Bell, check: Check, question: CircleHelp, database: Database, globe: Globe, home: Home, mail: Mail, chat: MessageCircle, search: Search, server: Server, shield: Shield, sparkles: Sparkles, user: User, zap: Zap};
export type IconName = keyof typeof icons;
export type Tone = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'muted';
export function Icon({name, src, size = 36}: {name?: IconName; src?: string; size?: number}) {
  if (src) return <img className="f-icon" src={src} width={size} height={size} alt=""/>;
  const Component = icons[name ?? 'sparkles']; return <Component size={size} strokeWidth={1.7} aria-hidden="true"/>;
}
export function Metric({label, value, tone = 'neutral'}: {label: string; value: ReactNode; tone?: Tone}) {return <div className={`f-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong></div>;}
export function StatePanel({children, label = 'Current state'}: {children: ReactNode; label?: string}) {return <div className="f-state-panel"><span className="f-label">{label}</span><div className="f-columns">{children}</div></div>;}
