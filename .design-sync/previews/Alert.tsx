import { Alert, AlertTitle, AlertDescription } from "structura";

export function Default() {
  return (
    <Alert style={{ maxWidth: 420 }}>
      <AlertTitle>Changes saved</AlertTitle>
      <AlertDescription>Your diagram was saved to this workspace a moment ago.</AlertDescription>
    </Alert>
  );
}

export function Destructive() {
  return (
    <Alert variant="destructive" style={{ maxWidth: 420 }}>
      <AlertTitle>Couldn’t save changes</AlertTitle>
      <AlertDescription>
        We hit a problem saving your diagram. Check your connection and try again.
      </AlertDescription>
    </Alert>
  );
}
