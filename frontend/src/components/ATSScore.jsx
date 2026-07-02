import React from 'react';

function ATSScore({ data }) {
  if (!data) return null;

  const { total_score, max_score, grade, checks, top_fixes, candidate } = data;

  // Grade color helper
  const getGradeColorClass = (g) => {
    switch (g) {
      case 'Excellent':
      case 'Good':
        return 'grade-excellent';
      case 'Needs Improvement':
        return 'grade-warning';
      case 'Poor':
        return 'grade-poor';
      default:
        return '';
    }
  };

  // Percentage color helper for individual checks
  const getPctColorClass = (pct) => {
    if (pct >= 80) return 'progress-fill-success';
    if (pct >= 50) return 'progress-fill-warning';
    return 'progress-fill-danger';
  };

  return (
    <div className="card card-highlight ats-score-card fade-in">
      <div className="card-header ats-header">
        <div>
          <h2>ATS Score Report</h2>
          <span className="candidate-name-badge">{candidate}</span>
        </div>
        <div className={`total-score-badge ${getGradeColorClass(grade)}`}>
          <span className="score-num">{total_score}</span>
          <span className="score-max">/ {max_score}</span>
          <div className="grade-text">{grade}</div>
        </div>
      </div>

      <div className="checks-container">
        <h3>Analysis Checklist ({checks?.length || 0} Checks)</h3>
        <div className="checks-grid">
          {checks?.map((check, idx) => {
            const pct = check.max > 0 ? (check.score / check.max) * 100 : 0;
            return (
              <div key={idx} className="check-item">
                <div className="check-item-header">
                  <span className="check-category">{check.category}</span>
                  <span className="check-score">
                    {check.score} / {check.max}
                  </span>
                </div>
                <div className="check-progress-bg">
                  <div
                    className={`check-progress-fill ${getPctColorClass(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="check-details">
                  {check.details?.map((detail, dIdx) => (
                    <div key={dIdx} className="check-detail-line">
                      • {detail}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {top_fixes && top_fixes.length > 0 && (
        <div className="top-fixes-section">
          <h3>Top Recommended Fixes</h3>
          <ul className="fixes-list">
            {top_fixes.map((fix, idx) => (
              <li key={idx} className="fix-item">
                <span className="fix-category">{fix.category}:</span>{' '}
                <span className="fix-suggestion">{fix.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ATSScore;
