"use client"

import { useState } from "react"

export default function RoleSelect({ onSelect }) {
  const [selectedRole, setSelectedRole] = useState(null)

  const handleContinue = () => {
    if (selectedRole) {
      onSelect(selectedRole)
    }
  }

  return (
    <div className="app-container">
      <div className="main-card">
        <div className="brand-badge">Intervue Poll</div>

        <h1 className="main-title">Welcome to the Live Polling System</h1>
        <p className="subtitle">
          Please select the role that best describes you to begin using the live polling system
        </p>

        <div className="role-selection">
          <div
            className={`role-card student ${selectedRole === "student" ? "selected" : ""}`}
            onClick={() => setSelectedRole("student")}
          >
            <h3 className="role-title">I'm a Student</h3>
            <p className="role-description">
              Lorem Ipsum is simply dummy text of the printing and typesetting industry
            </p>
          </div>

          <div
            className={`role-card teacher ${selectedRole === "teacher" ? "selected" : ""}`}
            onClick={() => setSelectedRole("teacher")}
          >
            <h3 className="role-title">I'm a Teacher</h3>
            <p className="role-description">Submit answers and view live poll results in real-time.</p>
          </div>
        </div>

        <button className="primary-btn" onClick={handleContinue} disabled={!selectedRole}>
          Continue
        </button>
      </div>
    </div>
  )
}
