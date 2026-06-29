import { useState } from 'react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000'

function UploadResumes({ onUploadDone }) {
  const [files, setFiles] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (files.length === 0) return
    setLoading(true)
    const formData = new FormData()
    for (let f of files) formData.append('files', f)
    try {
      const res = await axios.post(`${API}/upload-resumes`, formData)
      setResult(res.data)
      onUploadDone(res.data)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="step-number">1</span>
        <h2>Upload Resumes</h2>
      </div>

      <div className="upload-area">
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          onChange={(e) => setFiles([...e.target.files])}
          id="file-input"
        />
        <label htmlFor="file-input" className="upload-label">
          <span className="upload-icon">📄</span>
          <span>{files.length > 0 ? `${files.length} files selected` : 'Choose resume files'}</span>
          <span className="upload-hint">PDF, DOCX, TXT, PNG, JPG</span>
        </label>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleUpload}
        disabled={files.length === 0 || loading}
      >
        {loading ? 'Parsing...' : `Upload & Parse (${files.length} files)`}
      </button>

      {result && (
        <div className="result-box">
          <div className="result-status">
            <span className="badge badge-success">{result.parsed} parsed</span>
            {result.failed > 0 && <span className="badge badge-error">{result.failed} failed</span>}
          </div>
          <div className="candidate-list">
            {result.results.map((r, i) => (
              <div key={i} className="candidate-mini">
                <div className="candidate-mini-left">
                  <div className="avatar">{r.name?.[0] || '?'}</div>
                  <div>
                    <strong>{r.name}</strong>
                    <span className="text-muted">{r.email}</span>
                  </div>
                </div>
                <span className="badge badge-info">{r.skills_count} skills</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UploadResumes
