import { cloudRegistry } from "./registry/cloud.registry";
import { awsProvider } from "./providers/aws/aws.provider";
import { gcpProvider } from "./providers/gcp/gcp.provider";
import { azureProvider } from "./providers/azure/azure.provider";

cloudRegistry.register(awsProvider).register(gcpProvider).register(azureProvider);
