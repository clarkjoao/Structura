import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from "structura";

export function Default() {
  return (
    <Card style={{ maxWidth: 360 }}>
      <CardHeader>
        <CardTitle>Deploy project</CardTitle>
        <CardDescription>Push the current diagram to your team workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", margin: 0 }}>
          12 components and 8 connections will be shared with 4 collaborators.
        </p>
      </CardContent>
      <CardFooter style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost">Cancel</Button>
        <Button>Deploy</Button>
      </CardFooter>
    </Card>
  );
}

export function Stat() {
  return (
    <Card style={{ maxWidth: 240 }}>
      <CardHeader>
        <CardDescription>Total diagrams</CardDescription>
        <CardTitle style={{ fontSize: 30 }}>1,284</CardTitle>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", margin: 0 }}>
          +12.5% from last month
        </p>
      </CardContent>
    </Card>
  );
}
