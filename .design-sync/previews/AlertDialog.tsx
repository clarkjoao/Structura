import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "structura";

export function Open() {
  return (
    <AlertDialog defaultOpen>
      <AlertDialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ position: "static", transform: "none" }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the workspace and all of its diagrams. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
