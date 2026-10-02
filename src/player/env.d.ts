declare const __FREYJA_LIVE__: boolean;
declare module 'virtual:freyja-deck' {
  export const manifest: import('../shared/manifest.ts').DeckManifest;
  export const brand: import('../shared/manifest.ts').Brand;
  export const components: Record<string, import('react').ComponentType<import('../presentation-sdk/index.tsx').SlideProps>>;
  export const logoUrl: string | undefined;
}
interface Window {freyja?: {position: import('../shared/manifest.ts').Position; goTo: (p: import('../shared/manifest.ts').Position) => void; manifest: import('../shared/manifest.ts').DeckManifest};}
