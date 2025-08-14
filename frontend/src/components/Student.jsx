"use client"

import { useEffect, useState } from "react"
import { socket } from "../socket.js"

export default function Student({ onBack }) {
  const [step, setStep] = useState("name")
  const [name, setName] = useState(sessionStorage.getItem("lp_name") || "")
  const [pollId, setPollId] = useState("")
  const [question, setQuestion] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const onQuestion = (payload) => {
      setQuestion(payload)
      setSelectedOption(null)
      setSubmitted(false)
      setResults(null)
      setStep("question")
    }

    const onResults = (r) => {
      setResults(r)
      setStep("results")
    }

    const onKicked = () => setStep("kicked")
    const onEnded = () => onBack()

    socket.on("poll:question", onQuestion)
    socket.on("poll:results", onResults)
    socket.on("poll:kicked", onKicked)
    socket.on("poll:ended", onEnded)

    return () => {
      socket.off("poll:question", onQuestion)
      socket.off("poll:results", onResults)
      socket.off("poll:kicked", onKicked)
      socket.off("poll:ended", onEnded)
    }
  }, [onBack])

  useEffect(() => {
    let interval
    if (question && !submitted && step === "question") {
      const updateTimer = () => {
        const elapsed = Date.now() - question.startedAt
        const remaining = Math.max(0, Math.ceil((question.timeLimitMs - elapsed) / 1000))
        setTimeLeft(remaining)
      }

      updateTimer()
      interval = setInterval(updateTimer, 1000)
    }
    return () => clearInterval(interval)
  }, [question, submitted, step])

  const handleNameSubmit = () => {
    if (!name.trim()) return
    sessionStorage.setItem("lp_name", name.trim())
    setStep("pollId")
  }

  const handleJoinPoll = () => {
    if (!pollId.trim()) return

    socket.emit("student:join", { pollId: pollId.trim().toUpperCase(), name: name.trim() }, (r) => {
      if (!r.ok) {
        alert(r.error || "Join failed")
      } else {
        setStep("waiting")
      }
    })
  }

  const handleSubmit = () => {
    if (!selectedOption || submitted) return

    socket.emit("student:answer", { pollId, option: selectedOption }, (r) => {
      if (!r.ok) {
        alert(r.error || "Submit failed")
      } else {
        setSubmitted(true)
      }
    })
  }

  if (step === "name") {
    return (
      <div className="app-container">
        <div className="main-card">
          <div className="brand-badge">Intervue Poll</div>
          <h1 className="main-title">Let's Get Started</h1>
          <p className="subtitle">
            If you're a student, you'll be able to <strong>submit your answers</strong>, participate in live polls, and
            see how your responses compare with your classmates
          </p>
          <div className="form-group">
            <label className="form-label">Enter your Name</label>
            <input
              className="input-field"
              placeholder="Rahul Bajaj"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
            />
          </div>
          <button className="primary-btn" onClick={handleNameSubmit} disabled={!name.trim()}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  if (step === "pollId") {
    return (
      <div className="app-container">
        <div className="main-card">
          <div className="brand-badge">Intervue Poll</div>
          <h1 className="main-title">Join Poll</h1>
          <p className="subtitle">Enter the Poll ID provided by your teacher to join the live polling session</p>
          <div className="form-group">
            <label className="form-label">Enter Poll ID</label>
            <input
              className="input-field"
              placeholder="ABC123"
              value={pollId}
              onChange={(e) => setPollId(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleJoinPoll()}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <button className="primary-btn" onClick={handleJoinPoll} disabled={!pollId.trim()}>
            Join Poll
          </button>
        </div>
      </div>
    )
  }

  if (step === "waiting") {
    return (
      <div className="app-container">
        <div className="main-card">
          <div className="brand-badge">Intervue Poll</div>
          <div className="loading-spinner"></div>
          <div className="waiting-message">Wait for the teacher to ask questions..</div>
        </div>
      </div>
    )
  }

  if (step === "question") {
    return (
      <div className="app-container">
        <div className="main-card">
          <div className="brand-badge">Intervue Poll</div>
          <h2 style={{ marginBottom: "16px", fontSize: "20px", fontWeight: "600" }}>
            Question 1 <span className="timer-display">⏰ 00:{timeLeft.toString().padStart(2, "0")}</span>
          </h2>
          <div className="question-container">{question?.q}</div>
          <div className="options-grid">
            {question?.options.map((option) => (
              <button
                key={option}
                className={`option-btn ${selectedOption === option ? "selected" : ""}`}
                onClick={() => setSelectedOption(option)}
                disabled={submitted}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            className="primary-btn"
            onClick={handleSubmit}
            disabled={!selectedOption || submitted || timeLeft === 0}
          >
            {submitted ? "Submitted ✓" : "Submit"}
          </button>
        </div>
      </div>
    )
  }

  if (step === "results") {
    const total = results?.total || 0
    return (
      <div className="app-container">
        <div className="main-card">
          <div className="brand-badge">Intervue Poll</div>
          <h2 style={{ marginBottom: "16px", fontSize: "20px", fontWeight: "600" }}>
            Question 1 <span className="timer-display">⏰ 00:15</span>
          </h2>
          <div className="question-container">{results?.q}</div>
          <div className="results-container">
            {results?.options.map((option) => {
              const votes = results.votes[option] || 0
              const percentage = total > 0 ? Math.round((votes / total) * 100) : 0
              return (
                <div key={option} className="result-item">
                  <div className="result-header">
                    <span className="result-option">{option}</span>
                    <span className="result-percentage">{percentage}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${percentage}%` }}>
                      {percentage > 15 ? option : ""}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="waiting-message">Wait for the teacher to ask a new question..</div>
        </div>
      </div>
    )
  }

  if (step === "kicked") {
    return (
      <div className="app-container">
        <div className="main-card">
          <div className="brand-badge">Intervue Poll</div>
          <div className="kicked-container">
            <h1 className="kicked-title">You've been Kicked out !</h1>
            <p className="kicked-message">
              The teacher has removed you from the poll system. Please try again sometime.
            </p>
            <button className="primary-btn" onClick={onBack} style={{ marginTop: "24px" }}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
