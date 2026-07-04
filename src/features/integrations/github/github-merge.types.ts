export interface MergeResolution {
  existingServiceId: string;
  fields: {
    name: "github" | "existing";
    description: "github" | "existing";
    technology: "github" | "existing" | "merge";
    tags: "github" | "existing" | "merge";
  };
}
