"use client"

import { useEffect, useRef, useState } from "react"
import { socket } from "../socket.js"

export default function ChatPopup({ pollId, who, isTeacher, students = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState("")
  const [msgs, setMsgs] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [kickedStudents, setKickedStudents] = useState(new Set())
  const [isKicking, setIsKicking] = useState(new Set()) // Track students being kicked
  const [chatError, setChatError] = useState("")
  const endRef = useRef()

  useEffect(() => {
    const onMsg = (m) => {
      setMsgs((list) => [...list, m])
      if (!isOpen) {
        setUnreadCount((count) => count + 1)
      }
    }

    const onChatError = (error) => {
      setChatError(error.error)
      setTimeout(() => setChatError(""), 3000) // Clear error after 3 seconds
    }

    socket.on("chat:message", onMsg)
    socket.on("chat:error", onChatError)

    return () => {
      socket.off("chat:message", onMsg)
      socket.off("chat:error", onChatError)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      endRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [msgs, isOpen])

  const send = () => {
    if (!text.trim()) return
    // Check if student is kicked
    if (!isTeacher && kickedStudents.has(who)) {
      setChatError("You have been removed from the chat and cannot send messages.")
      setTimeout(() => setChatError(""), 3000)
      return
    }
    socket.emit("chat:send", { pollId, from: who, text })
    setText("")
    setChatError("") // Clear any previous errors
  }

  const kickStudent = (studentName) => {
    if (!isTeacher || isKicking.has(studentName)) return

    setIsKicking((prev) => new Set([...prev, studentName]))

    // Remove student from poll
    socket.emit("teacher:removeStudent", { pollId, name: studentName }, (response) => {
      setIsKicking((prev) => {
        const newSet = new Set(prev)
        newSet.delete(studentName)
        return newSet
      })

      if (response.ok) {
        // Add to kicked students set
        setKickedStudents((prev) => new Set([...prev, studentName]))

        setMsgs((prevMsgs) => [
          ...prevMsgs.filter((msg) => msg.from !== studentName),
          {
            from: "System",
            text: `${studentName} has been removed from the chat`,
            ts: Date.now(),
            isSystem: true,
          },
        ])
      } else {
        setChatError("Failed to kick student. Please try again.")
        setTimeout(() => setChatError(""), 3000)
      }
    })
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      send()
    }
  }

  const toggleChat = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setUnreadCount(0)
    }
  }

  // Don't show chat if student is kicked
  if (!isTeacher && kickedStudents.has(who)) {
    return null
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 1000,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            width: "350px",
            height: "450px",
            backgroundColor: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: "12px 12px 0 0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            marginBottom: "0px",
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              padding: "16px",
              borderRadius: "12px 12px 0 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Live Chat</h4>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>
                {isTeacher ? `${students.length} students online` : "Chat with teacher"}
              </p>
            </div>
            <button
              onClick={toggleChat}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              backgroundColor: "#f8fafc",
            }}
          >
            {msgs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "14px",
                  marginTop: "20px",
                }}
              >
                No messages yet. Start the conversation!
              </div>
            ) : (
              msgs.map((m, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "12px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {m.isSystem ? (
                    <div
                      style={{
                        textAlign: "center",
                        fontSize: "12px",
                        color: "#6b7280",
                        fontStyle: "italic",
                        padding: "8px",
                        backgroundColor: "#f3f4f6",
                        borderRadius: "8px",
                        margin: "4px 0",
                      }}
                    >
                      {m.text}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: m.from === who ? "#2563eb" : "#374151",
                          }}
                        >
                          {m.from}
                        </span>
                        {isTeacher && m.from !== who && m.from !== "Teacher" && (
                          <button
                            onClick={() => kickStudent(m.from)}
                            disabled={isKicking.has(m.from)}
                            style={{
                              background: isKicking.has(m.from) ? "#9ca3af" : "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              fontSize: "10px",
                              cursor: isKicking.has(m.from) ? "not-allowed" : "pointer",
                            }}
                          >
                            {isKicking.has(m.from) ? "..." : "Kick"}
                          </button>
                        )}
                      </div>
                      <div
                        style={{
                          backgroundColor: m.from === who ? "#2563eb" : "#fff",
                          color: m.from === who ? "white" : "#374151",
                          padding: "8px 12px",
                          borderRadius: "12px",
                          fontSize: "14px",
                          alignSelf: m.from === who ? "flex-end" : "flex-start",
                          maxWidth: "80%",
                          wordWrap: "break-word",
                        }}
                      >
                        {m.text}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid #e5e7eb",
              backgroundColor: "#fff",
            }}
          >
            {chatError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  marginBottom: "8px",
                  border: "1px solid #fecaca",
                }}
              >
                {chatError}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Type your message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isTeacher && kickedStudents.has(who)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "20px",
                  fontSize: "14px",
                  outline: "none",
                  opacity: !isTeacher && kickedStudents.has(who) ? 0.5 : 1,
                }}
              />
              <button
                onClick={send}
                disabled={!text.trim() || (!isTeacher && kickedStudents.has(who))}
                style={{
                  backgroundColor: text.trim() && (isTeacher || !kickedStudents.has(who)) ? "#2563eb" : "#9ca3af",
                  color: "white",
                  border: "none",
                  borderRadius: "20px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  cursor: text.trim() && (isTeacher || !kickedStudents.has(who)) ? "pointer" : "not-allowed",
                  fontWeight: "500",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Toggle Button */}
      <button
        onClick={toggleChat}
        style={{
          width: "60px",
          height: "60px",
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "50%",
          cursor: "pointer",
          fontSize: "24px",
          boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isOpen ? "✕" : "💬"}
        {!isOpen && unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              backgroundColor: "#ef4444",
              color: "white",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
