import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, ChevronRight, Globe, Search } from "lucide-react";
import { PublicNavbar } from "@/components/public/Navbar";
import { HomeCarousel } from "@/components/public/HomeCarousel";

const journals = [
  { code: "SGJVSR", name: "Vedic and Sanskrit Research", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { code: "SGMRJ", name: "Multidisciplinary Research", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { code: "SGJPLS", name: "Physical and Life Sciences", color: "bg-purple-50 border-purple-200 text-purple-700" },
  { code: "SGJETR", name: "Engineering and Technology Research", color: "bg-orange-50 border-orange-200 text-orange-700" },
  { code: "SGJSSH", name: "Social Sciences and Humanities", color: "bg-rose-50 border-rose-200 text-rose-700" },
  { code: "SGJASH", name: "Applied Science and Health", color: "bg-teal-50 border-teal-200 text-teal-700" }
];

const stats = [
  { value: "6", label: "Active Journals" },
  { value: "500+", label: "Published Papers" },
  { value: "40+", label: "Countries" },
  { value: "100%", label: "Open Access" }
];

export const HomePage = () => (
  <div className="min-h-screen bg-white">
    <PublicNavbar />

    <section className="mx-auto max-w-6xl px-6 pt-8">
      <HomeCarousel />
    </section>

    <section className="relative overflow-hidden bg-white pb-24 pt-20">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-2/5 translate-x-16 -skew-x-6 bg-green-50 opacity-60" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
            <Globe className="h-3.5 w-3.5" />
            Open Access · Peer Reviewed · Global Reach
          </div>
          <h1 className="mb-6 font-display text-5xl leading-[1.1] text-gray-900 md:text-6xl">
            Advancing
            <br />
            Knowledge Through
            <br />
            <span className="text-green-600">Quality Research</span>
          </h1>
          <p className="mb-10 max-w-lg text-lg leading-relaxed text-gray-500">
            ScriptHive manages the complete editorial workflow for researchers worldwide — from submission to peer-reviewed publication.
          </p>
          <div className="mb-10 flex flex-wrap gap-3">
            <Link to="/submit" className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700">
              Submit Your Paper <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/journals" className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:border-gray-300">
              Browse Journals
            </Link>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-green-800 py-14">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="mb-1 font-display text-4xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-green-200">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="bg-gray-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="mb-2 font-display text-3xl text-gray-900">Our Journals</h2>
            <p className="text-sm text-gray-500">Six peer-reviewed academic journals across disciplines</p>
          </div>
          <Link to="/journals" className="flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700">
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {journals.map((journal) => (
            <Link
              key={journal.code}
              to={`/journals/${journal.code}`}
              className="group rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:border-green-200 hover:shadow-md"
            >
              <span className={`mb-4 inline-block rounded-lg border px-2.5 py-1 text-xs font-bold font-mono ${journal.color}`}>
                {journal.code}
              </span>
              <h3 className="mb-3 font-display text-sm font-semibold text-gray-800 transition-colors group-hover:text-green-700">
                ScriptHive Global Journal of {journal.name}
              </h3>
              <div className="flex items-center text-xs font-medium text-green-600">
                View Journal <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-green-800 py-20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="mb-4 font-display text-3xl text-white">Ready to Publish Your Research?</h2>
        <p className="mb-8 text-sm text-green-200">Join researchers from 40+ countries who trust ScriptHive for peer-reviewed publication.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/submit" className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-medium text-green-800 hover:bg-green-50">
            Submit Paper <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/track/SH-2025-0001" className="flex items-center gap-2 rounded-xl border border-green-600 px-6 py-3 text-sm font-medium text-green-100 hover:bg-green-700">
            <Search className="h-4 w-4" /> Track Submission
          </Link>
        </div>
      </div>
    </section>

    <footer className="bg-green-900 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-600">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-sm text-gray-300">ScriptHive Publication </span>
        </div>
        <p className="text-xs text-gray-600">© {new Date().getFullYear()} ScriptHive. All rights reserved.</p>
        <Link to="/admin/login" className="text-xs text-gray-600 transition-colors hover:text-gray-400">
          Admin Portal →
        </Link>
      </div>
    </footer>
  </div>
);
