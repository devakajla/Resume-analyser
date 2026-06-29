import { useState } from 'react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000'

function JobDescription({ onJdSet }) {
  const [jdText, setJdText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSetJd = async () => {
    if (!jdText.trim()) return
    setLoading(true)
    const formData = new FormData()
    formData.append('jd_text', jdText)
    try {
      const res = await axios.post(`${API}/set-jd`, formData)
      setResult(res.data)
      onJdSet(res.data)
    } catch (err) {
      alert('Failed: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="step-number">2</span>
        <h2>Job Description</h2>
      </div>

      <textarea
        placeholder="Paste the Job Description here..."
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        rows={8}
      />

      <button
        className="btn btn-primary"
        onClick={handleSetJd}
        disabled={!jdText.trim() || loading}
      >
        {loading ? 'Extracting skills...' : 'Extract Skills & Set JD'}
      </button>

      {result && (
        <div className="result-box">
          <p className="result-status">
            <span className="badge badge-success">{result.skill_count} skills extracted</span>
          </p>
          <div className="skills-cloud">
            {result.extracted_skills.map((s, i) => (
              <span key={i} className="tag tag-skill">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default JobDescription
