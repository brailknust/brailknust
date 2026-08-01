export type ExtractedTimetableRow = {
  id: string;
  courseCode: string;
  courseName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  venue: string;
  confidence: number;
};

const dayAliases: Record<string, string> = {
  mon: "Monday",
  monday: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  wed: "Wednesday",
  weds: "Wednesday",
  wednesday: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  thursday: "Thursday",
  fri: "Friday",
  friday: "Friday",
  sat: "Saturday",
  saturday: "Saturday",
  sun: "Sunday",
  sunday: "Sunday",
};

function normalizeDay(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
  return dayAliases[cleaned] ?? "";
}

function findDayInLine(line: string) {
  const cleaned = line.toLowerCase().replace(/[^a-z]/g, " ");
  const compact = cleaned.replace(/\s+/g, "");

  for (const [alias, day] of Object.entries(dayAliases)) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(cleaned) || compact.includes(alias)) {
      return day;
    }
  }

  if (compact.includes("wednes")) return "Wednesday";
  if (compact.includes("hursday")) return "Thursday";

  return "";
}

function parseTime(value: string) {
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, "");
  const match = cleaned.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/);

  if (!match) return "";

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const period = match[3];

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return "";

  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  if (hours > 23) return "";

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function parseTimeRange(line: string) {
  const match = line.match(
    /\b(\d{1,2}(?::?\d{2})?\s*(?:am|pm)?)\s*(?:-|\u2013|\u2014|to)\s*(\d{1,2}(?::?\d{2})?\s*(?:am|pm)?)\b/i,
  );

  if (!match) return null;

  const startTime = parseTime(match[1]);
  let endTime = parseTime(match[2]);

  if (!startTime || !endTime) return null;

  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  const hasPeriod = /am|pm/i.test(match[1]) || /am|pm/i.test(match[2]);

  if (!hasPeriod && endHour < startHour && endHour < 12) {
    endTime = `${(endHour + 12).toString().padStart(2, "0")}${endTime.slice(2)}`;
  }

  return {
    startTime,
    endTime,
    raw: match[0],
  };
}

function parseTimeRanges(line: string) {
  const ranges: Array<{ startTime: string; endTime: string; raw: string }> = [];
  const pattern =
    /(\b\d{1,2}(?::?\d{2})?\s*(?:am|pm)?\b)\s*(?:-|\u2013|\u2014|to|\s+)\s*(\b\d{1,2}(?::?\d{2})?\s*(?:am|pm)?\b)/gi;

  for (const match of line.matchAll(pattern)) {
    const startTime = parseTime(match[1]);
    let endTime = parseTime(match[2]);

    if (!startTime || !endTime) continue;

    const startHour = Number(startTime.slice(0, 2));
    const endHour = Number(endTime.slice(0, 2));
    const hasPeriod = /am|pm/i.test(match[1]) || /am|pm/i.test(match[2]);

    if (!hasPeriod && endHour < startHour && endHour < 12) {
      endTime = `${(endHour + 12).toString().padStart(2, "0")}${endTime.slice(2)}`;
    }

    ranges.push({
      startTime,
      endTime,
      raw: match[0],
    });
  }

  return ranges;
}

function extractCourseCode(text: string) {
  const match = text.match(/\b([A-Z]{2,5})\s*[- ]?\s*(\d{3}[A-Z]?)\b/i);

  if (!match) return "";

  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

function extractCourseCodes(text: string) {
  return Array.from(text.matchAll(/\b([A-Z]{2,5})\s*[- ]?\s*(\d{3}[A-Z]?)\b/gi)).map(
    (match) => `${match[1].toUpperCase()} ${match[2].toUpperCase()}`,
  );
}

function cleanCourseName(text: string, courseCode: string, timeRange: string, dayOfWeek: string) {
  return text
    .replace(timeRange, " ")
    .replace(new RegExp(`\\b${dayOfWeek}\\b`, "i"), " ")
    .replace(courseCode.replace(" ", ""), " ")
    .replace(courseCode, " ")
    .replace(/\b(room|rm|lab|hall|lt|venue)\s*[:#-]?\s*\w+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVenue(text: string) {
  const match = text.match(
    /\b(?:[A-Z]{2,5}-[A-Z0-9-]+|PBO?\d{2,3}|PB\d{3}|ECR\s+[A-Z0-9-]+|ENG\s+AUDIT|LAB\s+N?\d*|[A-Z0-9]{2,}\s+LAB|(?:room|rm|lab|hall|lt|venue)\s*[:#-]?\s*[a-z0-9 -]+)/i,
  );

  return match?.[0]?.trim() ?? "";
}

function extractVenueParts(line: string) {
  return line
    .split("|")
    .map((part) =>
      part.replace(
        /\b(?:mon(?:day)?|tue(?:s|sday|day)?|wednes(?:day)?|wed(?:nes)?|thu(?:rs|rsday|day)?|hursday|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi,
        " ",
      ),
    )
    .map((part) => extractVenue(part) || part.trim())
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => /[a-z0-9]/i.test(part));
}

function confidenceFor(row: Omit<ExtractedTimetableRow, "id" | "confidence">) {
  let score = 0.35;

  if (row.courseCode) score += 0.2;
  if (row.courseName) score += 0.15;
  if (row.dayOfWeek) score += 0.15;
  if (row.startTime && row.endTime) score += 0.15;
  if (row.venue) score += 0.05;

  return Math.min(Math.round(score * 100) / 100, 0.95);
}

function makeRow(row: Omit<ExtractedTimetableRow, "id" | "confidence">): ExtractedTimetableRow {
  return {
    id: crypto.randomUUID(),
    ...row,
    confidence: confidenceFor(row),
  };
}

function parseTableBlocks(lines: string[]) {
  const rows: ExtractedTimetableRow[] = [];
  let activeDay = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lookahead = lines.slice(index + 1, index + 5);
    const day = findDayInLine(line) || lookahead.map(findDayInLine).find(Boolean) || "";
    const blockDay = day || activeDay;
    if (day) activeDay = day;

    const ranges = parseTimeRanges(line);
    if (ranges.length === 0 || !blockDay) continue;

    const courseLine = lookahead.find((candidate) => extractCourseCodes(candidate).length > 0) ?? "";
    const courseCodes = extractCourseCodes(courseLine);

    if (courseCodes.length === 0) continue;

    const venueLine = lookahead.find((candidate) => candidate !== courseLine && extractVenue(candidate)) ?? "";
    const venueParts = extractVenueParts(venueLine);
    const count = Math.min(ranges.length, courseCodes.length);

    for (let slot = 0; slot < count; slot += 1) {
      rows.push(
        makeRow({
          courseCode: courseCodes[slot],
          courseName: courseCodes[slot],
          dayOfWeek: blockDay,
          startTime: ranges[slot].startTime,
          endTime: ranges[slot].endTime,
          venue: venueParts[slot] ?? "",
        }),
      );
    }
  }

  return rows;
}

export function parseTimetableText(rawText: string): ExtractedTimetableRow[] {
  const rows: ExtractedTimetableRow[] = [];
  let activeDay = "";
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines) {
    const lineDay = findDayInLine(line);
    const aliasDay = lineDay || line.split(/\s+/).map(normalizeDay).find(Boolean);

    if (aliasDay) activeDay = aliasDay;

    const timeRange = parseTimeRange(line);
    if (!timeRange || !activeDay) continue;

    const courseCode = extractCourseCode(line.toUpperCase());
    if (!courseCode) continue;

    const venue = extractVenue(line);
    const courseName = cleanCourseName(line, courseCode, timeRange.raw, activeDay);

    rows.push(
      makeRow({
        courseCode,
        courseName: courseName || courseCode || "Class Session",
        dayOfWeek: activeDay,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        venue,
      }),
    );
  }

  const tableRows = parseTableBlocks(lines);
  const seen = new Set<string>();

  return [...rows, ...tableRows].filter((row) => {
    const key = `${row.dayOfWeek}-${row.startTime}-${row.endTime}-${row.courseCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
