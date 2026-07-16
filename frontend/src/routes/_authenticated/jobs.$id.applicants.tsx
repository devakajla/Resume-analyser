import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpDown, FileText, ArrowRightLeft, LayoutGrid, List, Search } from "lucide-react";
import { api, getRoleRedirect, getToken, getApiBase } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge, MatchBadge } from "@/components/StatusBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

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
    red_flags?: string[];
    questions?: string;
  };
  summary?: string;
  isSuggestion?: boolean;
};

type Pipeline = {
  job_title: string;
  stages: string[];
  counts: Record<string, number>;
  company?: { id: string; name: string };
  department?: { id: string; name: string };
};

export const Route = createFileRoute("/_authenticated/jobs/$id/applicants")({
  beforeLoad: () => {
    const to = getRoleRedirect("hr");
    if (to) throw redirect({ to });
  },
  component: JobApplicantsPage,
});

function JobApplicantsPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["job", id, "applications"],
    queryFn: () => api<{ applicants: Applicant[] }>(`/jobs/${id}/applications`),
  });
  const { data: pipeline } = useQuery({
    queryKey: ["job", id, "pipeline"],
    queryFn: () => api<Pipeline>(`/jobs/${id}/pipeline`),
  });

  type JobDetail = {
    id: string;
    title: string;
    skills?: string[];
  };

  const { data: jobDetail } = useQuery({
    queryKey: ["job", id, "detail"],
    queryFn: () => api<JobDetail>(`/jobs/${id}`),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchParam, setSearchParam] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const { data: suggestionsData, isFetching: searching } = useQuery({
    queryKey: ["job", id, "suggestions", searchParam],
    queryFn: () => api<{ suggestions: any[] }>(`/jobs/${id}/db-suggestions?q=${encodeURIComponent(searchParam)}`),
    enabled: hasSearched && !!searchParam,
  });

  const [selected, setSelected] = useState<Applicant | null>(null);
  const [newStage, setNewStage] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: tailoredData, isLoading: loadingTailored } = useQuery({
    queryKey: ["tailored-insights", selected?.application_id, id],
    queryFn: () => api<{ summary: string; questions: string; skills: string[] }>(
      `/applications/${selected?.application_id}/job/${id}/tailored-insights`
    ),
    enabled: !!selected && !!selected.isSuggestion,
  });
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const handleToggleSelect = (appId: string, checked: boolean) => {
    if (checked) {
      if (selectedCompareIds.length >= 3) {
        toast.error("You can compare a maximum of 3 candidates.");
        return;
      }
      setSelectedCompareIds([...selectedCompareIds, appId]);
    } else {
      setSelectedCompareIds(selectedCompareIds.filter((x) => x !== appId));
    }
  };

  const comparedApplicants = useMemo(() => {
    return (data?.applicants ?? []).filter((a) => selectedCompareIds.includes(a.application_id));
  }, [data, selectedCompareIds]);

  const applicants = useMemo(() => {
    const list = (data?.applicants ?? []).slice();
    list.sort((a, b) =>
      sortDir === "desc"
        ? b.compatibility_score - a.compatibility_score
        : a.compatibility_score - b.compatibility_score,
    );
    return list;
  }, [data, sortDir]);

  const moveStage = useMutation({
    mutationFn: ({ appId, stage }: { appId: string; stage: string }) =>
      api(`/applications/${appId}/stage`, { method: "PATCH", body: { stage } }),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["job", id, "applications"] });
      qc.invalidateQueries({ queryKey: ["job", id, "pipeline"] });
      toast.success("Stage updated");
      setSelected((prev) => (prev && prev.application_id === vars.appId ? null : prev));
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/jobs" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {pipeline?.job_title || "Applicants"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pipeline?.company?.name
              ? `${pipeline.company.name}${pipeline.department?.name ? ` · ${pipeline.department.name}` : ""} · `
              : ""}
            {applicants.length} applicants
          </p>
        </div>
        <div className="flex items-center border border-border rounded-lg p-1 bg-secondary/40 shrink-0">
          <Link
            to="/jobs/$id/pipeline"
            params={{ id }}
            className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </Link>
          <div className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 bg-card text-foreground shadow-sm border border-border/10 select-none">
            <List className="h-3.5 w-3.5" />
            List
          </div>
        </div>
      </div>

      <div className="app-panel overflow-hidden rounded-lg">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-danger">Failed to load applicants.</div>
        ) : applicants.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No applicants yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium w-[50px] text-center">Select</th>
                <th className="px-6 py-3 font-medium">Candidate</th>
                <th className="px-6 py-3 font-medium">ATS score</th>
                <th className="px-6 py-3 font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortDir(sortDir === "desc" ? "asc" : "desc");
                    }}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Match <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-6 py-3 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => {
                const isSelectedForCompare = selectedCompareIds.includes(a.application_id);
                return (
                  <tr
                    key={a.application_id}
                    onClick={() => { setSelected(a); setNewStage(a.current_stage); }}
                    className={`cursor-pointer border-t border-border transition-colors hover:bg-secondary ${
                      isSelectedForCompare ? "bg-primary/[0.02]" : ""
                    }`}
                  >
                    <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelectedForCompare}
                        onChange={(e) => handleToggleSelect(a.application_id, e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-3 text-foreground font-medium">{a.name}</td>
                    <td className="px-6 py-3"><ScoreBadge score={a.ats_score} /></td>
                    <td className="px-6 py-3"><MatchBadge value={a.compatibility_score} /></td>
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={a.current_stage}
                        onValueChange={(val) => {
                          moveStage.mutate({ appId: a.application_id, stage: val });
                        }}
                        disabled={moveStage.isPending}
                      >
                        <SelectTrigger className="w-[130px] h-8 bg-secondary/80 border-border/50 text-xs font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {(pipeline?.stages ?? [a.current_stage]).map((stg) => (
                            <SelectItem key={stg} value={stg}>
                              {stg}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Dynamic Talent Pool Search (Vector Match) */}
      <div className="space-y-4 mt-8 pt-6 border-t border-border">
        <div>
          <h2 className="text-lg font-semibold text-foreground font-display">Talent Pool Search</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Search your entire repository of candidates using natural language (powered by Pinecone vector index).
          </p>
        </div>

        {/* The Search Bar (Rounded & Long) */}
        <div className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Type skills or profile requirements (e.g. React Developer with SQL)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  setSearchParam(searchQuery.trim());
                  setHasSearched(true);
                }
              }}
              className="pl-9 rounded-full bg-secondary/30 border-border/80 text-sm h-9"
            />
          </div>
          <Button
            onClick={() => {
              if (searchQuery.trim()) {
                setSearchParam(searchQuery.trim());
                setHasSearched(true);
              }
            }}
            disabled={searching || !searchQuery.trim()}
            className="rounded-full h-9 text-xs font-semibold px-5"
          >
            {searching ? "Searching..." : "Search Pool"}
          </Button>
        </div>

        {/* Quick Prompts (Tags list) */}
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <span className="text-muted-foreground font-medium mr-1">Quick Prompts:</span>
          {["Python & ML", "React Frontend", "QA Automation", "Business Analyst", "Finance Specialist"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setSearchQuery(p);
                setSearchParam(p);
                setHasSearched(true);
              }}
              className="px-3 py-1 rounded-full border border-border bg-secondary/20 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all font-medium"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Search Results Display */}
        {searching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : hasSearched ? (
          suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {suggestionsData.suggestions.map((s, idx) => (
                <div
                  key={s.application_id}
                  onClick={() => {
                    setSelected({
                      application_id: s.application_id,
                      name: s.name,
                      email: s.email,
                      ats_score: s.ats_score,
                      compatibility_score: s.compatibility_score,
                      current_stage: s.current_stage,
                      skills: s.skills,
                      summary: s.summary,
                      insights: s.insights,
                      isSuggestion: true
                    });
                    setNewStage(s.current_stage);
                  }}
                  className="app-panel p-4 rounded-lg cursor-pointer flex items-center justify-between hover:bg-secondary/40 hover:border-primary/30 border border-border/80 transition-all shadow-sm select-none"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-foreground text-sm truncate">{s.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{s.email}</div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/80">
                      Original Job: {s.original_job_title}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
                    <div className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                      View Profile →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="app-panel border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground mt-4">
              No matching candidates found in the talent pool for "{searchParam}".
            </div>
          )
        ) : null}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground">{selected.name}</SheetTitle>
                <div className="text-sm text-muted-foreground">{selected.email}</div>
              </SheetHeader>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <StatBox label="ATS score" value={Math.round(selected.ats_score)} />
                <StatBox label="Match" value={`${Math.round(selected.compatibility_score * 100)}%`} />
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => {
                    const token = getToken();
                    const url = `${getApiBase()}/applications/${selected.application_id}/resume?token=${token}`;
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
                  {selected.isSuggestion ? (
                    loadingTailored ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      </div>
                    ) : (
                      <>
                        {tailoredData?.summary && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tailored AI Summary</div>
                            <p className="mt-2 text-sm text-foreground leading-relaxed">{tailoredData.summary}</p>
                          </div>
                        )}

                        {tailoredData?.skills && tailoredData.skills.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skills</div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {tailoredData.skills.map((s) => (
                                <span key={s} className="text-xs px-2 py-1 rounded-md bg-secondary text-foreground">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      {selected.summary && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Summary</div>
                          <p className="mt-2 text-sm text-foreground leading-relaxed">{selected.summary}</p>
                        </div>
                      )}

                      {selected.skills && selected.skills.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skills</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selected.skills.map((s) => (
                              <span key={s} className="text-xs px-2 py-1 rounded-md bg-secondary text-foreground">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {selected.insights && (
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Insights</div>
                      {selected.insights.total_experience_years !== undefined && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Experience: </span>
                          <span className="text-foreground">{selected.insights.total_experience_years} years</span>
                        </div>
                      )}
                      {selected.insights.current_status && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Status: </span>
                          <span className="text-foreground">{selected.insights.current_status}</span>
                        </div>
                      )}
                      {selected.insights.red_flags && selected.insights.red_flags.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1.5">Red flags</div>
                          <div className="flex flex-wrap gap-1.5">
                            {selected.insights.red_flags.map((f, i) => (
                              <span key={i} className="rounded-md bg-warning/15 px-2 py-1 text-xs text-warning">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="questions" className="space-y-6 mt-4">
                  {selected.isSuggestion ? (
                    loadingTailored ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tailored AI Screening Questions</div>
                        <div className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-secondary/40 rounded-lg p-4 border border-border/50 font-sans">
                          {tailoredData?.questions || "No tailored screening questions available for this candidate."}
                        </div>
                      </div>
                    )
                  ) : (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Screening Questions</div>
                      <div className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-secondary/40 rounded-lg p-4 border border-border/50 font-sans">
                        {selected.insights?.questions || "No screening questions available for this candidate."}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {selected.isSuggestion ? (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="rounded-xl bg-primary/[0.04] border border-primary/20 p-4 flex flex-col items-center text-center gap-2">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Suggested from Talent Pool</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This candidate originally applied to another role and is not currently in the active hiring pipeline of this job.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Move stage</div>
                  <div className="flex gap-2">
                    <Select value={newStage} onValueChange={setNewStage}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select stage" /></SelectTrigger>
                      <SelectContent>
                        {(pipeline?.stages ?? [selected.current_stage]).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => {
                        if (!newStage || newStage === selected.current_stage) return;
                        moveStage.mutate({ appId: selected.application_id, stage: newStage });
                      }}
                      disabled={moveStage.isPending}
                    >
                      Move
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Floating Bottom Compare Banner */}
      {selectedCompareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border/80 rounded-xl shadow-2xl p-4 flex items-center justify-between gap-6 z-40 animate-in slide-in-from-bottom duration-300 w-[90%] max-w-lg">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              {selectedCompareIds.length} candidate{selectedCompareIds.length > 1 ? "s" : ""} selected
            </span>
            <span className="text-xs text-muted-foreground">
              Select 2 or 3 candidates to compare side-by-side
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCompareIds([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
            <Button
              size="sm"
              disabled={selectedCompareIds.length < 2}
              onClick={() => setCompareOpen(true)}
              className="text-xs flex items-center gap-1.5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Compare
            </Button>
          </div>
        </div>
      )}

      {/* Comparison Matrix Dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl bg-card border-border overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display font-semibold">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Candidate Comparison Matrix
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 border border-border rounded-xl overflow-hidden bg-card">
            <div className="grid grid-cols-4 border-b border-border bg-secondary/35 shrink-0 text-sm font-semibold text-foreground">
              <div className="p-4 border-r border-border flex items-center">Feature</div>
              {comparedApplicants.map((a) => (
                <div key={a.application_id} className="p-4 border-r border-border last:border-r-0 min-w-0">
                  <div className="truncate font-semibold text-base">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground font-normal mt-0.5">{a.email}</div>
                </div>
              ))}
              {comparedApplicants.length === 2 && (
                <div className="p-4 text-muted-foreground/45 flex items-center justify-center italic text-xs font-normal">
                  Select a 3rd candidate to compare
                </div>
              )}
            </div>

            <div className="divide-y divide-border text-sm">
              {/* ATS Score Row */}
              <div className="grid grid-cols-4">
                <div className="p-4 border-r border-border font-medium bg-secondary/15 text-muted-foreground">ATS Score</div>
                {comparedApplicants.map((a) => (
                  <div key={a.application_id} className="p-4 border-r border-border last:border-r-0 flex items-center">
                    <ScoreBadge score={a.ats_score} />
                  </div>
                ))}
                {comparedApplicants.length === 2 && <div className="p-4" />}
              </div>

              {/* JD Match Score Row */}
              <div className="grid grid-cols-4">
                <div className="p-4 border-r border-border font-medium bg-secondary/15 text-muted-foreground">JD Match Score</div>
                {comparedApplicants.map((a) => (
                  <div key={a.application_id} className="p-4 border-r border-border last:border-r-0 flex items-center">
                    <MatchBadge value={a.compatibility_score} />
                  </div>
                ))}
                {comparedApplicants.length === 2 && <div className="p-4" />}
              </div>

              {/* Total Experience Row */}
              <div className="grid grid-cols-4">
                <div className="p-4 border-r border-border font-medium bg-secondary/15 text-muted-foreground">Experience</div>
                {comparedApplicants.map((a) => (
                  <div key={a.application_id} className="p-4 border-r border-border last:border-r-0 flex items-center text-foreground font-semibold">
                    {a.insights?.total_experience_years != null ? `${a.insights.total_experience_years} years` : "—"}
                  </div>
                ))}
                {comparedApplicants.length === 2 && <div className="p-4" />}
              </div>

              {/* Current Status/Stage Row */}
              <div className="grid grid-cols-4">
                <div className="p-4 border-r border-border font-medium bg-secondary/15 text-muted-foreground">Current Stage</div>
                {comparedApplicants.map((a) => (
                  <div key={a.application_id} className="p-4 border-r border-border last:border-r-0 flex items-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground">
                      {a.current_stage}
                    </span>
                  </div>
                ))}
                {comparedApplicants.length === 2 && <div className="p-4" />}
              </div>

              {/* Matching Required Skills Row */}
              <div className="grid grid-cols-4">
                <div className="p-4 border-r border-border font-medium bg-secondary/15 text-muted-foreground">Matching Skills</div>
                {comparedApplicants.map((a) => {
                  const candidateSkills = a.skills ?? [];
                  const matchingSkills = candidateSkills.filter(s =>
                    (jobDetail?.skills ?? []).some(js => js.toLowerCase() === s.toLowerCase())
                  );
                  return (
                    <div key={a.application_id} className="p-4 border-r border-border last:border-r-0">
                      {matchingSkills.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">None matching</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {matchingSkills.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success/15 text-success border border-success/20">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {comparedApplicants.length === 2 && <div className="p-4" />}
              </div>

              {/* All Skills Row */}
              <div className="grid grid-cols-4">
                <div className="p-4 border-r border-border font-medium bg-secondary/15 text-muted-foreground">Candidate Skills</div>
                {comparedApplicants.map((a) => (
                  <div key={a.application_id} className="p-4 border-r border-border last:border-r-0">
                    {(a.skills ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">No skills listed</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto scrollbar-none">
                        {(a.skills ?? []).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {comparedApplicants.length === 2 && <div className="p-4" />}
              </div>

              {/* Red Flags Row */}
              <div className="grid grid-cols-4">
                <div className="p-4 border-r border-border font-medium bg-secondary/15 text-muted-foreground">Red Flags</div>
                {comparedApplicants.map((a) => {
                  const flags = a.insights?.red_flags ?? [];
                  return (
                    <div key={a.application_id} className="p-4 border-r border-border last:border-r-0">
                      {flags.length === 0 ? (
                        <span className="text-xs text-success font-semibold">None detected</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-danger/15 text-danger border border-danger/20">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {comparedApplicants.length === 2 && <div className="p-4" />}
               </div>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary rounded-lg p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}