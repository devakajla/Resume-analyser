function Questions({ data }) {
  if (!data) return null

  const formatQuestions = (text) => {
    return text.split('\n').map((line, i) => {
      const cleaned = line.replace(/\*\*/g, '')
      if (!cleaned.trim()) return null
      if (cleaned.match(/^(KNOWLEDGE|EXPERIENCE|GAP|CONFIDENCE)/i) || cleaned.match(/^#{1,3}\s/)) {
        return <h3 key={i} className="q-category">{cleaned.replace(/^#+\s*/, '')}</h3>
      }
      if (cleaned.match(/^\d+\./)) {
        return <div key={i} className="q-item">{cleaned}</div>
      }
      return <p key={i} className="q-line">{cleaned}</p>
    })
  }

  return (
    <div className="card card-highlight">
      <div className="card-header">
        <h2>HR Questions</h2>
        <span className="badge badge-info">{data.candidate}</span>
      </div>
      <div className="questions-body">
        {formatQuestions(data.questions)}
      </div>
    </div>
  )
}

export default Questions
