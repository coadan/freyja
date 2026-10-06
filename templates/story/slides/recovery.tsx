import StateFlow, {type FlowNode, type FlowEdge, type FlowState} from './flow-example';
import './story.css';
import { StatePanel, Metric, StepTabs, type SlideProps } from '@freyja/sdk';
const nodes: FlowNode[] = [
  {id:'worker',label:'Worker',icon:'server',x:40,y:40,value:'Send request'},
  {id:'data',label:'Database',icon:'database',x:680,y:40,value:'No saved result'},
];
const edges: FlowEdge[] = [{id:'request',from:'worker',to:'data',label:'Operation: change-7',tone:'active'}];
const states: FlowState[] = [
  {},
  {nodes:{data:{value:'Saved once',tone:'success'}},edges:{request:{label:'Committed',tone:'success'}}},
  {nodes:{worker:{value:'Reply lost',tone:'warning'},data:{value:'Still saved',tone:'success'}},edges:{request:{label:'Reply did not arrive',tone:'warning'}}},
  {nodes:{worker:{value:'Same ID retried',tone:'active'},data:{value:'Return saved result',tone:'success'}},edges:{request:{label:'Same operation: change-7',tone:'active'}}},
];
export default function Recovery({step}: SlideProps) {return <><StepTabs/><StateFlow nodes={nodes} edges={edges} states={states} step={step}/><StatePanel><Metric label="Applied changes" value={step === 0 ? '0' : '1'} tone={step > 0 ? 'success' : 'neutral'}/><Metric label="Worker result" value={['Waiting','Waiting','Unknown','Recovered'][step]} tone={step === 2 ? 'warning' : step === 3 ? 'success' : 'neutral'}/></StatePanel></>;}
