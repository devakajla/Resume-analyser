import { useState } from 'react'
import './App.css'
import axios from 'axios'
import UploadResumes from './components/UploadResumes'
import JobDescription from './components/JobDescription'
import RankingResults from './components/RankingResults'
import Questions from './components/Questions'

const API = 'http://127.0.0.1:8000'

function App() {
  const [uploadDone, setUploadDone] = useState(false)
  const [jdDone, setJdDone] = useState(false)
  const [questions, setQuestions] = useState(null)
  const [loadingQ, setLoadingQ] = useState(false)

  const handleQuestions = async (filename) => {
    setLoadingQ(true)
    try {
      const res = await axios.post(`${API}/generate-questions/${filename}`)
      setQuestions(res.data)
    } catch (err) {
      alert('Questions failed: ' + err.message)
    }
    setLoadingQ(false)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Resume <span className="highlight">Analyser</span></h1>
        <p>Upload resumes, match against JD, get ranked candidates with HR questions</p>
      </header>

      {loadingQ && <div className="loading">Generating HR questions...</div>}

      <div className="layout">
        <div className="col-left">
          <UploadResumes onUploadDone={() => setUploadDone(true)} />
          <JobDescription onJdSet={() => setJdDone(true)} />
        </div>
        <div className="col-right">
          <RankingResults
            uploadDone={uploadDone}
            jdDone={jdDone}
            onQuestions={handleQuestions}
          />
          <Questions data={questions} />
        </div>
      </div>
    </div>
  )
}

export default App
