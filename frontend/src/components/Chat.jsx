import React, { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";

export default function Chat({ pollId, who }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([]);
  const endRef = useRef();

  useEffect(() => {
    const onMsg = (m)=> setMsgs(list=> [...list, m]);
    socket.on("chat:message", onMsg);
    return ()=> socket.off("chat:message", onMsg);
  }, []);

  useEffect(()=> endRef.current?.scrollIntoView({behavior:"smooth"}), [msgs]);

  const send = () => {
    if (!text.trim()) return;
    socket.emit("chat:send", { pollId, from: who, text });
    setText("");
  };

  return (
    <div>
      <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
        <h4>Chat</h4>
        <button className="btn" onClick={()=>setOpen(!open)}>{open? "Hide":"Show"}</button>
      </div>
      {open && (
        <>
          <div style={{height:200, overflowY:"auto", border:"1px solid #ddd", padding:8, borderRadius:8, background:"#fff"}}>
            {msgs.map((m,i)=>(
              <div key={i}><b>{m.from}:</b> {m.text}</div>
            ))}
            <div ref={endRef}/>
          </div>
          <div className="row" style={{marginTop:8}}>
            <input className="input" placeholder="Type…" value={text} onChange={e=>setText(e.target.value)}/>
            <button className="btn primary" onClick={send}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}
