"use client";

import { useState } from "react";

const lessons = [
  {
    title: "Read a function",
    explanation: "A function takes inputs and returns a result. In square(4), Python binds number to 4 and returns 4 × 4.",
    example: "def square(number):\n    return number * number\n\nprint(square(4))  # 16",
    exercise: "Before running anything, predict square(0) and square(-3). Explain each result.",
    answer: "square(0) returns 0. square(-3) returns 9 because the product of two negative numbers is positive.",
  },
  {
    title: "Add a condition",
    explanation: "An if statement runs its body when the condition is true. A return inside that body exits the function immediately.",
    example: "def shipping(total):\n    if total >= 50:\n        return 0\n    return 5\n\nprint(shipping(50))  # 0",
    exercise: "Write entry_fee(age). Ages 12 and under pay 4. Everyone else pays 7. Try ages 11, 12 and 13.",
    answer: "Use age <= 12 for the first branch. The fees for 11, 12 and 13 should be 4, 4 and 7.",
  },
  {
    title: "Check edge cases",
    explanation: "Test a value below, at and above a cutoff. That exposes a mistaken comparison even if most inputs already work.",
    example: "assert shipping(49) == 5\nassert shipping(50) == 0\nassert shipping(51) == 0",
    exercise: "A discount starts at 10 items. Which three counts would you test, and what should happen for each?",
    answer: "Test 9, 10 and 11 items. Only 10 and 11 should receive the discount.",
  },
];

export function DemoCourse() {
  const [selected, setSelected] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const lesson = lessons[selected];
  const completed = done.includes(selected);
  return <section className="panel course-path">
    <h2>Python functions and decisions</h2>
    <div className="course-progress-heading">
      <p role="status">{done.length} of {lessons.length} lessons done</p>
      <progress className="course-progress" aria-label="Demo lessons completed" value={done.length} max={lessons.length} />
    </div>
    <ol className="lesson-grid demo-lessons">{lessons.map((item, index) =>
      <li key={item.title} className={`lesson-tile${index === selected ? " is-selected" : ""}${done.includes(index) ? " is-done" : ""}`}>
        <button type="button" className="lesson-tile-link" aria-pressed={index === selected} onClick={() => setSelected(index)}>
          <strong>{item.title}</strong><span className="lesson-status">{done.includes(index) ? "Done" : "Ready to study"}</span>
        </button>
      </li>)}</ol>
    <section key={selected} className="markdown-body">
      <h2>{lesson.title}</h2><p>{lesson.explanation}</p>
      <pre className="library-text"><code>{lesson.example}</code></pre>
      <h3>Try it yourself</h3><p>{lesson.exercise}</p>
      <details><summary>Check your answer</summary><p>{lesson.answer}</p></details>
      <div className="import-actions demo-actions">
        <button type="button" className="button button-dark" onClick={() => setDone(previous => completed ? previous.filter(index => index !== selected) : [...previous, selected])}>{completed ? "Reopen lesson" : "Mark done"}</button>
        {selected < lessons.length - 1 && <button type="button" className="button button-light" onClick={() => setSelected(selected + 1)}>Next lesson</button>}
      </div>
    </section>
  </section>;
}
