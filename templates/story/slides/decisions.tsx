import { Columns, Point, Reveal } from '@freyja/sdk';
const choices = [
  {title:'Store the truth',icon:'database' as const,body:'Save the change and its operation result together.'},
  {title:'Coordinate the work',icon:'server' as const,body:'Retry using the same identity when a response is uncertain.'},
  {title:'Rebuild derived views',icon:'search' as const,body:'Update search after the authoritative change is saved.'},
];
export default function Decisions() {return <Columns>{choices.map((choice,i)=><Reveal at={i+1} key={choice.title}><Point title={choice.title} icon={choice.icon}>{choice.body}</Point></Reveal>)}</Columns>;}
