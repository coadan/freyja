import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
export function Badge({children}: {children: ReactNode}) {return <strong className="fixture-badge"><Check size={20} aria-hidden="true"/>{children}</strong>;}
