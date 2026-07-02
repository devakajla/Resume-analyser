import { useState } from 'react'
import './App.css'
import axios from 'axios'
import UploadResumes from './components/UploadResumes'
import JobDescription from './components/JobDescription'
import RankingResults from './components/RankingResults'
import Questions from './components/Questions'
import ATSScore from './components/ATSScore'

const API = 'http://127.0.0.1:8000'

function App() {
  const [uploadDone, setUploadDone] = useState(false)
  const [jdDone, setJdDone] = useState(false)
  const [questions, setQuestions] = useState(null)
  const [loadingQ, setLoadingQ] = useState(false)
  const [atsScore, setAtsScore] = useState(null)
  const [loadingAts, setLoadingAts] = useState(false)
  const [rankingResult, setRankingResult] = useState(null)
  const [loadingRank, setLoadingRank] = useState(false)
  const [activeTab, setActiveTab] = useState('setup')

  const handleQuestions = async (filename) => {
    setLoadingQ(true)
    try {
      const res = await axios.post(`${API}/generate-questions/${filename}`)
      setQuestions(res.data)
      setActiveTab('questions')
    } catch (err) {
      alert('Questions failed: ' + err.message)
    }
    setLoadingQ(false)
  }

  const handleAtsScore = async (filename) => {
    setLoadingAts(true)
    try {
      const res = await axios.post(`${API}/ats-score/${filename}`)
      setAtsScore(res.data)
      setActiveTab('ats')
    } catch (err) {
      alert('ATS score failed: ' + err.message)
    }
    setLoadingAts(false)
  }

  const handleRank = async () => {
    setLoadingRank(true)
    try {
      const res = await axios.post(`${API}/rank`)
      setRankingResult(res.data)
    } catch (err) {
      alert('Ranking failed: ' + err.message)
    }
    setLoadingRank(false)
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case 'setup': return 'Setup & Upload';
      case 'rankings': return 'Candidate Rankings';
      case 'ats': return 'ATS Score Analyzer';
      case 'questions': return 'HR Interview Questions';
      default: return '';
    }
  }

  const getPageDescription = () => {
    switch (activeTab) {
      case 'setup': return 'Upload candidate resumes and paste your job description to extract target skills';
      case 'rankings': return 'View AI-matched candidate scores, skill alignment, and shortlist status';
      case 'ats': return 'Detailed resume checker with structural score, 18 checks, and recommendations';
      case 'questions': return 'Custom behavioral and qualification questions generated specifically for the candidate';
      default: return '';
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'setup':
        return (
          <div className="setup-grid fade-in">
            <UploadResumes onUploadDone={() => setUploadDone(true)} />
            <JobDescription onJdSet={() => setJdDone(true)} />
          </div>
        )
      case 'rankings':
        return (
          <div className="fade-in">
            <RankingResults
              uploadDone={uploadDone}
              jdDone={jdDone}
              result={rankingResult}
              loading={loadingRank}
              onRank={handleRank}
              onQuestions={handleQuestions}
              onAtsScore={handleAtsScore}
            />
          </div>
        )
      case 'ats':
        if (!atsScore) {
          return (
            <div className="empty-state card fade-in">
              <span className="empty-icon">🎯</span>
              <h3>No Candidate Analyzed Yet</h3>
              <p>Go to the <strong>Candidate Rankings</strong> tab and click <strong>Check ATS Score</strong> on any candidate to view their breakdown report.</p>
              <button className="btn btn-outline" style={{ maxWidth: '200px', marginTop: '16px' }} onClick={() => setActiveTab('rankings')}>
                Go to Rankings
              </button>
            </div>
          )
        }
        return <ATSScore data={atsScore} />
      case 'questions':
        if (!questions) {
          return (
            <div className="empty-state card fade-in">
              <span className="empty-icon">💬</span>
              <h3>No Questions Generated Yet</h3>
              <p>Go to the <strong>Candidate Rankings</strong> tab and click <strong>Generate HR Questions</strong> on a candidate to view custom interview prompts.</p>
              <button className="btn btn-outline" style={{ maxWidth: '200px', marginTop: '16px' }} onClick={() => setActiveTab('rankings')}>
                Go to Rankings
              </button>
            </div>
          )
        }
        return <Questions data={questions} />
      default:
        return null
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-logo">🔍</span>
          <h2>Resume <span className="brand-highlight">Analyser</span></h2>
        </div>
        
        <nav className="sidebar-menu">
          <button 
            className={`nav-item ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            <span className="nav-icon">⚙️</span>
            <div className="nav-label-group">
              <span className="nav-label">Setup & Upload</span>
              <span className="nav-sub">Configure JD & Resumes</span>
            </div>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'rankings' ? 'active' : ''}`}
            onClick={() => setActiveTab('rankings')}
          >
            <span className="nav-icon">📊</span>
            <div className="nav-label-group">
              <span className="nav-label">Candidate Rankings</span>
              <span className="nav-sub">
                {rankingResult ? `${rankingResult.total} candidates` : 'Not run yet'}
              </span>
            </div>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'ats' ? 'active' : ''}`}
            onClick={() => setActiveTab('ats')}
          >
            <span className="nav-icon">🎯</span>
            <div className="nav-label-group">
              <span className="nav-label">ATS Analyzer</span>
              <span className="nav-sub">
                {atsScore ? atsScore.candidate : 'Select a candidate'}
              </span>
            </div>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            <span className="nav-icon">💬</span>
            <div className="nav-label-group">
              <span className="nav-label">Interview Q&A</span>
              <span className="nav-sub">
                {questions ? questions.candidate : 'Select a candidate'}
              </span>
            </div>
          </button>
        </nav>
      </aside>

      {/* Main dashboard content */}
      <div className="main-layout">
        <header className="main-header">
          <div className="header-title-area">
            <h1>{getPageTitle()}</h1>
            <p>{getPageDescription()}</p>
          </div>
          <div className="header-status-area">
            <span className={`status-pill ${uploadDone ? 'active' : ''}`}>
              {uploadDone ? '✓ Resumes Uploaded' : '✗ No Resumes'}
            </span>
            <span className={`status-pill ${jdDone ? 'active' : ''}`}>
              {jdDone ? '✓ JD Configured' : '✗ No JD'}
            </span>
          </div>
        </header>

        {loadingQ && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="spinner"></div>
              <div>Generating HR questions...</div>
            </div>
          </div>
        )}

        {loadingAts && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="spinner"></div>
              <div>Calculating ATS Score...</div>
            </div>
          </div>
        )}

        <main className="main-content">
          {renderTabContent()}
        </main>
      </div>
    </div>
  )
}

export default App
