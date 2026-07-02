function CandidateCard({ candidate, rank, isShortlisted, onGenerateQuestions, onAtsScore }) {
  return (
    <div className={`candidate-card ${isShortlisted ? 'shortlisted' : 'not-shortlisted'}`}>
      <div className="candidate-top">
        <div className="candidate-info">
          <div className="avatar avatar-lg">{candidate.name?.[0] || '?'}</div>
          <div>
            {rank && <span className="rank">#{rank}</span>}
            <h3>{candidate.name}</h3>
            <span className="text-muted">{candidate.file}</span>
          </div>
        </div>
        <div className="score-circle">
          <span className={`score-value ${isShortlisted ? '' : 'low'}`}>
            {(candidate.final_score * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {isShortlisted && (
        <>
          <div className="score-bars">
            <ScoreBar label="Embedding" value={candidate.embedding_score} />
            <ScoreBar label="Skills" value={candidate.skill_score} />
            <ScoreBar label="LLM Match" value={candidate.llm_score || 0} />
          </div>

          <div className="skills-section">
            <div className="skills-row">
              {candidate.matched_skills?.map((s, i) => (
                <span key={i} className="tag tag-matched">{s}</span>
              ))}
              {candidate.missing_skills?.slice(0, 4).map((s, i) => (
                <span key={i} className="tag tag-missing">{s}</span>
              ))}
              {candidate.missing_skills?.length > 4 && (
                <span className="tag tag-missing">+{candidate.missing_skills.length - 4} more</span>
              )}
            </div>
          </div>

          <div className="candidate-actions">
            <button className="btn btn-outline" onClick={() => onGenerateQuestions(candidate.file)}>
              Generate HR Questions
            </button>
            <button className="btn btn-outline btn-ats" onClick={() => onAtsScore(candidate.file)}>
              Check ATS Score
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ScoreBar({ label, value }) {
  const pct = (value * 100).toFixed(0)
  return (
    <div className="score-bar">
      <div className="score-bar-header">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default CandidateCard
