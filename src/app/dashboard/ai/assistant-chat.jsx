'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Sparkles,Plus,MessageSquare,Send,ArrowUpRight,CalendarDays,Wallet,ClipboardList,FlaskConical,LoaderCircle,Trash2,ShieldCheck} from 'lucide-react';

const suggestions=[['Today at a glance','Aaj ki appointments aur pending follow-ups ka overview do.',CalendarDays],['Payment overview','Current outstanding invoice balance kitna hai?',Wallet],['Treatment progress','Show recent treatments and upcoming care sessions.',ClipboardList],['Lab follow-ups','Which lab cases are overdue and still pending?',FlaskConical]];
function inline(text){return text.split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*)/g).map((part,i)=>{const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);if(link){const safe=/^\/dashboard(?:\/[a-zA-Z0-9_-]+)*(?:\?[a-zA-Z0-9_=&%-]*)?$/.test(link[2]);return safe?<Link key={i} href={link[2]}>{link[1]}</Link>:<span key={i}>{link[1]}</span>}return part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part})}
function Answer({text}){const lines=text.split('\n'),blocks=[];for(let i=0;i<lines.length;i++){const line=lines[i];if(line.trim().startsWith('|')){const rows=[];while(i<lines.length&&lines[i].trim().startsWith('|')){const cells=lines[i].trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());if(!cells.every(x=>/^:?-+:?$/.test(x)))rows.push(cells);i++}i--;blocks.push(<div className="ai-table-wrap" key={i}><table><tbody>{rows.map((row,j)=><tr key={j}>{row.map((cell,k)=>j===0?<th key={k}>{inline(cell)}</th>:<td key={k}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>)}else if(/^#{1,4} /.test(line))blocks.push(<h3 key={i}>{inline(line.replace(/^#{1,4} /,''))}</h3>);else if(/^[-*] /.test(line))blocks.push(<p className="ai-bullet" key={i}>• {inline(line.slice(2))}</p>);else if(line.trim())blocks.push(<p key={i}>{inline(line)}</p>)}return <div className="ai-answer" dir="auto">{blocks}</div>}
export default function AssistantChat(){
  const [chats,setChats]=useState([]),[id,setId]=useState(null),[messages,setMessages]=useState([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[status,setStatus]=useState(''),[configured,setConfigured]=useState(true),[range,setRange]=useState({from:'',to:''}),[preset,setPreset]=useState('all');
  const bottom=useRef(null),input=useRef(null),sending=useRef(false);
  async function loadList(){const r=await fetch('/api/ai');const d=await r.json();if(!r.ok)throw new Error(d.error);setChats(d.chats);setConfigured(d.configured)}
  useEffect(()=>{loadList().catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[messages,status]);
  async function openChat(chatId){if(sending.current)return;setLoading(true);setError('');try{const r=await fetch('/api/ai?id='+chatId),d=await r.json();if(!r.ok)throw new Error(d.error);setId(chatId);setMessages(d.chat.messages);setQuestion('')}catch(e){setError(e.message)}finally{setLoading(false)}}
  function newChat(){setId(null);setMessages([]);setQuestion('');setError('');input.current?.focus()}
  async function removeChat(){if(!id||!window.confirm('Delete this saved AI conversation?'))return;setLoading(true);try{const r=await fetch('/api/ai?id='+id,{method:'DELETE'}),d=await r.json();if(!r.ok)throw new Error(d.error);newChat();await loadList()}catch(e){setError(e.message)}finally{setLoading(false)}}
  function dates(value){setPreset(value);const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(value==='today')setRange({from:today,to:today});else if(value==='month')setRange({from:today.slice(0,7)+'-01',to:today});else if(value==='all')setRange({from:'',to:''})}
  async function send(event,text){event?.preventDefault();const content=(text||question).trim();if(!content||sending.current||!configured)return;if(range.from&&range.to&&range.from>range.to){setError('Choose an end date on or after the start date.');return}sending.current=true;setBusy(true);setError('');setStatus('Connecting to your clinic assistant…');const before=messages;setMessages([...before,{role:'user',content,range}]);setQuestion('');let completed=false;
    try{const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,question:content,range})});if(!response.ok){const d=await response.json();throw new Error(d.error||'Unable to connect')}
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!line.trim())continue;const d=JSON.parse(line);if(d.id)setId(d.id);if(d.type==='status')setStatus(d.message);if(d.type==='error')throw new Error(d.message);if(d.type==='done'){completed=true;setMessages([...before,...d.messages])}}}
      if(!completed)throw new Error('Connection interrupted. Reopen this chat to check whether the answer was saved.');
      await loadList();
    }catch(e){setError(e.message);if(!completed){setMessages(before);setQuestion(content)}loadList().catch(()=>{})}finally{sending.current=false;setBusy(false);setStatus('');input.current?.focus()}
  }
  return <section className="ai-page">
    <div className="ai-workspace">
      <div className="ai-conversation">
        <header className="ai-chat-header">
          <div className="ai-header-left">
            <div className="ai-assistant-avatar"><Sparkles size={18}/></div>
            <div className="ai-header-title">
              <strong>DentalCare AI</strong>
              <small><span className="ai-online"/>{configured?'Online':'Setup required'}</small>
            </div>
            <button type="button" className="btn secondary ai-new-btn" onClick={newChat} disabled={busy||loading}>
              <Plus size={14}/><span>New chat</span>
            </button>
          </div>
          <div className="ai-history-strip" role="tablist" aria-label="Recent conversations">
            {chats.map(chat=>(
              <button
                key={chat._id}
                type="button"
                className={`ai-history-tab ${id===chat._id?'selected':''}`}
                onClick={()=>openChat(chat._id)}
                disabled={busy||loading}
                title={chat.title}
              >
                <MessageSquare size={13}/>
                <span>{chat.title}</span>
              </button>
            ))}
            {!chats.length&&!loading&&<span className="ai-history-empty">No previous chats</span>}
          </div>
          {id&&<button type="button" className="icon-button ai-delete-btn" aria-label="Delete conversation" title="Delete conversation" disabled={busy||loading} onClick={removeChat}><Trash2 size={16}/></button>}
        </header>
        <div className="ai-messages" aria-busy={busy||loading}>
          {loading?<div className="ai-welcome"><LoaderCircle className="ai-spin"/><p>Loading conversations…</p></div>:!messages.length?<div className="ai-welcome"><div className="ai-welcome-icon"><Sparkles size={28}/></div><span className="eyebrow">A CLEARER PICTURE OF YOUR CLINIC</span><h2>What would you like to know?</h2><p>Ask in English, Urdu or Roman Urdu.<br/>Your answers are grounded in your clinic’s records.</p><div className="ai-suggestions">{suggestions.map(([label,prompt,Icon])=><button key={label} type="button" className="ai-suggestion-card" disabled={busy||!configured} onClick={()=>send(null,prompt)}><div className="ai-card-top"><Icon size={18} className="ai-card-icon"/><ArrowUpRight size={14} className="ai-card-arrow"/></div><strong>{label}</strong><span>{prompt}</span></button>)}</div></div>:messages.map((m,i)=><article key={i} className={`ai-message ${m.role}`}><span className="ai-message-label">{m.role==='user'?'You':'DentalCare Assistant'}</span>{m.role==='assistant'?<Answer text={m.content}/>:<p dir="auto">{m.content}</p>}{m.role==='user'&&(m.range?.from||m.range?.to)&&<small>Preferred dates: {m.range.from||'Any'} → {m.range.to||'Any'}</small>}{!!m.sources?.length&&<details className="ai-sources"><summary>Records checked · {m.sources.length} {m.sources.length===1?'query':'queries'}</summary>{m.sources.map((s,j)=><div key={j}><Link href={s.url}>{s.dataset} <ArrowUpRight size={12}/></Link><span>{s.totals.count} matching records{s.hasMore?` · ${s.shown} shown to AI`:''}</span><small>{Object.entries(s.filters).filter(([k])=>k!=='dataset').map(([k,v])=>`${k}: ${v}`).join(' · ')||'All records'} · Dates use {s.dateField}</small>{Object.entries(s.totals).filter(([k])=>k!=='count').map(([k,v])=><small key={k}>{k}: PKR {Number(v).toLocaleString('en-PK')}</small>)}<small>Checked {new Date(s.checkedAt).toLocaleString()}</small></div>)}</details>}</article>)}
          {busy&&<div className="ai-thinking" role="status"><LoaderCircle size={17} className="ai-spin"/>{status}</div>}<div ref={bottom}/>
        </div>
        <div className="ai-composer-area">{error&&<p className="error" role="alert">{error}</p>}{!configured&&<p className="error">Add GROQ_API_KEY to the server configuration to enable answers.</p>}<div className="ai-date-filter"><CalendarDays size={15}/><label htmlFor="ai-range">Date preference</label><select id="ai-range" value={preset} disabled={busy} onChange={e=>dates(e.target.value)}><option value="all">All time / ask in chat</option><option value="today">Today</option><option value="month">This month</option><option value="custom">Custom range</option></select>{preset==='custom'&&<><input aria-label="From date" type="date" value={range.from} disabled={busy} onChange={e=>setRange({...range,from:e.target.value})}/><input aria-label="To date" type="date" value={range.to} disabled={busy} onChange={e=>setRange({...range,to:e.target.value})}/></>}</div><form className="ai-composer" onSubmit={send}><textarea ref={input} rows={2} maxLength={2000} aria-label="Ask your clinic assistant" placeholder="Ask about your clinic… e.g. Aaj kitni appointments hain?" value={question} disabled={busy||loading||!configured} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e)}}}/><button className="button" type="submit" disabled={busy||loading||!configured||!question.trim()} aria-label="Send question">{busy?<LoaderCircle size={19} className="ai-spin"/>:<Send size={19}/>}</button></form><p className="ai-disclosure">Questions and relevant records are processed by Groq. Verify answers against source records. No clinical diagnosis or automatic changes.</p></div>
      </div>
    </div>
  </section>
}
