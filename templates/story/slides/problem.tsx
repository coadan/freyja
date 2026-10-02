import { Card, Columns, Reveal } from '@freyja/sdk';
export default function Problem() {
  return <Columns><div><Card><span className="f-label">A real question</span><h3>“The request timed out. Is it safe to try again?”</h3></Card><Reveal at={1}><p style={{color:'var(--muted)'}}>The user has to connect details scattered across documentation, logs and examples.</p></Reveal></div><Reveal at={2}><Card tone="active"><span className="f-label">Hypothesis</span><h3>A conversation can connect the question to the right evidence.</h3></Card></Reveal></Columns>;
}
