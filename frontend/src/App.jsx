import { useState, useEffect } from 'react'

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState('')
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('http://10.93.24.189:8000/').then(r=>r.json()).then(d=>setSuggestions(d.suggestions||[]))
  }, [])

  const handleFile = async (e) => {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)
    setLoading(true)
    try {
      const fd = new FormData(); fd.append('image', file)
      const res = await fetch('http://10.93.24.189:8000/recognize', {method:'POST', body:fd})
      const data = await res.json()
      setResult(data)
    } catch { 
      setResult({success:false, message:'Connection Error'}) 
    } finally {
      setLoading(false) // Всегда выключаем загрузку
    }
  }

  const handleSearch = async (text) => {
    const q = text || input
    if(!q.trim()) return
    setLoading(true)
    setInput(q)
    try {
      const res = await fetch('http://10.93.24.189:8000/search', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:q})
      })
      setResult(await res.json())
    } catch { 
      setResult({success:false, message:'Connection Error'}) 
    } finally {
      setLoading(false) // Всегда выключаем загрузку
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f8faf8; color: #1a1a2e; }
        
        /* Sidebar */
        .sws-sidebar {
          position: fixed; top: 0; left: 0; height: 100vh; width: 300px;
          background: white; border-right: 1px solid #e2e8f0; padding: 24px;
          overflow-y: auto; z-index: 1000; transform: translateX(-100%); transition: transform 0.3s ease;
        }
        .sws-sidebar.open { transform: translateX(0); }
        .sws-overlay {
          display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 999;
        }
        .sws-overlay.show { display: block; }
        
        /* UI Elements */
        .sws-toggle {
          position: fixed; top: 16px; left: 16px; z-index: 1001;
          background: #16a34a; border: none; border-radius: 10px; padding: 10px 14px;
          cursor: pointer; font-size: 20px; color: white; box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        }
        .sws-close {
          position: absolute; top: 12px; right: 12px; background: none; border: none;
          font-size: 24px; cursor: pointer; color: #64748b;
        }
        
        .sws-main { padding: 70px 16px 30px; max-width: 600px; margin: 0 auto; }
        .sws-card {
          background: white; border-radius: 16px; padding: 20px;
          margin-bottom: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        
        .sws-btn {
          width: 100%; padding: 14px 20px; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s;
        }
        .sws-btn-primary { background: #16a34a; color: white; }
        .sws-btn-primary:disabled { background: #cbd5e1; cursor: wait; }
        
        .sws-input {
          width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0;
          border-radius: 12px; font-size: 16px; outline: none;
        }
        .sws-input:focus { border-color: #16a34a; }
        
        .sws-preview {
          max-width: 120px; max-height: 120px; border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1); object-fit: contain;
          display: block; margin: 12px auto;
        }
        
        .sws-btn-secondary {
          background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;
          padding: 8px 14px; font-size: 14px; border-radius: 20px; cursor: pointer;
        }
        .sws-btn-secondary:hover { background: #16a34a; color: white; border-color: #16a34a; }
        
        /* Rules */
        .rule-card { padding: 12px; border-radius: 12px; margin-bottom: 12px; border: 1px solid; font-size: 13px; }
        .rule-card.blue { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .rule-card.yellow { background: #fefce8; border-color: #fde68a; color: #854d0e; }
        .rule-card.red { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
        .rule-card.gray { background: #f8fafc; border-color: #e2e8f0; color: #475569; }
        .rule-card ul { padding-left: 18px; margin: 6px 0; }
        .rule-card strong { display: block; margin-bottom: 4px; }
      `}</style>
      
      <div>
        <div className={`sws-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}/>
        <button className="sws-toggle" onClick={() => setSidebarOpen(true)}>☰</button>

        <aside className={`sws-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <button className="sws-close" onClick={() => setSidebarOpen(false)}>✕</button>
          <h2 style={{fontSize:18, fontWeight:700, marginBottom:20, color:'#16a34a'}}>📋 Sorting Rules</h2>
          
          <div style={{fontSize:13, color:'#475569'}}>
            <div className="rule-card blue">
              <strong>🔵 Dry Recyclables</strong>
              <ul><li>Paper, cardboard, mail</li><li>Plastic (codes 01, 02, 05)</li><li>Glass</li><li>Metal (cans, foil)</li></ul>
            </div>
            <div className="rule-card yellow">
              <strong>🟡 Organic Waste</strong>
              <ul><li>Fruit & vegetable peels</li><li>Food scraps, bread</li><li>Coffee grounds, tea bags</li><li>Eggshells</li></ul>
            </div>
            <div className="rule-card red">
              <strong>🔴 Hazardous Waste</strong>
              <ul><li>Batteries & accumulators</li><li>Light bulbs (LED, fluorescent)</li><li>Electronics</li><li>Medicines</li></ul>
            </div>
            <div className="rule-card gray">
              <strong>⚪ Non-Recyclables</strong>
              <ul><li>Dirty packaging, tissues</li><li>Styrofoam, multi-layer cartons</li><li>Diapers</li></ul>
            </div>
          </div>
        </aside>

        <main className="sws-main">
          <div style={{textAlign:'center', marginBottom:24}}>
            <h1 style={{margin:0, fontSize:24, fontWeight:800, color:'#16a34a'}}>♻️ Smart Waste Sorter</h1>
            <p style={{margin:'4px 0 0', color:'#64748b', fontSize:14}}>Smart sorting with CO₂ tracking</p>
          </div>

          <div className="sws-card">
            <input type="file" accept="image/*" onChange={handleFile} style={{display:'none'}} id="cam"/>
            <label htmlFor="cam" className="sws-btn sws-btn-primary" style={{display:'block', textAlign:'center'}}>
              {loading ? '⏳ Analyzing...' : '📸 Upload Photo'}
            </label>
            {preview && <img src={preview} alt="" className="sws-preview"/>}
          </div>

          <div className="sws-card">
            <p style={{margin:'0 0 10px', color:'#64748b', fontSize:13, fontWeight:500}}>Or find instantly:</p>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginBottom:14}}>
              {suggestions.map(s => (
                <button key={s} onClick={()=>handleSearch(s)} className="sws-btn-secondary">{s}</button>
              ))}
            </div>
            <div style={{display:'flex', gap:8}}>
              <input value={input} onChange={e=>setInput(e.target.value)} placeholder="pepsi, bottle..." 
                className="sws-input" onKeyPress={e=>e.key==='Enter'&&handleSearch()}/>
              <button onClick={()=>handleSearch()} disabled={!input.trim()||loading} 
                className="sws-btn sws-btn-primary" style={{padding:'14px 18px', width:'auto'}}>🔍</button>
            </div>
          </div>

          {/* RESULT BLOCK */}
          {result && (
            <div style={{
              textAlign: 'center', padding: 24, borderRadius: 16, 
              border: result.success ? '2px solid #86efac' : '2px solid #fca5a5',
              background: result.success ? '#f0fdf4' : '#fff1f2',
              marginTop: 20
            }}>
              {result.success ? (
                <>
                  <div style={{fontSize: 48, marginBottom: 8}}>{result.bin}</div>
                  <p style={{color:'#166534', fontWeight:700, fontSize:18, margin: '0 0 8px'}}>{result.instruction}</p>
                  <div style={{background:'#dcfce7', borderRadius:10, padding:'8px 14px', display:'inline-block', fontWeight:600, color:'#15803d'}}>
                    🌍 CO₂: {result.co2}
                  </div>
                </>
              ) : (
                <>
                  <div style={{fontSize: 48, marginBottom: 8}}>❓</div>
                  <p style={{color:'#991b1b', fontWeight:700, fontSize:18, margin: '0 0 8px'}}>
                    Item not recognized.
                  </p>
                  <p style={{color:'#b91c1c', fontSize:14, margin:0}}>
                    Try typing the name manually in the search bar.
                  </p>
                </>
              )}
            </div>
          )}

          <div style={{textAlign:'center', padding:'24px 0 10px', color:'#94a3b8', fontSize:11}}>
          </div>
        </main>
      </div>
    </>
  )
}
export default App
