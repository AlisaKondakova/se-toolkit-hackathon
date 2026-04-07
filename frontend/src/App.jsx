import { useState, useEffect } from 'react'

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState('')
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false) // По умолчанию закрыт на мобильных

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
      const res = await fetch('http://10.93.24.189:8000/search', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:q})
      })
      setResult(await res.json())
    } catch { setResult({success:false, message:'❌ Error'}) }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        /* === БАЗОВЫЕ СТИЛИ === */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f8faf8; color: #1a1a2e; }
        
        /* === САЙДБАР === */
        .sws-sidebar {
          position: fixed; left: 0; top: 0; height: 100vh;
          width: 320px; background: white; border-right: 1px solid #e2e8f0;
          padding: 24px; overflow-y: auto; z-index: 1000;
          transform: translateX(-100%); transition: transform 0.3s ease;
        }
        .sws-sidebar.open { transform: translateX(0); }
        
        /* === OVERLAY ДЛЯ МОБИЛЬНЫХ === */
        .sws-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.4); z-index: 999;
        }
        .sws-overlay.show { display: block; }
        
        /* === КНОПКИ-БУРГЕРЫ === */
        .sws-toggle {
          position: fixed; top: 16px; left: 16px; z-index: 1001;
          background: #16a34a; border: none; border-radius: 12px;
          padding: 12px; cursor: pointer; font-size: 22px;
          color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .sws-close {
          position: absolute; top: 12px; right: 12px;
          background: none; border: none; font-size: 24px;
          cursor: pointer; color: #64748b; padding: 4px 8px;
        }
        
        /* === ОСНОВНОЙ КОНТЕНТ === */
        .sws-main {
          padding: 70px 16px 30px; /* Отступ сверху для кнопки */
          max-width: 600px; margin: 0 auto;
        }
        
        /* === КАРТОЧКИ === */
        .sws-card {
          background: white; border-radius: 16px;
          padding: 20px; margin-bottom: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        
        /* === КНОПКИ И ИНПУТЫ === */
        .sws-btn {
          padding: 14px 20px; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          transition: all 0.15s;
        }
        .sws-btn-primary { background: #16a34a; color: white; }
        .sws-btn-primary:disabled { background: #cbd5e1; cursor: not-allowed; }
        .sws-btn-secondary {
          background: #f1f5f9; color: #475569;
          border: 1px solid #e2e8f0; padding: 8px 14px;
          font-size: 14px; border-radius: 20px;
        }
        .sws-btn-secondary:hover { background: #16a34a; color: white; border-color: #16a34a; }
        
        .sws-input {
          width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0;
          border-radius: 12px; font-size: 16px; outline: none;
        }
        .sws-input:focus { border-color: #16a34a; }
        
        /* === ПРЕВЬЮ ФОТО === */
        .sws-preview {
          max-width: 120px; max-height: 120px;
          border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          object-fit: contain; display: block; margin: 12px auto;
        }
        
        /* === РЕЗУЛЬТАТ === */
        .sws-result {
          text-align: center; padding: 24px; border-radius: 16px;
          border: 2px solid;
        }
        .sws-result.success { background: #f0fdf4; border-color: #86efac; }
        .sws-result.error { background: #fffbeb; border-color: #fde68a; }
        .sws-result-emoji { font-size: 48px; margin-bottom: 8px; }
        .sws-result-text { color: #166534; font-weight: 700; font-size: 16px; margin: 8px 0; }
        .sws-result-co2 {
          background: #dcfce7; border-radius: 10px;
          padding: 8px 14px; display: inline-block;
          font-weight: 600; color: #15803d; margin-top: 12px;
        }
        
        /* === СПИСОК ПРАВИЛ === */
        .rule-card {
          padding: 12px; border-radius: 12px; margin-bottom: 12px;
          border: 1px solid; font-size: 14px; line-height: 1.5;
        }
        .rule-card.blue { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .rule-card.yellow { background: #fefce8; border-color: #fde68a; color: #854d0e; }
        .rule-card.red { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
        .rule-card.gray { background: #f8fafc; border-color: #e2e8f0; color: #475569; }
        .rule-card ul { padding-left: 18px; margin: 6px 0; }
        .rule-card strong { display: block; margin-bottom: 4px; }
        
        /* === АДАПТИВ ПОД ТЕЛЕФОНЫ (< 600px) === */
        @media (max-width: 600px) {
          .sws-sidebar { width: 85%; max-width: 320px; }
          .sws-main { padding: 65px 12px 24px; }
          .sws-card { padding: 16px; border-radius: 14px; }
          .sws-btn { padding: 12px 16px; font-size: 15px; border-radius: 10px; }
          .sws-input { padding: 12px 14px; font-size: 15px; }
          .sws-preview { max-width: 100px; max-height: 100px; }
          .sws-result-emoji { font-size: 40px; }
          .sws-result-text { font-size: 15px; }
          h1 { font-size: 22px !important; }
          .suggestions-wrap { gap: 6px !important; }
          .sws-btn-secondary { padding: 6px 12px; font-size: 13px; }
        }
        
        /* === ДЛЯ ПЛАНШЕТОВ (600-900px) === */
        @media (min-width: 601px) and (max-width: 900px) {
          .sws-sidebar { width: 280px; }
          .sws-main { padding: 70px 20px 30px; }
        }
        
        /* === ДЛЯ ДЕСКТОПА (> 900px) — сайдбар всегда виден === */
        @media (min-width: 901px) {
          .sws-sidebar {
            position: relative; transform: translateX(0) !important;
            height: auto; border-right: 1px solid #e2e8f0;
          }
          .sws-overlay { display: none !important; }
          .sws-toggle { display: none !important; }
          .sws-close { display: none !important; }
          .sws-main { padding: 30px 20px; }
        }
      `}</style>
      
      <div style={{display:'flex', minHeight:'100vh'}}>
        {/* Overlay для мобильных */}
        <div className={`sws-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}/>

        {/* Кнопка открытия сайдбара (только мобильные) */}
        <button className="sws-toggle" onClick={() => setSidebarOpen(true)} title="Sorting Rules">
          ☰
        </button>

        {/* САЙДБАР: ПРАВИЛА СОРТИРОВКИ */}
        <aside className={`sws-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <button className="sws-close" onClick={() => setSidebarOpen(false)}>✕</button>
          <h2 style={{fontSize:18, fontWeight:700, marginBottom:20, color:'#16a34a', display:'flex', alignItems:'center', gap:8}}>
            📋 Sorting Rules
          </h2>
          
          <div style={{fontSize:14, color:'#475569'}}>
            <div className="rule-card blue">
              <strong>🔵 Dry Recyclables</strong>
              <ul>
                <li>Paper, cardboard, mail</li>
                <li>Plastic (codes 01, 02, 05)</li>
                <li>Glass (clear & colored)</li>
                <li>Metal (cans, foil, lids)</li>
              </ul>
              <p style={{margin:'8px 0 0', fontSize:13}}>💡 Tip: Rinse, dry & crush</p>
            </div>

            <div className="rule-card yellow">
              <strong>🟡 Organic Waste</strong>
              <ul>
                <li>Fruit & vegetable peels</li>
                <li>Food scraps, bread, grains</li>
                <li>Coffee grounds, tea bags</li>
                <li>Eggshells</li>
              </ul>
              <p style={{margin:'8px 0 0', fontSize:13}}>💡 Compost or general waste</p>
            </div>

            <div className="rule-card red">
              <strong>🔴 Hazardous Waste</strong>
              <ul>
                <li>Batteries & accumulators</li>
                <li>Light bulbs (LED, fluorescent)</li>
                <li>Electronics & cables</li>
                <li>Medicines & thermometers</li>
              </ul>
              <p style={{margin:'8px 0 0', fontSize:13}}>⚠️ Special collection points only!</p>
            </div>

            <div className="rule-card gray">
              <strong>⚪ Non-Recyclables</strong>
              <ul>
                <li>Dirty packaging, receipts, tissues</li>
                <li>Styrofoam, multi-layer cartons</li>
                <li>Diapers & hygiene products</li>
                <li>Plastic codes 03, 04, 06, 07</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <main className="sws-main">
          <div style={{textAlign:'center', marginBottom:24}}>
            <h1 style={{margin:0, fontSize:24, fontWeight:800, color:'#16a34a'}}>♻️ Smart Waste Sorter</h1>
            <p style={{margin:'4px 0 0', color:'#64748b', fontSize:14}}>Smart sorting with CO₂ tracking</p>
          </div>

          {/* Загрузка фото */}
          <div className="sws-card">
            <input type="file" accept="image/*" onChange={handleFile} style={{display:'none'}} id="cam"/>
            <label htmlFor="cam" className="sws-btn sws-btn-primary" style={{display:'block', textAlign:'center'}}>
              {loading ? '⏳ Analyzing...' : '📸 Upload Photo'}
            </label>
            {preview && <img src={preview} alt="" className="sws-preview"/>}
          </div>

          {/* Поиск */}
          <div className="sws-card">
            <p style={{margin:'0 0 10px', color:'#64748b', fontSize:13, fontWeight:500}}>Or find instantly:</p>
            <div className="suggestions-wrap" style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginBottom:14}}>
              {suggestions.map(s => (
                <button key={s} onClick={()=>handleSearch(s)} className="sws-btn-secondary">{s}</button>
              ))}
            </div>
            <div style={{display:'flex', gap:8}}>
              <input value={input} onChange={e=>setInput(e.target.value)} placeholder="pepsi, iphone..." 
                className="sws-input" onKeyPress={e=>e.key==='Enter'&&handleSearch()}/>
              <button onClick={()=>handleSearch()} disabled={!input.trim()||loading} 
                className="sws-btn sws-btn-primary" style={{padding:'14px 18px'}}>🔍</button>
            </div>
          </div>

          {/* Результат */}
          {result && (
            <div className={`sws-result ${result.success ? 'success' : 'error'}`}>
              <div className="sws-result-emoji">{result.bin || '❓'}</div>
              {result.success ? (
                <>
                  <p style={{margin:'0 0 6px', color:'#4ade80', fontSize:12, fontWeight:600, textTransform:'uppercase'}}>
                    ✅ {result.text}
                  </p>
                  <p className="sws-result-text">{result.instruction}</p>
                  <div className="sws-result-co2">🌍 CO₂: {result.co2}</div>
                </>
              ) : (
                <p style={{color:'#b45309', fontSize:15, margin:0}}>{result.message}</p>
              )}
            </div>
          )}

          <div style={{textAlign:'center', padding:'24px 0 10px', color:'#94a3b8', fontSize:11}}>
            ♻️ Smart Waste Sorter • Hackathon 2026
          </div>
        </main>
      </div>
    </>
  )
}
export default App
