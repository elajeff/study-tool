import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { Course, SavedCourseStep } from "@/lib/course";
import { CourseStepAction } from "./CourseStepAction";

export function CourseModules({ courseId, course, steps, selectedModule, nextModule, selectedStep, nextStep }: {
  courseId: string; course: Course; steps: SavedCourseStep[]; selectedModule?: string; nextModule?: string; selectedStep?: string; nextStep?: string;
}) {
  return <ol className="course-modules">{course.modules.map((module, index) => {
    const saved = steps.filter(step => step.module_key === module.id).sort((a, b) => a.position - b.position);
    const done = saved.filter(step => step.completed_at).length;
    const finished = saved.length > 0 && done === saved.length, current = nextModule === module.id;
    return <li key={module.id} className={`course-module${finished ? " is-done" : ""}${current ? " is-current" : ""}`}>
      <details open={selectedModule === module.id || current}>
        <summary><span className="module-number">{finished ? <Check size={18} aria-label="Lessons done" /> : String(index + 1).padStart(2, "0")}</span>
          <span className="module-name"><strong>{module.id} · {module.title}</strong>
            <span>{saved.length ? `${done} / ${saved.length} lessons done` : "Lesson plan not prepared"}{current ? " · Up next" : ""}</span>
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
  })}</ol>;
}
