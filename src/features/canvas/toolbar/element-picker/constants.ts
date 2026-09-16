import {
  AWS_FAMILY_PRIMARY_CATEGORY_IDS,
  AWS_FAMILY_SPOTLIGHT_SERVICE_IDS,
} from "@/features/elements/families/aws/aws.family";

export const LAST_CATEGORY_KEY = "structura:lastElementCategory";

/** Spotlight services — owned by the AWS family; re-exported for picker call sites. */
export const AWS_SPOTLIGHT_IDS: string[] = [...AWS_FAMILY_SPOTLIGHT_SERVICE_IDS];

export const REGISTRY_PREVIEW_LIMIT = 5;

/** Primary browse categories — owned by the AWS family. */
export const AWS_PRIMARY_CATEGORY_IDS: string[] = [...AWS_FAMILY_PRIMARY_CATEGORY_IDS];

export const OTHER_AWS_SECTION_KEY = "__aws_other__";

export const PICKER_CARD_CLASS =
  "flex flex-col items-center justify-center rounded-xl border border-border/40 bg-muted/50 p-3 transition-colors hover:bg-muted text-center min-h-[104px]";
