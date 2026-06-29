import { useState } from 'react'
import axios from 'axios'
import CandidateCard from './CandidateCard'

const API = 'http://127.0.0.1:8000'

function RankingResults({ uploadDone, jdDone, onQuestions }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleRank = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`${API}/rank`)
      setResult(res.data)
    } catch (err) {
      alert('Ranking failed: ' + err.message)
    }
    setLoading(false)
  }

  if (!uploadDone || !jdDone) return null

  return (
    <div className="card">
      {!result ? (
        <>
          <div className="card-header">
            <span className="step-number">3</span>
            <h2>Rank Candidates</h2>
          </div>
          <button className="btn btn-success" onClick={handleRank} disabled={loading}>
            {loading ? 'Ranking...' : 'Rank All Resumes Against JD'}
          </button>
        </>
      ) : (
        <>
          <div className="card-header">
            <h2>Ranking Results</h2>
            <span className="badge badge-info">{result.total} candidates</span>
          </div>

          {result.shortlisted.length > 0 && (
            <div className="results-group">
              <h3 className="group-label group-label-success">
                Shortlisted ({result.shortlisted_count})
              </h3>
              {result.shortlisted.map((r, i) => (
                <CandidateCard
                  key={i}
                  candidate={r}
                  rank={r.rank}
                  isShortlisted={true}
                  onGenerateQuestions={onQuestions}
                />
              ))}
            </div>
          )}

          {result.not_shortlisted.length > 0 && (
            <div className="results-group">
              <h3 className="group-label group-label-muted">Not Shortlisted</h3>
              {result.not_shortlisted.map((r, i) => (
                <CandidateCard key={i} candidate={r} isShortlisted={false} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default RankingResults
