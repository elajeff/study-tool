import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import type { Course, SavedCourseStep } from "@/lib/course";

export function CourseModules({ courseId, course, steps, selectedModule, nextModule }: {
  courseId: string; course: Course; steps: SavedCourseStep[]; selectedModule?: string; nextModule?: string;
}) {
  return <ol className="course-modules">{course.modules.map((module, index) => {
    const saved = steps.filter(step => step.module_key === module.id);
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
          <p>Sources: {module.sources.join(", ")}.</p><p>Independent proof: {module.proof}</p>
          <Link href={{ pathname: "/courses", query: { id: courseId, module: module.id }, hash: "module-plan" }}>Open lesson plan</Link>
        </div>
      </details>
    </li>;
  })}</ol>;
}
