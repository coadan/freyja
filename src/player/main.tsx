import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Deck, Slide, Fragment } from '@revealjs/react';
import type { RevealApi } from 'reveal.js';
import { ArrowLeft, ArrowRight, Download, Grid2X2, Maximize, Presentation, Search, X } from 'lucide-react';
import { advance, normalizePosition, slideTransition, type Position } from '../shared/manifest.ts';
import { PresentationContext } from '../presentation-sdk/index.tsx';
import 'reveal.js/reveal.css';
import './style.css';
// Deck and profile CSS load after the player's base styles so they can override them.
import { brand, manifest, components, logoUrl } from 'virtual:freyja-deck';

function fromHash(): Position {const [id, step] = location.hash.slice(2).split('/'); return normalizePosition(manifest, {slideId: id ?? manifest.slides[0].id, step: Number(step ?? 0)});}
const config = {width: 1280, height: 720, margin: 0.015, center: false, hash: false, controls: false, progress: false, keyboard: false, touch: false, transition: 'none' as const};
class SlideError extends React.Component<{children: React.ReactNode}, {error?: string}> {
  state: {error?: string} = {};
  static getDerivedStateFromError(error: Error) {return {error: error.message};}
  render() {return this.state.error ? <div role="alert" className="f-error">Slide failed to render: {this.state.error}</div> : this.props.children;}
}
function Player() {
  const deck = useRef<RevealApi | null>(null), [ready, setReady] = useState(false), [position, setPosition] = useState(fromHash), [overlay, setOverlay] = useState<'jump' | 'overview' | null>(null), [query, setQuery] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'pptx' | null>(null), [exportError, setExportError] = useState('');
  // The controls stay out of the audience's view until the pointer approaches the bottom edge.
  const [controlsRevealed, setControlsRevealed] = useState(false);
  useEffect(() => {
    const reveal = (e: PointerEvent) => setControlsRevealed(e.clientY > innerHeight - 120);
    addEventListener('pointermove', reveal); addEventListener('pointerdown', reveal);
    return () => {removeEventListener('pointermove', reveal); removeEventListener('pointerdown', reveal);};
  }, []);
  const capture = new URLSearchParams(location.search).has('capture');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const goTo = useCallback((p: Position) => {setPosition(normalizePosition(manifest, p));}, []);
  const index = manifest.slides.findIndex(s => s.id === position.slideId);
  useEffect(() => {
    document.title = manifest.title;
    for (const [key, value] of Object.entries({...brand.colors, ...brand.tokens})) document.documentElement.style.setProperty(`--${key}`, value);
    document.documentElement.style.setProperty('--font', brand.font);
    document.documentElement.style.setProperty('--heading-font', brand.headingFont ?? brand.font);
    document.documentElement.style.setProperty('--radius', `${brand.radius}px`);
  }, []);
  useEffect(() => {
    if (ready) deck.current?.slide(index, 0, position.step - 1);
    history.replaceState(null, '', `#/${position.slideId}/${position.step}`);
    window.freyja = {position, goTo, manifest};
    if (__FREYJA_LIVE__ && !capture) fetch(`/api/state/${manifest.id}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(position)}).catch(() => {});
  }, [position, ready, index, goTo, capture]);
  useEffect(() => {
    const hash = () => goTo(fromHash());
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,[contenteditable=true]')) return;
      if (e.key === 'Escape') {setOverlay(null); return;}
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key) && !overlay) {e.preventDefault(); setPosition(p => advance(manifest, p, e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1));}
      if (e.key.toLowerCase() === 'g') {e.preventDefault(); setQuery(''); setOverlay('jump');}
      if (e.key.toLowerCase() === 'o') setOverlay(o => o ? null : 'overview');
      if (e.key.toLowerCase() === 'f') void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
    };
    addEventListener('hashchange', hash); addEventListener('keydown', key);
    return () => {removeEventListener('hashchange', hash); removeEventListener('keydown', key);};
  }, [goTo, overlay]);
  useEffect(() => {
    if (!__FREYJA_LIVE__ || capture) return;
    const events = new EventSource(`/api/events/${manifest.id}`);
    events.addEventListener('navigate', e => {setOverlay(null); goTo(JSON.parse((e as MessageEvent).data));});
    return () => events.close();
  }, [goTo, capture]);
  const download = async (format: 'pdf' | 'pptx') => {
    setExporting(format); setExportError('');
    try {
      const response = await fetch(`/api/${format}/${manifest.id}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
      if (!response.ok) {const error = await response.json(); throw new Error(error.error ?? `${format.toUpperCase()} export failed`);}
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url; link.download = `${manifest.id}.${format}`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {setExportError(error instanceof Error ? error.message : String(error));}
    finally {setExporting(null);}
  };
  const choose = (slideId: string) => {goTo({slideId, step: 0}); setOverlay(null); document.activeElement instanceof HTMLElement && document.activeElement.blur();};
  return <>
    <Deck deckRef={deck} config={config} onReady={() => setReady(true)}>{manifest.slides.map((slide, i) => {
      const Component = components[slide.id], step = i === index ? position.step : 0;
      // Captures and exports render one state at a time; reduced-motion viewers get none either.
      const transition = capture || reducedMotion ? undefined : slideTransition(manifest, slide);
      return <Slide key={slide.id} transition={transition && transition.type !== 'none' ? (transition.type === 'push' ? 'slide' : 'fade') : 'none'} transitionSpeed={transition?.speed === 'medium' ? 'default' : transition?.speed}><div className={`f-canvas ${slide.chrome === 'bare' ? 'bare' : ''} ${slide.variant ? `variant-${slide.variant}` : ''}`} data-slide-id={slide.id} data-variant={slide.variant}>
        <header className="f-header"><span>{logoUrl ? <img src={logoUrl} alt={brand.name}/> : brand.name}</span><span>{slide.section}</span></header>
        {slide.chrome !== 'bare' && <h1 className="f-slide-title">{slide.title}</h1>}
        <main className="f-body"><PresentationContext.Provider value={{slide, step, brand, goTo: n => goTo({slideId: slide.id, step: n})}}><SlideError><Component step={step} slide={slide} goTo={n => goTo({slideId: slide.id, step: n})}/></SlideError></PresentationContext.Provider></main>
        <footer className="f-footer"><span>{manifest.title}</span><span>{String(i + 1).padStart(2,'0')}</span></footer>
        {slide.steps.slice(1).map((_, n) => <Fragment key={n} index={n}><span className="f-marker" aria-hidden="true"/></Fragment>)}
      </div></Slide>;
    })}</Deck>
    {!capture && <nav className={`f-controls ${controlsRevealed ? 'is-revealed' : ''}`} aria-label="Presentation controls"><button aria-label="Previous step" onClick={() => setPosition(p => advance(manifest, p, -1))}><ArrowLeft size={18}/></button><span>{index + 1} / {manifest.slides.length}</span><button aria-label="Next step" onClick={() => setPosition(p => advance(manifest, p, 1))}><ArrowRight size={18}/></button><button onClick={() => {setQuery(''); setOverlay('jump');}}><Search size={16}/>Jump to slide</button><button aria-label="Overview" onClick={() => setOverlay('overview')}><Grid2X2 size={17}/></button><button aria-label="Fullscreen" onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}><Maximize size={17}/></button>{__FREYJA_LIVE__ && <><button disabled={!!exporting} onClick={() => void download('pdf')}><Download size={17}/>{exporting === 'pdf' ? 'Exporting PDF…' : 'Export PDF'}</button><button disabled={!!exporting} onClick={() => void download('pptx')}><Presentation size={17}/>{exporting === 'pptx' ? 'Exporting PPTX…' : 'Export PPTX'}</button></>}</nav>}
    {exportError && <div role="alert" className="f-export-error">{exportError}</div>}
    {overlay && <div className="f-overlay" onClick={() => setOverlay(null)}><div className={`f-picker ${overlay}`} role="dialog" aria-modal="true" aria-label={overlay === 'jump' ? 'Jump to slide' : 'Slide overview'} onClick={e => e.stopPropagation()}><div className="f-picker-heading"><h2>{overlay === 'jump' ? 'Jump to slide' : 'Overview'}</h2><button aria-label="Close navigation" onClick={() => setOverlay(null)}><X/></button></div>{overlay === 'jump' && <input autoFocus placeholder="Slide title or number…" aria-label="Search slides" value={query} onChange={e => setQuery(e.target.value)}/>}
      <div className="f-picker-list">{manifest.slides.filter((s, i) => !query || `${i + 1} ${s.title}`.toLowerCase().includes(query.toLowerCase())).map(s => {const i = manifest.slides.indexOf(s); return <button key={s.id} aria-current={s.id === position.slideId ? 'true' : undefined} onClick={() => choose(s.id)}><span>{String(i + 1).padStart(2,'0')}</span><div><strong>{s.title}</strong>{overlay === 'overview' && <small>{s.section ?? ''} · {s.steps.length} steps</small>}</div></button>;})}</div>
    </div></div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<Player/>);
