import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText, LayoutGrid, List } from "lucide-react";
import { api, getRoleRedirect, getToken, getApiBase } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchBadge, ScoreBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EducationItem = { college?: string; degree?: string; duration?: string };
type JobItem = {
  company?: string;
  role?: string;
  duration_months?: number;
  start?: string;
  end?: string;
};
type GapItem = { gap_months?: number; duration?: string; between?: string };

type Applicant = {
  application_id: string;
  name: string;
  email: string;
  ats_score: number;
  compatibility_score: number;
  current_stage: string;
  skills?: string[];
  insights?: {
    total_experience_years?: number;
    current_status?: string;
    education?: EducationItem[];
    jobs?: JobItem[];
    employment_gaps?: GapItem[];
    job_switches?: number;
    avg_tenure_months?: number;
    red_flags?: string[];
    questions?: string;
  };
  summary?: string;
};

type Pipeline = {
  job_title: string;
  stages: string[];
  counts: Record<string, number>;
  pipeline: Record<string, Applicant[]>;
};

type JobMeta = {
  id: string;
  title: string;
  status: string;
  rounds?: number;
  company?: { id: string; name: string };
  department?: { id: string; name: string; poc_name?: string; poc_email?: string; poc_phone?: string };
};

type Category = "Applied" | "Shortlisted" | "Rounds" | "Offers" | "Rejected";
const CATEGORIES: Category[] = ["Applied", "Shortlisted", "Rounds", "Offers", "Rejected"];

const CATEGORY_META: Record<Category, { accent: string; dot: string; ring: string }> = {
  Applied: { accent: "text-primary", dot: "bg-primary", ring: "border-primary/60" },
  Shortlisted: { accent: "text-accent-foreground", dot: "bg-accent", ring: "border-accent/60" },
  Rounds: { accent: "text-warning", dot: "bg-warning", ring: "border-warning/60" },
  Offers: { accent: "text-success", dot: "bg-success", ring: "border-success/60" },
  Rejected: { accent: "text-danger", dot: "bg-danger", ring: "border-danger/60" },
};

/** Extracts a canonical round key like "L1" from stage labels such as "L1", "L1 Interview", "Round 1", or "Level 1". */
function roundKey(stage?: string | null): string | null {
  if (!stage) return null;
  const m = /(?:^|\b)(?:l|level|round)\s*(\d+)\b/i.exec(stage);
  return m ? `L${m[1]}` : null;
}

function stageCategory(stage: string): Category | null {
  const normalized = stage.trim().toLowerCase();
  if (normalized.includes("applied") || normalized.includes("application")) return "Applied";
  if (normalized.includes("screen") || normalized.includes("shortlist")) return "Shortlisted";
  if (roundKey(stage)) return "Rounds";
  if (normalized === "round" || normalized === "rounds") return "Rounds";
  if (normalized.includes("offer")) return "Offers";
  if (normalized.includes("reject")) return "Rejected";
  return null;
}

function stageForApplicant(bucketStage: string, applicantStage?: string | null): string {
  const bucketRound = roundKey(bucketStage);
  if (bucketRound) return bucketStage;
  if (roundKey(applicantStage)) return applicantStage ?? bucketStage;
  const bucketCategory = stageCategory(bucketStage);
  const applicantCategory = applicantStage ? stageCategory(applicantStage) : null;
  if (bucketCategory && bucketCategory !== applicantCategory) return bucketStage;
  return applicantStage || bucketStage;
}

function moveApplicantInPipeline(pipeline: Pipeline | undefined, appId: string, stage: string): Pipeline | undefined {
  if (!pipeline) return pipeline;

  let moved: Applicant | null = null;
  const nextPipeline: Record<string, Applicant[]> = {};

  for (const [bucket, applicants] of Object.entries(pipeline.pipeline)) {
    nextPipeline[bucket] = applicants.filter((applicant) => {
      if (applicant.application_id !== appId) return true;
      moved = { ...applicant, current_stage: stage };
      return false;
    });
  }

  if (!moved) return pipeline;

  const targetBucket = Object.keys(nextPipeline).find((bucket) => roundKey(bucket) === roundKey(stage)) ?? stage;
  nextPipeline[targetBucket] = [...(nextPipeline[targetBucket] ?? []), moved];

  return {
    ...pipeline,
    stages: pipeline.stages.includes(stage) ? pipeline.stages : [...pipeline.stages, stage],
    pipeline: nextPipeline,
  };
}

export const Route = createFileRoute("/_authenticated/jobs/$id/pipeline")({
  beforeLoad: () => {
    const to = getRoleRedirect("hr");
    if (to) throw redirect({ to });
  },
  component: JobPipelinePage,
});

function JobPipelinePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: pipeline, isLoading, error } = useQuery({
    queryKey: ["job", id, "pipeline"],
    queryFn: () => api<Pipeline>(`/jobs/${id}/pipeline`),
  });

  const { data: jobMeta } = useQuery({
    queryKey: ["job", id, "meta"],
    queryFn: () => api<JobMeta>(`/jobs/${id}`),
  });

  const [tab, setTab] = useState<Category>("Applied");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);

  const applicantsByStage = useMemo(() => {
    const map: Record<string, Applicant[]> = {};
    if (!pipeline) return map;
    for (const stage of pipeline.stages) {
      map[stage] = [];
    }
    for (const bucketStage of Object.keys(pipeline.pipeline)) {
      for (const a of pipeline.pipeline[bucketStage] || []) {
        const effectiveStage = stageOverrides[a.application_id] ?? stageForApplicant(bucketStage, a.current_stage);
        const targetStage = map[effectiveStage] ? effectiveStage : bucketStage;
        if (map[targetStage]) {
          map[targetStage].push({ ...a, current_stage: targetStage });
        } else {
          map[targetStage] = [{ ...a, current_stage: targetStage }];
        }
      }
    }
    return map;
  }, [pipeline, stageOverrides]);

  const grouped = useMemo(() => {
    const buckets: Record<Category, Applicant[]> = {
      Applied: [], Shortlisted: [], Rounds: [], Offers: [], Rejected: [],
    };
    if (!pipeline) return buckets;
    for (const stage of Object.keys(pipeline.pipeline)) {
      for (const a of pipeline.pipeline[stage] || []) {
        const effectiveStage = stageOverrides[a.application_id] ?? stageForApplicant(stage, a.current_stage);
        const cat = stageCategory(effectiveStage) ?? stageCategory(stage);
        if (!cat) continue;
        buckets[cat].push({ ...a, current_stage: effectiveStage });
      }
    }
    return buckets;
  }, [pipeline, stageOverrides]);

  const roundStages = useMemo(() => {
    const knownStages = [
      ...(pipeline?.stages ?? []),
      ...Object.keys(pipeline?.pipeline ?? {}),
      ...grouped.Rounds.map((applicant) => applicant.current_stage),
    ];
    const fromPipeline = Array.from(
      new Set(
        knownStages
          .map((s) => roundKey(s))
          .filter((s): s is string => !!s),
      ),
    ).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    if (fromPipeline.length > 0) return fromPipeline;
    const n = jobMeta?.rounds ?? 0;
    return Array.from({ length: n }, (_, i) => `L${i + 1}`);
  }, [pipeline, grouped.Rounds, jobMeta]);

  const roundCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of roundStages) map[s] = 0;
    for (const a of grouped.Rounds) {
      const k = roundKey(a.current_stage);
      if (!k) continue;
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [grouped, roundStages]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { Applied: 0, Shortlisted: 0, Rounds: 0, Offers: 0, Rejected: 0 };
    for (const k of CATEGORIES) c[k] = grouped[k].length;
    return c;
  }, [grouped]);

  const moveStage = useMutation({
    mutationFn: ({ appId, stage }: { appId: string; stage: string }) =>
      api(`/applications/${appId}/stage`, { method: "PATCH", body: { stage } }),
    onSuccess: (_d, vars) => {
      setStageOverrides((current) => ({ ...current, [vars.appId]: vars.stage }));
      qc.setQueryData<Pipeline>(["job", id, "pipeline"], (current) =>
        moveApplicantInPipeline(current, vars.appId, vars.stage),
      );
      qc.invalidateQueries({ queryKey: ["job", id, "pipeline"] });
      qc.invalidateQueries({ queryKey: ["job", id, "applications"] });
      toast.success("Stage updated");
      if (selected) setSelected({ ...selected, current_stage: vars.stage });
      const movedRound = roundKey(vars.stage);
      if (movedRound) {
        setTab("Rounds");
        setRoundFilter(movedRound);
      }
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const makeLive = useMutation({
    mutationFn: () => api(`/jobs/${id}/status`, { method: "PATCH", body: { status: "live" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id, "meta"] });
      qc.invalidateQueries({ queryKey: ["jobs", "mine"] });
      toast.success("Job is now live");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const currentList = useMemo(() => {
    const list = grouped[tab];
    if (tab !== "Rounds" || roundFilter === "all") return list;
    return list.filter((a) => roundKey(a.current_stage) === roundFilter);
  }, [grouped, tab, roundFilter]);

  return (
    <div className="space-y-6">
      <div className="app-panel rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Link
            to="/jobs"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-semibold text-foreground truncate">
              {pipeline?.job_title || "Pipeline"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {jobMeta?.company?.name
                ? `${jobMeta.company.name}${jobMeta.department?.name ? ` · ${jobMeta.department.name}` : ""} · `
                 : ""}
              {Object.values(counts).reduce((a, b) => a + b, 0)} candidates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border rounded-lg p-1 bg-secondary/40 shrink-0">
              <div className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 bg-card text-foreground shadow-sm border border-border/10 select-none">
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </div>
              <Link
                to="/jobs/$id/applicants"
                params={{ id }}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <List className="h-3.5 w-3.5" />
                List
              </Link>
            </div>
            {jobMeta?.status === "draft" && (
              <Button onClick={() => makeLive.mutate()} disabled={makeLive.isPending}>
                {makeLive.isPending ? "Publishing..." : "Make Live"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {viewMode === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent min-h-[500px]">
          {(pipeline?.stages ?? []).map((stage) => {
            const applicants = applicantsByStage[stage] || [];
            const isOver = draggedOverStage === stage;
            const cat = stageCategory(stage) || "Applied";
            const meta = CATEGORY_META[cat];

            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setDraggedOverStage(stage)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDraggedOverStage(null);
                  }
                }}
                onDrop={(e) => {
                  const appId = e.dataTransfer.getData("text/plain");
                  if (appId) {
                    moveStage.mutate({ appId, stage });
                  }
                  setDraggedOverStage(null);
                }}
                className={`flex-1 min-w-[280px] max-w-[320px] bg-secondary/30 rounded-xl border flex flex-col h-[600px] transition-all duration-200 ${
                  isOver
                    ? "border-primary bg-primary/[0.03] ring-1 ring-primary/30 shadow-md"
                    : "border-border/50 hover:border-border"
                }`}
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-border/40 flex items-center justify-between bg-card rounded-t-xl shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <span className="text-sm font-semibold text-foreground truncate">{stage}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums bg-secondary text-muted-foreground`}>
                    {applicants.length}
                  </span>
                </div>

                {/* Column Content */}
                <div className="p-3 flex-1 overflow-y-auto space-y-3 scrollbar-none">
                  {applicants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 border-2 border-dashed border-border/30 rounded-lg p-4">
                      <p className="text-xs">Drop candidates here</p>
                    </div>
                  ) : (
                    applicants.map((a) => (
                      <KanbanCard
                        key={a.application_id}
                        a={a}
                        onOpen={() => setSelected(a)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-border overflow-x-auto">
            {CATEGORIES.map((c) => {
              const active = tab === c;
              const meta = CATEGORY_META[c];
              return (
                <button
                  key={c}
                  onClick={() => { setTab(c); if (c !== "Rounds") setRoundFilter("all"); }}
                  className={`group px-4 py-2.5 text-sm border-b-2 -mb-px transition-all whitespace-nowrap flex items-center gap-2 ${
                    active
                      ? `border-primary text-foreground`
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${active ? "opacity-100" : "opacity-50 group-hover:opacity-80"}`} />
                  {c}
                  <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                    active ? `bg-primary/15 ${meta.accent}` : "bg-secondary text-muted-foreground"
                  }`}>
                    {counts[c]}
                  </span>
                </button>
              );
            })}
          </div>

          {tab === "Rounds" && roundStages.length > 0 && (
            <div className="app-panel flex flex-wrap gap-2 rounded-lg p-3">
              <RoundPill
                label="All rounds"
                count={grouped.Rounds.length}
                active={roundFilter === "all"}
                onClick={() => setRoundFilter("all")}
              />
              {roundStages.map((s) => (
                <RoundPill
                  key={s}
                  label={s}
                  count={roundCounts[s] ?? 0}
                  active={roundFilter === s}
                  onClick={() => setRoundFilter(s)}
                />
              ))}
            </div>
          )}

          {currentList.length === 0 ? (
            <div className="app-panel rounded-lg border-dashed p-10 text-center">
              <div className={`mx-auto h-10 w-10 rounded-full ${CATEGORY_META[tab].dot} opacity-20 mb-3`} />
              <div className="text-sm text-muted-foreground">
                No candidates in <span className="text-foreground font-medium">{tab}</span>
                {tab === "Rounds" && roundFilter !== "all" ? ` · ${roundFilter}` : ""}.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {currentList.map((a) => (
                <CandidateCard
                  key={a.application_id}
                  a={a}
                  onOpen={() => setSelected(a)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <CandidateDetail
              a={selected}
              stages={pipeline?.stages ?? []}
              onMove={(stage) =>
                moveStage.mutate({ appId: selected.application_id, stage })
              }
              moving={moveStage.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CandidateCard({ a, onOpen }: { a: Applicant; onOpen: () => void }) {
  return CandidateCardInner({ a, onOpen });
}

function KanbanCard({ a, onOpen }: { a: Applicant; onOpen: () => void }) {
  const skills = (a.skills ?? []).slice(0, 3);
  const cat = stageCategory(a.current_stage);
  const meta = cat ? CATEGORY_META[cat] : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", a.application_id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className="app-panel app-panel-hover group relative cursor-grab active:cursor-grabbing rounded-lg p-3.5 border border-border/60 hover:border-border transition-all select-none bg-card shadow-sm"
    >
      {meta && (
        <span className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r ${meta.dot} opacity-60 group-hover:opacity-100 transition-opacity`} />
      )}
      <div className="space-y-2">
        <div className="min-w-0">
          <div className="text-foreground font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {a.name}
          </div>
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
            {a.email}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[10px]">JD Match</span>
            <MatchBadge value={a.compatibility_score} />
          </div>
          <div className="font-semibold text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded text-[10px]">
            ATS {a.ats_score}%
          </div>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {skills.map((s) => (
              <span
                key={s}
                className="rounded bg-secondary text-[9px] text-foreground px-1.5 py-0.5 font-medium border border-border/30 truncate max-w-[80px]"
              >
                {s}
              </span>
            ))}
          </div>
         )}
      </div>
    </div>
  );
}

function RoundPill({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
        active
          ? "bg-primary/15 text-primary border border-primary/40"
          : "bg-secondary text-muted-foreground hover:text-foreground border border-transparent"
      }`}
    >
      {label}
      <span className="ml-2 opacity-70">{count}</span>
    </button>
  );
}

function CandidateCardInner({ a, onOpen }: { a: Applicant; onOpen: () => void }) {
  const skills = (a.skills ?? []).slice(0, 5);
  const cat = stageCategory(a.current_stage);
  const meta = cat ? CATEGORY_META[cat] : null;
  return (
    <div
      onClick={onOpen}
      className="app-panel app-panel-hover group relative cursor-pointer rounded-lg p-4 transition-all"
    >
      {meta && (
        <span className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-r ${meta.dot} opacity-60 group-hover:opacity-100 transition-opacity`} />
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-foreground font-medium truncate">{a.name}</div>
          <div className="text-xs text-muted-foreground truncate">{a.email}</div>
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="rounded-md border border-border bg-secondary/70 px-2 py-0.5 text-xs text-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">JD Match</span>
            <MatchBadge value={a.compatibility_score} />
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary ${meta?.accent ?? "text-muted-foreground"}`}>
            {meta && <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
            {a.current_stage}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="text-xs text-primary hover:underline"
          >
            View Profile →
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateDetail({
  a, stages, onMove, moving,
}: {
  a: Applicant;
  stages: string[];
  onMove: (stage: string) => void;
  moving: boolean;
}) {
  const [stage, setStage] = useState(a.current_stage);
  const ins = a.insights ?? {};
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-foreground">{a.name}</SheetTitle>
        <div className="text-sm text-muted-foreground">{a.email}</div>
      </SheetHeader>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatBox label="ATS Score">
          <ScoreBadge score={a.ats_score} />
        </StatBox>
        <StatBox label="JD Match">
          <MatchBadge value={a.compatibility_score} />
        </StatBox>
        <StatBox label="Stage">
          <span className="text-sm text-foreground">{a.current_stage}</span>
        </StatBox>
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
          onClick={() => {
            const token = getToken();
            const url = `${getApiBase()}/applications/${a.application_id}/resume?token=${token}`;
            window.open(url, "_blank");
          }}
        >
          <FileText className="h-4 w-4" />
          View Original Resume
        </Button>
      </div>

      <Tabs defaultValue="insights" className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-6 mt-4">
          {a.summary && (
            <Section title="AI Recruiter Summary">
              <p className="text-sm text-foreground leading-relaxed">{a.summary}</p>
            </Section>
          )}

          <Section title="Career Insights">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Total experience" value={ins.total_experience_years != null ? `${ins.total_experience_years} yrs` : "—"} />
              <Info label="Current status" value={ins.current_status ?? "—"} />
              <Info label="Avg tenure" value={ins.avg_tenure_months != null ? `${ins.avg_tenure_months} mo` : "—"} />
              <Info label="Job switches" value={ins.job_switches != null ? String(ins.job_switches) : "—"} />
            </div>
          </Section>

          {ins.jobs && ins.jobs.length > 0 && (
            <Section title="Work History">
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Company</th>
                      <th className="text-left px-3 py-2 font-medium">Role</th>
                      <th className="text-left px-3 py-2 font-medium">Dates</th>
                      <th className="text-left px-3 py-2 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ins.jobs.map((j, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{j.company ?? "—"}</td>
                        <td className="px-3 py-2 text-foreground">{j.role ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {j.start ?? ""}{j.end ? ` – ${j.end}` : ""}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {j.duration_months != null ? `${j.duration_months} mo` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {ins.education && ins.education.length > 0 && (
            <Section title="Education">
              <ul className="space-y-2">
                {ins.education.map((e, i) => (
                  <li key={i} className="text-sm">
                    <div className="text-foreground">{e.degree ?? "Degree"}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.college ?? ""}{e.duration ? ` · ${e.duration}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {ins.employment_gaps && ins.employment_gaps.length > 0 && (
            <Section title="Employment Gaps">
              <ul className="space-y-1.5">
                {ins.employment_gaps.map((g, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {g.gap_months != null ? `${g.gap_months} months` : g.duration ?? "Gap"}
                    {g.between ? <span className="text-muted-foreground"> · {g.between}</span> : null}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {ins.red_flags && ins.red_flags.length > 0 && (
            <Section title="Red Flags">
              <div className="flex flex-wrap gap-1.5">
                {ins.red_flags.map((f, i) => (
                  <span key={i} className="rounded-md bg-danger/15 px-2 py-1 text-xs text-danger">
                    {f}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="questions" className="space-y-6 mt-4">
          <Section title="AI Screening Questions">
            <div className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-secondary/40 rounded-lg p-4 border border-border/50 font-sans">
              {ins.questions || "No screening questions available for this candidate."}
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      <div className="mt-8 pt-6 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Move stage</div>
        <div className="flex gap-2">
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select stage" /></SelectTrigger>
            <SelectContent>
              {(stages.length > 0 ? stages : [a.current_stage]).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => { if (stage && stage !== a.current_stage) onMove(stage); }}
            disabled={moving || stage === a.current_stage}
          >
            Move
          </Button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

function StatBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-secondary rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}