import { Tabs, TabsList, TabsTrigger, TabsContent } from "structura";

export function Default() {
  return (
    <Tabs defaultValue="overview" style={{ maxWidth: 420 }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))" }}>
          A high-level view of the system and its external dependencies.
        </p>
      </TabsContent>
      <TabsContent value="connections">
        <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))" }}>
          8 connections across 12 components.
        </p>
      </TabsContent>
    </Tabs>
  );
}
