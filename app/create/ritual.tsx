'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
const topics:Record<string,string[]>={
 'WORK':["What's next in my career?","What wants to come alive in my work?","What should I know about this opportunity?","What is emerging with this launch?"],
 'RELATIONSHIPS':['What does this connection need?','How can I communicate more openly?','What am I learning about love?','What boundaries would support me?'],
 'LIFE CHANGES':['What is ready to change?','What can I release as I move forward?','What support do I need in this transition?','What possibilities am I overlooking?'],
 'CREATIVITY':['What wants to be created?','How can I reconnect with inspiration?','What is blocking my creative energy?','What could I explore next?'],
 'INNER MAGIC':['What is my intuition telling me?','What strength can I lean on?','What part of myself needs attention?','How can I trust myself more?'],
 'IDK':['What do I need to hear today?','What deserves my attention?','What might surprise me?','What small step can I take?']
};
export default function CreateRitual(){
 const [topic,setTopic]=useState<string|null>(null),[question,setQuestion]=useState(''),[error,setError]=useState(''),[opening,setOpening]=useState(false);
 function begin(value:string){if(opening)return;try{sessionStorage.setItem('vintarot:new-reading',JSON.stringify({question:value.trim().slice(0,500),created:Date.now()}));setOpening(true);window.location.assign('/room?ritual=1')}catch{setError('Your browser could not save this question. Please allow site storage and try again.')}}
 return <section className="question-flow" aria-labelledby="question-title"><div className="question-glow"/><button className="question-back" aria-label={topic?'Back to topics':'Back to home'} onClick={()=>topic?setTopic(null):window.location.assign('/')}><ArrowLeft size={32} strokeWidth={1}/></button><div key={topic||'ask'} className="question-step"><h1 id="question-title">{topic?'Anything in mind?':'Ask a question'}</h1>{!topic?<><form onSubmit={e=>{e.preventDefault();if(question.trim())begin(question)}} className="question-input"><input aria-label="Your question" autoComplete="off" maxLength={500} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Type your question or scenario..."/>{question.trim()&&<button type="submit" disabled={opening} aria-label="Continue with question"><ArrowRight size={23}/></button>}</form><h2>Or choose a topic.</h2><div className="question-topics">{Object.keys(topics).map(t=><button key={t} onClick={()=>setTopic(t)}>{t}</button>)}</div><button className="question-skip" disabled={opening} onClick={()=>begin('')}>Skip theme</button></>:<><div className="question-suggestions">{topics[topic].map(q=><button disabled={opening} key={q} onClick={()=>begin(q)}>{q}<ArrowRight size={16}/></button>)}</div><button className="question-skip" disabled={opening} onClick={()=>begin('')}>Skip question</button></>}{error&&<p role="alert">{error}</p>}{opening&&<p role="status">Opening your room…</p>}</div></section>
}
