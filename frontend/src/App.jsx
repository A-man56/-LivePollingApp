"use client"

import { useState } from "react"
import RoleSelect from "./components/RoleSelect.jsx"
import Teacher from "./components/Teacher.jsx"
import Student from "./components/Student.jsx"

export default function App() {
  const [role, setRole] = useState(null)

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole)
  }

  const handleBack = () => {
    setRole(null)
  }

  if (!role) {
    return <RoleSelect onSelect={handleRoleSelect} />
  }

  return <>{role === "teacher" ? <Teacher onBack={handleBack} /> : <Student onBack={handleBack} />}</>
}
