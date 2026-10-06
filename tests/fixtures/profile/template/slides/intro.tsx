import type { SlideProps } from '@freyja/sdk';
import { Badge } from '@profile/kit/Badge';
export default function Intro({slide}: SlideProps) {return <h1><Badge>{slide.title}</Badge></h1>;}
