import { useState } from 'react'
import { examRows } from '../landingContent.js'

export default function ProductPreview() {
  const [preview, setPreview] = useState('exams')
  return (
    <div className="product-wrap reveal-3d" data-reveal="up">
      <div className="product-stage tilt-3d" id="demo">
        <img src="/reference/book-sticker.svg" alt="" className="sticker sticker-book" />
        <img src="/reference/check-sticker.svg" alt="" className="sticker sticker-check" />
        <img src="/reference/pile-1.webp" alt="" className="sticker sticker-face" />
        <img src="/reference/bulb-sticker.svg" alt="" className="sticker sticker-bulb" />
        <div className="product-browser">
          <div className="product-bar" aria-hidden="true">
            <i /><i /><i /><span>uncooked.exam / candidate-workspace</span>
          </div>
          <div className="product-body">
            <div className="product-tabs">
              {[['exams', 'My exams'], ['workspace', 'Exam workspace']].map(([id, label]) => (
                <button key={id} className={preview === id ? 'primary' : ''} type="button"
                  aria-pressed={preview === id} aria-controls={`preview-${id}`} onClick={() => setPreview(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div id="preview-exams" hidden={preview !== 'exams'}>
              <div className="product-summary">
                <div><h3>Ayaan Malik · Candidate</h3><p>Assigned examinations</p></div>
                <div className="product-stats">
                  {[['Exams', 5], ['Available', 1], ['Completed', 2]].map(([label, value]) => (
                    <div key={label}><small>{label}</small><strong>{value}</strong></div>
                  ))}
                </div>
              </div>
              <div className="product-table">
                <table>
                  <thead><tr>{['Code', 'Examination', 'Opens', 'Duration'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                  <tbody>{examRows.map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="product-caption">
                <span className="button primary" aria-hidden="true">▤ &nbsp; Exam schedule</span>
                <span>Live candidate preview</span>
              </div>
            </div>
            <div className="workspace-preview" id="preview-workspace" hidden={preview !== 'workspace'}>
              <div>
                <h3>Web fundamentals</h3>
                <p>Which HTML element represents the main content of a page?</p>
                <div className="preview-choices">
                  {['aside', 'main', 'nav', 'footer'].map((choice, i) => (
                    <span key={choice} className={i === 1 ? 'sample-answer' : ''}>{String.fromCharCode(65 + i)} &nbsp; {choice}</span>
                  ))}
                </div>
              </div>
              <div className="preview-progress">
                <span aria-hidden="true">✓</span><h4>Answer saved</h4>
                <p>Synced to server &amp; local cache.</p><strong>1 of 3 answered</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
