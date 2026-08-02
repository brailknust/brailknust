import { ArrowRight, BarChart3, BookOpen, BrainCircuit, CalendarDays, Check, GraduationCap, Sparkles } from "lucide-react";
import Link from "next/link";

const weekItems = [
  { title: "Signals & Systems", meta: "Monday · 10:00 AM", label: "Class" },
  { title: "Networks quiz prep", meta: "Tuesday · 11:00 AM", label: "Study" },
  { title: "Microprocessors assignment", meta: "Due Wednesday", label: "Due" },
];

const steps = [
  { number: "01", title: "Add your semester", text: "Create your semester, courses, credit hours, class times, and important deadlines." },
  { number: "02", title: "Build your study plan", text: "Turn your workload into practical study sessions that fit around your timetable." },
  { number: "03", title: "Track and improve", text: "Complete tasks, review your progress, and adjust your plan as the semester changes." },
];

const features = [
  { icon: CalendarDays, title: "Semester planner", text: "Keep courses, class times, assignments, quizzes, and exams in one timeline." },
  { icon: BrainCircuit, title: "Smart study plans", text: "Create focused study sessions based on your available time and priorities." },
  { icon: BarChart3, title: "Progress tracking", text: "See completed work, weekly study time, and the areas that need more attention." },
  { icon: Sparkles, title: "Academic diagnostics", text: "Reflect on performance and identify practical ways to improve your study routine." },
  { icon: BookOpen, title: "Course workspace", text: "Organize every course with its materials, tasks, deadlines, and academic activity." },
  { icon: GraduationCap, title: "Goal-focused dashboard", text: "Start each day with a clear summary of upcoming work and your current momentum." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#15231a]">
      <div className="mx-auto w-full max-w-[1200px] overflow-hidden bg-white shadow-[0_0_80px_rgba(18,65,38,0.05)]">
        <header className="sticky top-0 z-50 flex h-[76px] items-center border-b border-[#e8eee9]/90 bg-white/90 px-6 backdrop-blur-xl sm:px-[42px]">
          <Link href="/" className="flex items-center gap-[14px]">
            <span className="grid h-[40px] w-[40px] place-items-center rounded-[12px] bg-[#045c2e] text-white shadow-[0_8px_20px_rgba(4,92,46,0.22)]"><BookOpen className="h-[18px] w-[18px]" /></span>
            <span className="text-[15px] font-bold tracking-[-0.01em]">BRAIL <span className="text-[#08783f]">KNUST</span></span>
          </Link>
          <nav className="ml-auto hidden items-center gap-8 text-[12px] text-[#657269] md:flex">
            <a href="#how-it-works" className="hover:text-[#08783f]">How it works</a>
            <a href="#features" className="hover:text-[#08783f]">Features</a>
            <a href="#knust" className="hover:text-[#08783f]">Built for KNUST</a>
          </nav>
          <Link href="/login" className="ml-auto inline-flex h-[38px] items-center justify-center rounded-[10px] bg-[#08783f] px-5 text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(8,120,63,0.16)] transition hover:-translate-y-0.5 hover:bg-[#045c2e] md:ml-8">Log in</Link>
        </header>

        <section className="relative grid gap-12 overflow-hidden bg-[radial-gradient(circle_at_85%_15%,#eaf6ee_0,transparent_34%)] px-6 pb-20 pt-16 sm:px-[64px] lg:grid-cols-[1.08fr_0.92fr] lg:gap-[84px] lg:pb-[116px] lg:pt-[82px]">
          <div className="relative z-10 pt-[7px]">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#d8eadf] bg-[#f4faf6] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#08783f]"><Sparkles className="h-3 w-3" /> Student workspace</p>
            <h1 className="mt-[26px] text-[42px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-[54px]">Plan your semester.<br /><span className="text-[#08783f]">Study with direction.</span></h1>
            <p className="mt-[26px] max-w-[500px] text-[15px] leading-[1.55] text-[#657269]">Courses, deadlines, study plans, diagnostics, and progress—organized around your real academic workload.</p>
            <div className="mt-[40px] flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[11px] bg-[#08783f] px-5 text-[12px] font-semibold text-white shadow-[0_12px_26px_rgba(8,120,63,0.2)] transition hover:-translate-y-0.5 hover:bg-[#045c2e]">Create account <ArrowRight className="h-3.5 w-3.5" /></Link>
              <a href="#how-it-works" className="inline-flex h-[46px] items-center justify-center rounded-[11px] border border-[#dfe8e1] bg-white px-5 text-[12px] font-semibold transition hover:border-[#08783f] hover:text-[#08783f]">See how it works</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[#657269]"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#08783f]" /> Built for KNUST students</span><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#08783f]" /> Simple to set up</span></div>
          </div>
          <aside className="relative z-10 min-h-[440px] rounded-[22px] border border-[#dfe8e1] bg-white p-5 shadow-[0_28px_70px_rgba(20,64,38,0.12)] sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#08783f]">Overview</p><h2 className="mt-1 text-[17px] font-semibold">This week</h2></div><span className="rounded-full bg-[#edf7f0] px-3 py-1.5 text-[10px] font-semibold text-[#08783f]">On track</span></div>
            <p className="mt-[6px] text-[11px] text-[#657269]">A focused summary of classes and study</p>
            <div className="mt-[17px]">{weekItems.map((item) => <div key={item.title} className="flex h-[66px] items-start gap-3 py-[8px]"><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{item.title}</p><p className="mt-[5px] text-[10px] text-[#657269]">{item.meta}</p></div><span className="inline-flex h-[25px] w-[88px] shrink-0 items-center rounded-full bg-[#edf7f0] px-[10px] text-[10px] font-medium text-[#08783f]">{item.label}</span></div>)}</div>
            <div className="mt-[25px] grid grid-cols-2 gap-3">
              <div className="h-[92px] rounded-[14px] border border-[#dfe8e1] bg-[#fbfdfb] p-[14px]"><p className="text-[10px] font-medium text-[#657269]">Weekly study</p><p className="mt-[10px] text-[22px] font-semibold">6h 45m</p></div>
              <div className="h-[92px] rounded-[14px] border border-[#dfe8e1] bg-[#fbfdfb] p-[14px]"><p className="text-[10px] font-medium text-[#657269]">Tasks done</p><p className="mt-[10px] text-[22px] font-semibold">8 / 12</p></div>
            </div>
          </aside>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-t border-[#e6ede8] px-6 py-24 sm:px-[64px]">
          <div className="max-w-[590px]"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#08783f]">How it works</p><h2 className="mt-4 text-[32px] font-semibold tracking-[-0.03em]">From a busy semester to a clear weekly plan.</h2><p className="mt-4 text-[14px] leading-7 text-[#657269]">Set up your courses once, then use one focused workspace to decide what needs your attention each day.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">{steps.map((step) => <article key={step.number} className="group rounded-[20px] border border-[#dfe8e1] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-[#b8d9c4] hover:shadow-[0_18px_40px_rgba(20,64,38,0.08)]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#edf7f0] text-[11px] font-bold text-[#08783f] transition group-hover:bg-[#08783f] group-hover:text-white">{step.number}</span><h3 className="mt-8 text-[17px] font-semibold">{step.title}</h3><p className="mt-3 text-[13px] leading-6 text-[#657269]">{step.text}</p></article>)}</div>
        </section>

        <section id="features" className="scroll-mt-24 border-y border-[#e1ebe4] bg-[#f4f9f5] px-6 py-24 sm:px-[64px]">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div className="max-w-[590px]"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#08783f]">Features</p><h2 className="mt-4 text-[32px] font-semibold tracking-[-0.03em]">Everything your academic week needs.</h2></div><p className="max-w-[350px] text-[13px] leading-6 text-[#657269]">Designed to keep planning simple, useful, and connected to the work you actually need to finish.</p></div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <article key={title} className="group rounded-[20px] border border-[#dfe8e1] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-[#b8d9c4] hover:shadow-[0_18px_40px_rgba(20,64,38,0.08)]"><span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#edf7f0] text-[#08783f] transition group-hover:bg-[#08783f] group-hover:text-white"><Icon className="h-[19px] w-[19px]" /></span><h3 className="mt-6 text-[16px] font-semibold">{title}</h3><p className="mt-3 text-[13px] leading-6 text-[#657269]">{text}</p></article>)}</div>
        </section>

        <section id="knust" className="scroll-mt-24 px-6 py-24 sm:px-[64px]">
          <div className="grid overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#08783f_0%,#045c2e_70%)] text-white shadow-[0_30px_70px_rgba(4,92,46,0.18)] lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-8 sm:p-12"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#bde4ca]">Built for KNUST</p><h2 className="mt-5 max-w-[520px] text-[34px] font-semibold leading-tight tracking-[-0.03em]">A student workspace shaped around life at KNUST.</h2><p className="mt-5 max-w-[520px] text-[14px] leading-7 text-[#d8eee0]">Whether you are balancing lectures, labs, group work, quizzes, or project deadlines, BRAIL helps you keep the semester visible and manageable.</p><Link href="/signup" className="mt-8 inline-flex h-11 items-center justify-center rounded-[10px] bg-white px-5 text-[12px] font-semibold text-[#075f34] hover:bg-[#edf7f0]">Create your workspace</Link></div>
            <div className="border-t border-white/15 bg-black/10 p-8 sm:p-12 lg:border-l lg:border-t-0"><p className="text-[13px] font-semibold">Made for your real semester</p><ul className="mt-6 space-y-5">{["Courses and credit-hour planning", "Lectures, labs, quizzes, and exams", "Personal study schedules", "Progress across the whole semester"].map((item) => <li key={item} className="flex items-center gap-3 text-[13px] text-[#d8eee0]"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/10"><Check className="h-3.5 w-3.5" /></span>{item}</li>)}</ul></div>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-[#e6ede8] px-6 py-8 text-[11px] text-[#657269] sm:flex-row sm:items-center sm:justify-between sm:px-[56px]"><div className="flex items-center gap-2 font-semibold text-[#15231a]"><BookOpen className="h-4 w-4 text-[#08783f]" /> BRAIL KNUST</div><p>Plan clearly. Study consistently. Progress confidently.</p></footer>
      </div>
    </main>
  );
}
