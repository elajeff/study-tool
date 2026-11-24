"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { Course, SavedCourseStep } from "@/lib/course";
import { CourseStepAction } from "./CourseStepAction";

export function CourseModules({ courseId, course, steps, selectedModule, nextModule, selectedStep, nextStep }: {
  courseId: string; course: Course; steps: SavedCourseStep[]; selectedModule?: string; nextModule?: string; selectedStep?: string; nextStep?: string;
}) {
  const [query, setQuery] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const search = query.trim().toLowerCase();
  const visible = course.modules.map((module, index) => {
    const saved = steps.filter(step => step.module_key === module.id).sort((a, b) => a.position - b.position);
    const done = saved.filter(step => step.completed_at).length;
    return { module, index, saved, done };
  }).filter(({ module, saved, done }) => (!readyOnly || saved.length > done)
    && `${module.id} ${module.title}`.toLowerCase().includes(search));
  return <>
    <div className="search-row module-filters">
      <input type="search" className="input" aria-label="Search modules by title or ID" placeholder="Search modules by title or ID" value={query} onChange={event => setQuery(event.target.value)} />
      <label className={`module-filter${readyOnly ? " is-active" : ""}`}>
        <input type="checkbox" checked={readyOnly} onChange={event => setReadyOnly(event.target.checked)} /> Show only modules with unfinished lessons
      </label>
    </div>
    <p role="status" className="muted small">{visible.length} of {course.modules.length} modules shown</p>
    {!visible.length && <p>No matching modules. Try changing the search or filter.</p>}
    <ol className="course-modules">{visible.map(({ module, index, saved, done }) => {
    const finished = saved.length > 0 && done === saved.length, current = nextModule === module.id;
    return <li key={module.id} className={`course-module${finished ? " is-done" : ""}${current ? " is-current" : ""}`}>
      <details open={selectedModule === module.id || current}>
        <summary><span className="module-number">{finished ? <Check size={18} aria-label="Lessons done" /> : String(index + 1).padStart(2, "0")}</span>
          <span className="module-name"><strong>{module.id} · {module.title}</strong>
            <span>{finished ? "Done" : saved.length ? "Lessons ready" : "Needs a lesson plan"} · {saved.length ? `${done} / ${saved.length} lessons done` : "Outline imported"}{current ? " · Up next" : ""}</span>
          </span><ChevronDown size={17} className="module-chevron" />
        </summary>
        <div className="module-content"><p>{module.outcome}</p>
          <p>Prerequisites: {module.needs.join(", ") || "None"}. Estimated steps: {module.steps_estimate}.</p>
          <details><summary>Sources and independent proof</summary><p>Sources: {module.sources.join(", ")}.</p><p>{module.proof}</p></details>
          {!!saved.length && <ol className="lesson-grid">{saved.map((lesson, lessonIndex) => {
            const isNext = nextStep === lesson.row_id, isSelected = selectedStep === lesson.row_id;
            return <li key={lesson.row_id} className={`lesson-tile${lesson.completed_at ? " is-done" : ""}${isNext ? " is-next" : ""}${isSelected ? " is-selected" : ""}`}>
              <Link className="lesson-tile-link" aria-current={isSelected ? "step" : undefined}
                href={{ pathname: "/courses", query: { id: courseId, module: module.id, step: lesson.row_id }, hash: "lesson-focus" }}>
                <span className="lesson-tile-top"><span className="lesson-number">{lesson.completed_at ? <Check size={16} /> : lessonIndex + 1}</span>
                  <span className="lesson-kind">{lesson.kind}</span>{isNext && <span className="path-badge">Next</span>}</span>
                <strong>Lesson {lessonIndex + 1}</strong><p className="lesson-tile-goal">{lesson.goal}</p>
                <span className="lesson-open">{lesson.completed_at ? "Revisit lesson" : "Start lesson"}<ArrowRight size={14} /></span>
              </Link>
              <div className="lesson-tile-footer"><span className="lesson-status">{lesson.completed_at ? "Done" : "Not started"}</span>
                <CourseStepAction courseId={courseId} step={lesson} /></div>
            </li>;
          })}</ol>}
          <Link className="button button-light" href={{ pathname: "/courses", query: { id: courseId, module: module.id }, hash: "module-plan" }}>{saved.length ? "View lesson plan" : "Prepare lesson plan"}</Link>
        </div>
      </details>
    </li>;
  })}</ol></>;
}
