'use client';
export default function Logout(){return <button className="secondary" style={{marginTop:15,width:'100%'}} onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});location.href='/login'}}>Log out</button>}
