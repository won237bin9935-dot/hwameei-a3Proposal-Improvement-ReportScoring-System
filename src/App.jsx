import { useState, useRef } from 'react'

const CRITERIA = [
  { id: 1, name: '動機（主動性）', weight: 0.15, color: '#1D9E75',
    desc: '10分=主動提出改善建議並執行，具品質作業或管理風險之預防意識，無外部指示自發行動；5分=完成主管交辦之改善任務，但主動預防意識不足；3分=依他人建議或要求後才進行改善。' },
  { id: 2, name: '創新', weight: 0.15, color: '#378ADD',
    desc: '10分=具原創性或明顯新思維，能以合理方法、數據或實際結果證明其可行性；5分=改善內容含部分創新元素，具一定實用性；3分=模仿參考或沿用既有作法，創新性較低。' },
  { id: 3, name: '效益', weight: 0.15, color: '#BA7517',
    desc: '10分=成效顯著，能具體展現品質、效率、成本或風險降低成果，具量化數據；5分=有可見改善，成效明確但整體效益仍可再提升；3分=效果有限、短期性或成果尚不明顯。' },
  { id: 4, name: '風險預防', weight: 0.20, color: '#D4537E',
    desc: '10分=已辨識潛在風險或失效模式，建立預防控制措施，具數據驗證方法或改善結果；5分=已提出部分預防措施，但風險辨識控制點或驗證方式尚不完整；3分=多屬問題發生後之處理，缺乏事前風險辨識與預防機制。' },
  { id: 5, name: '水平展開', weight: 0.10, color: '#7F77DD',
    desc: '10分=改善方案可跨部門、跨產線或全公司推行，具代表性與可複製性；5分=改善成果主要應用於部門內，具局部推廣性；3分=僅限個人或單點使用，無明顯擴散。' },
  { id: 6, name: '標準化程度', weight: 0.15, color: '#639922',
    desc: '10分=已建立正式標準文件，納入風險控制、量測方法、數值判定與追溯機制；5分=已有部分作業標準或判定依據，但數據化或追溯性仍不足；3分=多依個人經驗或口頭方式執行，未形成完整標準。' },
  { id: 7, name: '執行度', weight: 0.10, color: '#D85A30',
    desc: '10分=改善措施已實際導入，於相關人員或單位穩定執行，具持續追蹤機制；5分=已部分實施，效果初顯，仍需持續推進；3分=尚未實施、執行困難或僅停留於提案。' },
]

const SYSTEM_PROMPT = `你是「華美光學科技股份有限公司」的提案改善評審委員。
請依照公司 FM-10-3-1-1 提案改善簡報表的 7 項評分標準，對提案報告進行客觀、嚴謹的初評。
評分規則：
- 每個項目只能給 3、5、10 三個分數之一
- 評分必須客觀，同樣的報告每次評分結果應一致
- 使用繁體中文
- 只回傳 JSON，不含任何其他文字或 markdown`

function buildPrompt(reportText) {
  const criteriaText = CRITERIA.map(c =>
    `${c.id}. ${c.name}（權重${Math.round(c.weight * 100)}%）：${c.desc}`
  ).join('\n')

  return `請評分以下提案改善報告。

評分標準（每項只能給 3、5、10 分之一）：
${criteriaText}

報告內容：
${reportText.substring(0, 8000)}

請以 JSON 格式回傳，只回傳 JSON：
{
  "theme": "從報告中擷取的改善主題名稱",
  "scores": [
    {
      "id": 1,
      "score": 數字,
      "reason": "為何給此分數的具體說明（2句）",
      "pros": ["優點1", "優點2"],
      "cons": ["可加強之處1", "可加強之處2"],
      "suggestion": "具體改進建議，說明如何提升分數"
    }
  ]
}`
}

async function extractPdfText(file) {
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
  if (typeof window !== 'undefined') {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    await new Promise((resolve) => { script.onload = resolve; document.head.appendChild(script) })
  }
  const pdfjs = window['pdfjs-dist/build/pdf'] || window.pdfjsLib
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += `\n[第${i}頁]\n` + content.items.map(item => item.str).join(' ')
  }
  return text.trim()
}

export default function App() {
  const [phase, setPhase] = useState('upload') // upload | loading | result
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [previewText, setPreviewText] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const handleFile = async (f) => {
    if (!f || !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 格式的檔案（可將 PPT 另存為 PDF）')
      return
    }
    setError('')
    setFile(f)
    setLoadingMsg('讀取 PDF 中...')
    setPhase('loading')
    try {
      // 動態載入 pdfjs
      await new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve()
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
      })
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

      const arrayBuffer = await f.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += `\n[第${i}頁]\n` + content.items.map(item => item.str).join(' ')
      }
      const extracted = text.trim()
      if (!extracted || extracted.length < 50) {
        setError('無法從此 PDF 讀取文字，請確認為可選取文字的 PDF 格式')
        setPhase('upload')
        return
      }
      setExtractedText(extracted)
      setPreviewText(extracted.substring(0, 300))
      setPhase('upload')
    } catch (e) {
      setError('PDF 讀取失敗：' + e.message)
      setPhase('upload')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const startScoring = async () => {
    if (!extractedText) return
    setPhase('loading')
    setError('')

    const msgs = ['AI 正在閱讀報告內容...', '對照 7 項評分標準分析中...', '計算加權分數...', '整理評分理由與建議...']
    let idx = 0
    setLoadingMsg(msgs[0])
    const timer = setInterval(() => {
      idx = Math.min(idx + 1, msgs.length - 1)
      setLoadingMsg(msgs[idx])
    }, 5000)

    try {
      const res = await fetch('/api/score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: buildPrompt(extractedText) })
})
const data = await res.json()
const text = data.content.map(i => i.text || '').join('')
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      let weighted = 0
      CRITERIA.forEach(c => {
        const s = parsed.scores.find(x => x.id === c.id)
        if (s) weighted += s.score * c.weight
      })
      parsed.totalScore = weighted.toFixed(2)

      clearInterval(timer)
      setResult(parsed)
      setPhase('result')
    } catch (e) {
      clearInterval(timer)
      setError('評分失敗，請稍後再試：' + e.message)
      setPhase('upload')
    }
  }

  const reset = () => {
    setPhase('upload')
    setFile(null)
    setPreviewText('')
    setExtractedText('')
    setResult(null)
    setError('')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0ede8' }}>
      {/* Header */}
      <div style={{ background: '#1a1a1a', color: '#fff', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.5, letterSpacing: 1 }}>華美光學科技股份有限公司</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>提案改善 AI 初評系統</div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.4 }}>Powered by Claude AI · temperature: 0</div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* Upload Phase */}
        {phase === 'upload' && (
          <>
            <div style={{ fontSize: 12, color: '#888', background: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 16, lineHeight: 1.7 }}>
              <strong style={{ color: '#555' }}>使用說明：</strong>上傳提案改善報告 PDF，AI 將依 7 項評分標準進行初評，每份報告評分結果一致，約 20～40 秒完成。PPT 請先另存為 PDF。
            </div>

            <div
              onClick={() => !extractedText && fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? '#1a1a1a' : '#ccc'}`,
                borderRadius: 12, background: dragOver ? '#e8e5e0' : '#fff',
                padding: '2.5rem', textAlign: 'center',
                cursor: extractedText ? 'default' : 'pointer',
                transition: 'all 0.2s', marginBottom: 12
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                {extractedText ? '✅ 檔案已讀取完成' : '點擊或拖曳上傳報告 PDF'}
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>
                {extractedText ? file?.name : '支援 PDF 格式｜建議將 PPT 另存為 PDF 後上傳'}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>

            {previewText && (
              <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 10, padding: '1rem', marginBottom: 12, maxHeight: 140, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: '#aaa', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>已讀取內容預覽</div>
                <pre style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'inherit', lineHeight: 1.6 }}>{previewText}...</pre>
              </div>
            )}

            {error && (
              <div style={{ background: '#fcebeb', color: '#a32d2d', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}

            {extractedText && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={startScoring} style={{ flex: 1, padding: '12px', fontSize: 15, fontWeight: 500, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  開始 AI 評分
                </button>
                <button onClick={reset} style={{ padding: '12px 20px', fontSize: 14, background: '#fff', border: '0.5px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#888' }}>
                  重新上傳
                </button>
              </div>
            )}

            {!extractedText && (
              <button disabled style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 500, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, opacity: 0.3, cursor: 'not-allowed' }}>
                上傳檔案後開始 AI 評分
              </button>
            )}
          </>
        )}

        {/* Loading Phase */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ width: 36, height: 36, border: '2px solid #ddd', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, color: '#555' }}>{loadingMsg}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>請勿關閉視窗</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Result Phase */}
        {phase === 'result' && result && (
          <>
            {/* 總分卡片 */}
            <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: 16 }}>
              <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 4 }}>{file?.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{result.theme || '提案改善報告'}</div>
                <div style={{ fontSize: 42, fontWeight: 500, lineHeight: 1 }}>
                  {result.totalScore}
                  <span style={{ fontSize: 16, opacity: 0.5, fontWeight: 400 }}> / 10</span>
                </div>
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${parseFloat(result.totalScore) * 10}%`, height: '100%', background: '#fff', borderRadius: 99, transition: 'width 1s ease' }} />
              </div>
              {/* 各項分數快覽 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {CRITERIA.map(c => {
                  const s = result.scores.find(x => x.id === c.id)
                  return (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 10px', fontSize: 12 }}>
                      {c.name.replace('（主動性）', '')} <strong style={{ color: s?.score === 10 ? '#5DCAA5' : s?.score === 5 ? '#FAC775' : '#F09595' }}>{s?.score}</strong>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 各項目詳細評分 */}
            {CRITERIA.map(c => {
              const s = result.scores.find(x => x.id === c.id)
              if (!s) return null
              const pct = Math.round(s.score / 10 * 100)
              const badgeBg = s.score === 10 ? '#E1F5EE' : s.score === 5 ? '#FAEEDA' : '#FCEBEB'
              const badgeColor = s.score === 10 ? '#085041' : s.score === 5 ? '#633806' : '#791F1F'
              return (
                <div key={c.id} style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 12, padding: '1.25rem', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>
                      {c.name}
                      <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400, marginLeft: 4 }}>（{Math.round(c.weight * 100)}%）</span>
                    </span>
                    <span style={{ background: badgeBg, color: badgeColor, fontSize: 13, fontWeight: 500, padding: '3px 12px', borderRadius: 99 }}>{s.score} 分</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: '#f0ede8', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: 99, transition: 'width 0.8s ease' }} />
                  </div>

                  {/* 評分理由 */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#185FA5', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>評分理由</div>
                    <div style={{ fontSize: 13, color: '#555', background: '#f7f5f2', borderRadius: 8, padding: '8px 10px', lineHeight: 1.65 }}>{s.reason}</div>
                  </div>

                  {/* 優點 */}
                  {s.pros?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>優點</div>
                      <div style={{ fontSize: 13, color: '#555', background: '#f7f5f2', borderRadius: 8, padding: '8px 10px', lineHeight: 1.65 }}>
                        {s.pros.map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < s.pros.length - 1 ? 4 : 0 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', flexShrink: 0, marginTop: 6 }} />
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 可加強之處 */}
                  {s.cons?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>可加強之處</div>
                      <div style={{ fontSize: 13, color: '#555', background: '#f7f5f2', borderRadius: 8, padding: '8px 10px', lineHeight: 1.65 }}>
                        {s.cons.map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < s.cons.length - 1 ? 4 : 0 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E24B4A', flexShrink: 0, marginTop: 6 }} />
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 改進建議 */}
                  {s.suggestion && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#854F0B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>改進建議</div>
                      <div style={{ fontSize: 13, color: '#555', background: '#f7f5f2', borderRadius: 8, padding: '8px 10px', lineHeight: 1.65 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#BA7517', flexShrink: 0, marginTop: 6 }} />
                          <span>{s.suggestion}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{ fontSize: 11, color: '#aaa', textAlign: 'right', lineHeight: 1.8, marginTop: 8 }}>
              評分時間：{new Date().toLocaleString('zh-TW')}　｜　temperature: 0　｜　評分引擎：Claude AI<br />
              本評分由 AI 依評分標準自動初評，僅供委員會參考，最終評定以評審委員會決議為準。
            </div>

            <button onClick={reset} style={{ display: 'block', margin: '1.5rem auto 0', padding: '10px 28px', fontSize: 14, color: '#888', background: '#fff', border: '0.5px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
              評分另一份報告
            </button>
          </>
        )}
      </div>
    </div>
  )
}

