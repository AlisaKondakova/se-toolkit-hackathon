import { useState, useEffect } from 'react'

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState('')
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    fetch('http://localhost:8000/').then(r=>r.json()).then(d=>setSuggestions(d.suggestions||[]))
  }, [])

  const handleFile = async (e) => {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)
    setLoading(true)
    try {
      const fd = new FormData(); fd.append('image', file)
      const res = await fetch('http://localhost:8000/recognize', {method:'POST', body:fd})
      setResult(await res.json())
    } catch { setResult({success:false, message:'❌ Server error'}) }
    setLoading(false)
  }

  const handleSearch = async (text) => {
    const q = text || input
    if(!q.trim()) return
    setLoading(true)
    setInput(q)
    try {
      const res = await fetch('http://localhost:8000/search', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:q})
      })
      setResult(await res.json())
    } catch { setResult({success:false, message:'❌ Error'}) }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        .sws-sidebar { transition: transform 0.3s ease-in-out; }
        .sws-sidebar.closed { transform: translateX(-100%); }
        @media (max-width: 900px) {
          .sws-sidebar { position: fixed; left: 0; top: 0; height: 100vh; z-index: 1000; box-shadow: 2px 0 20px rgba(0,0,0,0.15); }
          .sws-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 999; }
          .sws-overlay.show { display: block; }
        }
      `}</style>
      
      <div style={{display:'flex', minHeight:'100vh', background:'#f8faf8', fontFamily:'system-ui, -apple-system, sans-serif', color:'#1a1a2e'}}>
        <div className={`sws-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}/>

        <button onClick={() => setSidebarOpen(true)} style={{
          position:'fixed', top:20, left:20, zIndex:1001,
          background:'#16a34a', border:'none', borderRadius:10,
          padding:'10px 14px', cursor:'pointer', fontSize:20,
          color:'white', boxShadow:'0 2px 10px rgba(0,0,0,0.15)',
          transition:'all 0.2s'
        }} title="Sorting Rules">
          ☰
        </button>

        <aside className={`sws-sidebar ${sidebarOpen ? '' : 'closed'}`} style={{
          width:320, background:'white', borderRight:'1px solid #e2e8f0', 
          padding:24, overflowY:'auto', flexShrink:0, position:'relative'
        }}>
          <button onClick={() => setSidebarOpen(false)} style={{
            position:'absolute', top:12, right:12, background:'none', border:'none',
            fontSize:20, cursor:'pointer', color:'#64748b', padding:'4px 8px', borderRadius:6
          }}>✕</button>

          <h2 style={{fontSize:18, fontWeight:700, margin:'0 0 20px', color:'#16a34a', display:'flex', alignItems:'center', gap:8}}>
            📋 Sorting Rules
          </h2>
          
          <div style={{fontSize:14, lineHeight:1.6, color:'#475569'}}>
            <div style={{marginBottom:16, padding:14, background:'#f0fdf4', borderRadius:12, border:'1px solid #bbf7d0'}}>
              <strong style={{color:'#166534', display:'block', marginBottom:6}}>🔵 Dry Recyclables</strong>
              <ul style={{margin:0, paddingLeft:18}}>
                <li>Paper, cardboard, mail</li>
                <li>Plastic (codes 01, 02, 05)</li>
                <li>Glass (clear & colored)</li>
                <li>Metal (cans, foil, lids)</li>
              </ul>
              <p style={{margin:'10px 0 0', fontSize:13, color:'#15803d', fontWeight:500}}>💡 Tip: Rinse, dry & crush</p>
            </div>

            <div style={{marginBottom:16, padding:14, background:'#fefce8', borderRadius:12, border:'1px solid #fde68a'}}>
              <strong style={{color:'#854d0e', display:'block', marginBottom:6}}>🟡 Organic Waste</strong>
              <ul style={{margin:0, paddingLeft:18}}>
                <li>Fruit & vegetable peels</li>
                <li>Food scraps, bread, grains</li>
                <li>Coffee grounds, tea bags</li>
                <li>Eggshells</li>
              </ul>
              <p style={{margin:'10px 0 0', fontSize:13, color:'#a16207', fontWeight:500}}>💡 Compost or general waste bin</p>
            </div>

            <div style={{marginBottom:16, padding:14, background:'#fef2f2', borderRadius:12, border:'1px solid #fecaca'}}>
              <strong style={{color:'#b91c1c', display:'block', marginBottom:6}}>🔴 Hazardous Waste</strong>
              <ul style={{margin:0, paddingLeft:18}}>
                <li>Batteries & accumulators</li>
                <li>Light bulbs (LED, fluorescent)</li>
                <li>Electronics & cables</li>
                <li>Medicines & thermometers</li>
              </ul>
              <p style={{margin:'10px 0 0', fontSize:13, color:'#dc2626', fontWeight:500}}>⚠️ Use special collection points only!</p>
            </div>

            <div style={{padding:14, background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0'}}>
              <strong style={{color:'#475569', display:'block', marginBottom:6}}>⚪ Non-Recyclables</strong>
              <ul style={{margin:0, paddingLeft:18}}>
                <li>Dirty packaging, receipts, tissues</li>
                <li>Styrofoam, multi-layer cartons</li>
                <li>Diapers & hygiene products</li>
                <li>Plastic codes 03, 04, 06, 07</li>
              </ul>
            </div>
          </div>
        </aside>

        <main className="sws-main" style={{flex:1, padding:'30px 20px', maxWidth:700, width:'100%', margin:'0 auto'}}>
          <div style={{textAlign:'center', marginBottom:30}}>
            <h1 style={{margin:0, fontSize:28, fontWeight:800, color:'#16a34a', letterSpacing:'-0.5px'}}>♻️ Smart Waste Sorter</h1>
            <p style={{margin:'6px 0 0', color:'#64748b', fontSize:15}}>Smart waste sorting with CO₂ tracking</p>
          </div>

          <div style={{background:'white', borderRadius:16, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:20}}>
            <input type="file" accept="image/*" onChange={handleFile} style={{display:'none'}} id="cam"/>
            <label htmlFor="cam" style={{
              display:'block', padding:'16px', background:loading?'#cbd5e1':'#16a34a', 
              color:'white', borderRadius:12, cursor:'pointer', fontSize:16, fontWeight:600,
              textAlign:'center', transition:'all 0.2s'
            }}>
              {loading ? '⏳ Analyzing...' : '📸 Upload Photo'}
            </label>
            {preview && (
              <div style={{marginTop:16, textAlign:'center'}}>
                <img src={preview} alt="" style={{maxWidth:150, maxHeight:150, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.1)', objectFit:'contain'}}/>
              </div>
            )}
          </div>

          <div style={{background:'white', borderRadius:16, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:20}}>
            <p style={{margin:'0 0 12px', color:'#64748b', fontSize:14, fontWeight:500}}>Or find instantly:</p>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginBottom:16}}>
              {suggestions.map(s => (
                <button key={s} onClick={()=>handleSearch(s)} style={{
                  padding:'8px 16px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:20, 
                  cursor:'pointer', fontSize:13, fontWeight:500, color:'#475569', transition:'all 0.15s'
                }}
                onMouseOver={e=>{e.target.style.background='#16a34a';e.target.style.color='white';e.target.style.borderColor='#16a34a'}}
                onMouseOut={e=>{e.target.style.background='#f1f5f9';e.target.style.color='#475569';e.target.style.borderColor='#e2e8f0'}}
                >{s}</button>
              ))}
            </div>
            <div style={{display:'flex', gap:8}}>
              <input value={input} onChange={e=>setInput(e.target.value)} placeholder="pepsi, iphone, battery..." 
                style={{flex:1, padding:'12px 16px', border:'2px solid #e2e8f0', borderRadius:10, fontSize:15, outline:'none'}}
                onFocus={e=>e.target.style.borderColor='#16a34a'}
                onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                onKeyPress={e=>e.key==='Enter'&&handleSearch()}/>
              <button onClick={()=>handleSearch()} disabled={!input.trim()||loading} style={{
                padding:'12px 20px', background:input.trim()&&!loading?'#16a34a':'#e2e8f0', 
                color:input.trim()&&!loading?'white':'#94a3b8', border:'none', borderRadius:10, 
                cursor:input.trim()&&!loading?'pointer':'default', fontSize:15, fontWeight:600
              }}>🔍</button>
            </div>
          </div>

          {result && (
            <div style={{
              background: result.success ? '#f0fdf4' : '#fffbeb', 
              borderRadius:16, padding:28, boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
              border: result.success ? '2px solid #86efac' : '2px solid #fde68a'
            }}>
              <div style={{fontSize:56, marginBottom:12, textAlign:'center'}}>{result.bin || '❓'}</div>
              {result.success ? (
                <>
                  <p style={{margin:'0 0 8px', color:'#4ade80', fontSize:13, fontWeight:600, textAlign:'center', textTransform:'uppercase', letterSpacing:1}}>
                    ✅ {result.text}
                  </p>
                  <p style={{color:'#166534', margin:'8px 0 12px', fontSize:18, fontWeight:700, textAlign:'center'}}>
                    {result.instruction}
                  </p>
                  <div style={{background:'#dcfce7', borderRadius:10, padding:'10px 16px', display:'inline-block'}}>
                    <span style={{fontSize:16, fontWeight:600, color:'#15803d'}}>🌍 CO₂: {result.co2}</span>
                  </div>
                </>
              ) : (
                <p style={{color:'#b45309', fontSize:16, textAlign:'center', margin:0}}>{result.message}</p>
              )}
            </div>
          )}

          <div style={{textAlign:'center', padding:'30px 0 10px', color:'#94a3b8', fontSize:12}}>
            ♻️ Smart Waste Sorter • Hackathon 2026
          </div>
        </main>
      </div>
    </>
  )
}
export default App
