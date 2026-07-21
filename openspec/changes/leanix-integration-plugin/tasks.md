# Leanix Integration Plugin — Implementation Tasks

## 1. Server Proxy Setup

- [x] 1.1 Add Leanix environment variables to `server/src/config.ts`:
  - `LEANIX_URL = process.env.PROXY_REVERSE_LEANIX_URL ?? ""`
  - `LEANIX_API_TOKEN = process.env.PROXY_REVERSE_LEANIX_API_TOKEN`

- [x] 1.2 Add Leanix proxy route in `server/src/proxy.ts`:
  - Create proxy route `/leanix` pointing to `LEANIX_URL`
  - Configure `fallbackAuth: LEANIX_API_TOKEN` if provided
  - Set `authScheme: "Bearer"`

- [x] 1.3 Register the proxy router in `server/src/index.ts`

## 2. Plugin Structure Setup

- [x] 2.1 Create `plugins/structura-plugin-leanix/` directory structure:
  ```
  plugins/structura-plugin-leanix/
    package.json
    vite.config.js
    tsconfig.json
    manifest.json
    src/
      index.tsx
      types/
        config.ts
        api.ts
      hooks/
        useLeanixConfig.ts
        usePluginApi.ts
      components/
        LeanixToolbarButton.tsx
        LeanixConfigModal.tsx
      services/
        leanix.service.ts
      i18n/
        labels.ts
  ```

- [x] 2.2 Create `manifest.json`:
  ```json
  {
    "id": "structura-plugin-leanix",
    "name": "Leanix Integration",
    "version": "1.0.0",
    "author": "Structura",
    "description": "Export diagrams to Leanix ITSM",
    "apiVersion": "^1.1",
    "capabilities": ["network", "ui:panels", "ui:overlays", "diagram:read"],
    "uses": ["react"]
  }
  ```

- [x] 2.3 Configure Vite for plugin compilation (following `structura-plugin-example-ui` pattern)

## 3. TypeScript Types

- [x] 3.1 Define `LeanixConfig` interface in `types/config.ts`:
  ```typescript
  interface LeanixConfig {
    baseUrl: string;
    authToken: string;
    userId: string;
  }
  ```

- [x] 3.2 Define Leanix API response types in `types/api.ts`:
  - `LeanixDiagramSearchResponse`
  - `LeanixBookmark`
  - `LeanixDiagramState`

## 4. Plugin API Hook

- [x] 4.1 Create `hooks/usePluginApi.ts` following `structura-plugin-example-ui` pattern:
  - Export `showToast` and `openModal` wrappers
  - Export `getReact()` helper

- [x] 4.2 Create `hooks/useLeanixConfig.ts`:
  - Use `api.storage.get/set/remove` for config persistence
  - State: `LeanixConfig | null`
  - Methods: `saveConfig()`, `clearConfig()`, `isConfigured`

## 5. Leanix API Service

- [x] 5.1 Create `services/leanix.service.ts` with functions:
  - `searchDiagrams(name: string): Promise<LeanixBookmark[]>`
  - `createDiagram(name: string, graphXml: string, userId: string): Promise<LeanixBookmark>`
  - `updateWorkingCopy(id: string, graphXml: string): Promise<void>`
  - `saveDiagram(id: string, graphXml: string): Promise<LeanixBookmark>`

- [x] 5.2 Implement `buildHeaders()` helper for Authorization header

- [x] 5.3 Implement `request()` helper with error handling:
  - Check response.ok
  - Throw on 401/403/500
  - Return null for 204
  - Return parsed JSON otherwise

- [x] 5.4 Implement retry logic for network errors (1 retry)

## 6. Toolbar Button Component

- [x] 6.1 Create `LeanixToolbarButton.tsx` following `ToolbarButton.tsx` pattern:
  - Icon (cloud upload or Leanix logo)
  - "Send to Leanix" label
  - Disabled state when not configured, no diagram name, or not in edit mode

- [x] 6.2 Implement click handler:
  - Check if configured via `useLeanixConfig`
  - Get diagram name via `api.getDiagram()`
  - Call `leanixService.searchDiagrams(name)`
  - If found: update workingCopy + save
  - If not found: create new diagram
  - Show success/error toasts via `showToast`

- [x] 6.3 Show loading toast at start, replace with success/error toast on completion

## 7. Config Modal Component

- [x] 7.1 Create `LeanixConfigModal.tsx`:
  - Form with Base URL, Auth Token (password), User ID inputs
  - Save and Clear buttons
  - Validation messages
  - Toggle to reveal/hide token

- [x] 7.2 Add styling consistent with `ModalContent.tsx` from example

- [x] 7.3 Integrate with `useLeanixConfig` hook

## 8. Plugin Entry Point

- [x] 8.1 Create `src/index.tsx` following `structura-plugin-example-ui` pattern:
  ```typescript
  window.StructuraPlugin.define({
    manifest: { ... },
    activate: (api) => {
      // Register toolbar button
      api.registerPanel({
        id: "leanix-toolbar",
        slot: "canvas-toolbar",
        title: { en: "Leanix", "pt-BR": "Leanix" },
        component: LeanixToolbarButton
      });
    }
  });
  ```

## 9. i18n Labels

- [x] 9.1 Add translations to `src/i18n/labels.ts`:
  ```typescript
  export const LABELS = {
    toolbar: {
      button: { en: "Send to Leanix", "pt-BR": "Enviar para Leanix" },
      sendToLeanix: { en: "Send to Leanix", "pt-BR": "Enviar para Leanix" },
      // ...
    },
    toasts: {
      sending: { en: "Sending to Leanix...", "pt-BR": "Enviando para Leanix..." },
      success: { en: "Diagram sent to Leanix!", "pt-BR": "Diagrama enviado para o Leanix!" },
      errorToken: { en: "Invalid or expired token", "pt-BR": "Token inválido ou expirado" },
      errorConnection: { en: "Connection error", "pt-BR": "Erro de conexão" },
      errorInternal: { en: "Leanix internal error", "pt-BR": "Erro interno do Leanix" },
      openInLeanix: { en: "Open in Leanix", "pt-BR": "Abrir no Leanix" },
      // ...
    },
    config: {
      title: { en: "Leanix Configuration", "pt-BR": "Configuração do Leanix" },
      baseUrl: { en: "Base URL", "pt-BR": "URL Base" },
      // ...
    }
  };
  ```

## 10. Build and Test

- [x] 10.1 Build the plugin:
  ```bash
  cd plugins/structura-plugin-leanix
  npm install
  npm run build
  ```

- [ ] 10.2 Test locally by uploading `dist/plugin.js` from Plugins page

- [ ] 10.3 Unit tests for `leanix.service.ts` functions

- [ ] 10.4 Unit tests for `useLeanixConfig` hook

- [ ] 10.5 Manual testing with staging Leanix instance

- [ ] 10.6 Test error scenarios:
  - Invalid token
  - Network failure
  - Diagram not found
  - Duplicate diagram

## 11. Documentation

- [x] 11.1 Add Leanix integration to `plugins/README.md`

- [x] 11.2 Document environment variables needed:
  - `PROXY_REVERSE_LEANIX_URL`
  - `PROXY_REVERSE_LEANIX_API_TOKEN` (optional)
