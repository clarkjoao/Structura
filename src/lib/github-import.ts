export interface GitHubImportResult {
  name: string;
  description: string;
  technology: string[];
  repositoryUrl: string;
}

function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function fetchRawFile(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `token ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractNodeTech(pkg: Record<string, unknown>): string[] {
  const tech = new Set<string>();
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };

  const mapping: Record<string, string> = {
    react: "React",
    next: "Next.js",
    express: "Express",
    fastify: "Fastify",
    nestjs: "NestJS",
    "@nestjs/core": "NestJS",
    typescript: "TypeScript",
    prisma: "Prisma",
    "@prisma/client": "Prisma",
    mongoose: "MongoDB",
    pg: "PostgreSQL",
    redis: "Redis",
    ioredis: "Redis",
    graphql: "GraphQL",
    "@apollo/server": "Apollo GraphQL",
    tailwindcss: "Tailwind CSS",
    vue: "Vue.js",
    angular: "Angular",
    "@angular/core": "Angular",
    svelte: "Svelte",
  };

  for (const dep of Object.keys(deps)) {
    if (mapping[dep]) tech.add(mapping[dep]);
  }

  if (Object.keys(deps).length > 0 && tech.size === 0) {
    tech.add("Node.js");
  }

  return Array.from(tech);
}

function extractMavenTech(pomXml: string): string[] {
  const tech = new Set<string>(["Java"]);

  if (pomXml.includes("spring-boot")) tech.add("Spring Boot");
  if (pomXml.includes("spring-webflux")) tech.add("Spring WebFlux");
  if (pomXml.includes("spring-data-jpa")) tech.add("JPA");
  if (pomXml.includes("postgresql")) tech.add("PostgreSQL");
  if (pomXml.includes("mysql")) tech.add("MySQL");
  if (pomXml.includes("mongodb")) tech.add("MongoDB");
  if (pomXml.includes("redis")) tech.add("Redis");
  if (pomXml.includes("kafka")) tech.add("Kafka");
  if (pomXml.includes("graphql")) tech.add("GraphQL");
  if (pomXml.includes("quarkus")) tech.add("Quarkus");

  return Array.from(tech);
}

export async function importFromGitHub(
  repoUrl: string,
  token?: string,
): Promise<GitHubImportResult> {
  const parsed = parseOwnerRepo(repoUrl);
  if (!parsed) {
    throw new Error("URL inválida. Use: https://github.com/owner/repo");
  }

  const { owner, repo } = parsed;
  let name = repo;
  let description = "";
  let technology: string[] = [];

  const pkgJson = await fetchRawFile(owner, repo, "package.json", token);
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson) as Record<string, unknown>;
      name = (pkg.name as string) ?? repo;
      description = (pkg.description as string) ?? "";
      technology = extractNodeTech(pkg);
    } catch {
      technology = ["Node.js"];
    }
  } else {
    const pomXml = await fetchRawFile(owner, repo, "pom.xml", token);
    if (pomXml) {
      technology = extractMavenTech(pomXml);
      const nameMatch = pomXml.match(/<artifactId>([^<]+)<\/artifactId>/);
      if (nameMatch) name = nameMatch[1];
      const descMatch = pomXml.match(/<description>([^<]+)<\/description>/);
      if (descMatch) description = descMatch[1];
    }
  }

  if (technology.length === 0) {
    const goMod = await fetchRawFile(owner, repo, "go.mod", token);
    if (goMod) technology = ["Go"];
  }

  if (technology.length === 0) {
    const cargo = await fetchRawFile(owner, repo, "Cargo.toml", token);
    if (cargo) technology = ["Rust"];
  }

  return {
    name,
    description,
    technology,
    repositoryUrl: repoUrl.replace(/\.git$/, ""),
  };
}
