import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpDown, FileText, ArrowRightLeft } from "lucide-react";
import { api, getRoleRedirect, getToken, getApiBase } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge, MatchBadge } from "@/components/StatusBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const [selected, setSelected] = useState<Applicant | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [newStage, setNewStage] = useState<string>("");
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id, "applications"] });
      qc.invalidateQueries({ queryKey: ["job", id, "pipeline"] });
      toast.success("Stage updated");
      setSelected(null);
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
        <Link
          to="/jobs/$id/pipeline"
          params={{ id }}
          className="text-sm text-primary hover:underline"
        >
          Open pipeline →
        </Link>
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
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-muted-foreground">
                        {a.current_stage}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Screening Questions</div>
                    <div className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-secondary/40 rounded-lg p-4 border border-border/50 font-sans">
                      {selected.insights?.questions || "No screening questions available for this candidate."}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

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