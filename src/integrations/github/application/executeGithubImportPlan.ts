import type { GithubRepo } from "../github.types";
import type { MergeResolution } from "../github-merge.types";
import type { GithubImportPlan } from "./buildGithubImportPlan";
import { commitGithubImport } from "../github.service";

interface ExecuteGithubImportPlanParams {
  selectedRepos: GithubRepo[];
  plan: GithubImportPlan;
  userResolutions?: MergeResolution[];
  addService: Parameters<typeof commitGithubImport>[0]["addService"];
  updateService: Parameters<typeof commitGithubImport>[0]["updateService"];
}

export async function executeGithubImportPlan({
  selectedRepos,
  plan,
  userResolutions = [],
  addService,
  updateService,
}: ExecuteGithubImportPlanParams): Promise<void> {
  await commitGithubImport({
    selectedRepos,
    conflictsForImport: plan.conflictsForImport,
    resolutions: [...plan.autoResolutions, ...userResolutions],
    addService,
    updateService,
  });
}
