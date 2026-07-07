import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "structura";

export function Open() {
  return (
    <Dialog defaultOpen modal={false}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ position: "static", transform: "none" }}
      >
        <DialogHeader>
          <DialogTitle>Delete diagram</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This permanently deletes the diagram and its history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
