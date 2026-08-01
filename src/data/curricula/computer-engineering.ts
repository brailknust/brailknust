import type { CurriculumTemplate } from "@/data/curricula/types";

export const computerEngineeringCurricula: CurriculumTemplate[] = [
  {
    college: "College of Engineering",
    department: "Department of Computer Engineering",
    program: "Computer Engineering",
    level: "LEVEL_100",
    semester: "First Semester",
    source: "User-provided KNUST Computer Engineering first year first semester course list.",
    courses: [
      { name: "Communication Skills", code: "ENGL 157", creditHours: 2 },
      { name: "Engineering Technology", code: "COE 153", creditHours: 2 },
      { name: "Algebra", code: "MATH 151", creditHours: 4 },
      { name: "Basic Mechanics", code: "ME 161", creditHours: 3 },
      { name: "Applied Electricity", code: "COE 181", creditHours: 3 },
      { name: "Technical Drawing", code: "ME 159", creditHours: 2 },
      { name: "Environmental Studies", code: "CE 155", creditHours: 2 },
    ],
  },
];
