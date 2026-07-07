import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from "structura";

export function Open() {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline">Add component</Button>
        </TooltipTrigger>
        <TooltipContent>Insert a new component (⌘K)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
