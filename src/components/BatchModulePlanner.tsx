"use client";

import { Fragment, useState } from "react";
import type { Course } from "@/lib/course";
import { modulePlanningCard } from "@/lib/module-request";
import { CourseLessonCard } from "./CourseLessonCard";
import { InboxImporter } from "./InboxImporter";

export function BatchModulePlanner({ courseId, course, plannedIds }: { courseId: string; course: Course; plannedIds: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const unplanned = course.modules.filter(module => !plannedIds.includes(module.id));
  const requested = course.modules.filter(module => selected.includes(module.id));
  const key = JSON.stringify(selected);
  return <details className="course-disclosure" id="batch-plans">
    <summary>Plan several modules at once</summary>
    <p>Choose 2 to 5 modules that need lessons. Copy one request into your course chat, then import the JSON it returns.</p>
    <fieldset className="batch-modules">
      <legend>{selected.length} selected</legend>
      {unplanned.map(module => <label key={module.id}>
        <input type="checkbox" checked={selected.includes(module.id)} disabled={selected.length === 5 && !selected.includes(module.id)}
          onChange={event => setSelected(event.target.checked ? [...selected, module.id] : selected.filter(id => id !== module.id))} />
        {" "}{module.id} · {module.title}
      </label>)}
    </fieldset>
    {!!selected.length && <p><button type="button" className="text-link" onClick={() => setSelected([])}>Clear selection</button></p>}
    {requested.length >= 2 && <Fragment key={key}>
      <CourseLessonCard label="Copy batch request" text={modulePlanningCard(courseId, course, requested)} />
      <h3>Import the returned plans</h3>
      <p>Every selected plan must pass validation before the batch is saved. Existing progress stays attached to saved lessons.</p>
      <InboxImporter moduleScope={{ courseId, moduleIds: selected }} />
    </Fragment>}
  </details>;
}
