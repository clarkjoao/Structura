import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="divide-y divide-border px-4">{children}</div>
    </section>
  );
}

function ShortcutRow({
  keys,
  label,
  description,
}: {
  keys: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0 whitespace-nowrap">{keys}</div>
    </div>
  );
}

export default function ShortcutsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] p-0 overflow-hidden rounded-2xl">
        <div className="border-b border-border px-6 py-5">
          <DialogHeader>
            <DialogTitle>Atalhos do Canvas</DialogTitle>
            <DialogDescription>
              Dica: em Windows/Linux, use <Kbd>Ctrl</Kbd> no lugar de <Kbd>Cmd</Kbd>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <ShortcutCard title="Busca e navegação">
              <ShortcutRow
                label="Buscar componente no canvas"
                description="Busca por nome, descrição, tecnologia e tags"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>F</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Buscar (atalho alternativo)"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>/</Kbd>
                  </span>
                }
              />
            </ShortcutCard>

            <ShortcutCard title="Seleção e edição">
              <ShortcutRow label="Limpar seleção" keys={<Kbd>Esc</Kbd>} />
              <ShortcutRow
                label="Selecionar tudo"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>A</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Excluir selecionados"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Del</Kbd>
                    <span className="text-muted-foreground">ou</span>
                    <Kbd>Backspace</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Desfazer"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>Z</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Refazer"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>Shift</Kbd>
                    <Kbd>Z</Kbd>
                  </span>
                }
              />
            </ShortcutCard>

            <ShortcutCard title="Agrupamento e clipboard">
              <ShortcutRow
                label="Copiar"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>C</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Colar"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>V</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Duplicar"
                description="Copia e cola com offset"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>D</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Agrupar selecionados (criar painel)"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>G</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Desagrupar painel"
                description="Quando um painel está selecionado"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>Shift</Kbd>
                    <Kbd>G</Kbd>
                  </span>
                }
              />
            </ShortcutCard>

            <ShortcutCard title="Criação rápida (C4)">
              <ShortcutRow
                label="Abrir Quick Insert no canvas"
                description="Clique com botão direito em área vazia (sem seleção e fora de flow play/record)"
                keys={<Kbd>Botão direito</Kbd>}
              />
              <ShortcutRow
                label="Adicionar Person"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>1</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Adicionar System"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>2</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Adicionar Container"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>3</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label="Adicionar Component"
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>4</Kbd>
                  </span>
                }
              />
            </ShortcutCard>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

