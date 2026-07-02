import React from 'react'
import CandidateCard from './CandidateCard'

function RankingResults({ uploadDone, jdDone, result, loading, onRank, onQuestions, onAtsScore }) {
  if (!uploadDone || !jdDone) {
    return (
      <div className="empty-state card">
        <span className="empty-icon">📊</span>
        <h3>Setup Incomplete</h3>
        <p>Before you can rank candidates, please complete the configuration in the <strong>Setup & Upload</strong> tab:</p>
        <div className="setup-checklist">
          <div className={`checklist-item ${uploadDone ? 'done' : ''}`}>
            <span className="check-bullet">{uploadDone ? '✓' : '○'}</span>
            <span>Upload one or more candidate resumes</span>
          </div>
          <div className={`checklist-item ${jdDone ? 'done' : ''}`}>
            <span className="check-bullet">{jdDone ? '✓' : '○'}</span>
            <span>Set job description text and extract skills</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {!result ? (
        <div className="rank-prompt-area">
          <div className="card-header" style={{ justifyContent: 'center', marginBottom: '12px' }}>
            <h2>Ready to Analyze and Rank Resumes</h2>
          </div>
          <p className="rank-prompt-text">
            Compare all uploaded resumes against the extracted job description requirements. We will analyze semantic similarity, keyword alignment, and run deep LLM matches.
          </p>
          <button className="btn btn-success" onClick={onRank} disabled={loading} style={{ maxWidth: '360px', margin: '0 auto' }}>
            {loading ? 'Analyzing & Ranking...' : 'Rank All Resumes Against JD'}
          </button>
        </div>
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
                  onAtsScore={onAtsScore}
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
